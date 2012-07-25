import logging
from math import ceil
import multiprocessing
import _mysql
import os
import signal
import sys
import time
import traceback
import uuid

from query_table import QueryTable

PERIOD  = 0.100

logger = logging.getLogger('worker')
logger.setLevel(logging.INFO)

worker_on = False

ER_NO_DB_SELECTED   = 1046
ER_DB_DNE           = 1049
ER_COL_UNKNOWN      = 1054
ER_SYNTAX           = 1064
ER_COL_COUNT        = 1136
ER_TABLE_DNE        = 1146
ER_NOT_SUPPORTED    = 1707
ER_DEV_MEMORY       = 1720
ER_SERVER_GONE      = 2006

uncaught_errors = set([
    ER_NO_DB_SELECTED,  # No database selected
    ER_TABLE_DNE,       # Table does not exist
    ER_SYNTAX,          # Error in MySQL Syntax
    ER_NOT_SUPPORTED,   # Not supported by MemSQL
    ER_COL_COUNT,       # Wrong column count
    ER_DEV_MEMORY,      # Out of Memory
    ER_COL_UNKNOWN      # Unknown column
])

def worker(index, info_pipe, qps_array, qps_query_table, nworkers, client_arguments):
    try:
        global worker_on
        prefix = str(uuid.uuid4().int & (2**16-1))

        # create connection and run sanity check (show tables)
        conn = _mysql.connect(**client_arguments)
        conn.query('show tables')
        conn.store_result()

        while True:
            info_pipe.send(True)
            try:
                logger.debug("WAITING FOR INSTRUCTIONS")
                workload = info_pipe.recv()
                query_table = QueryTable(workload, qps_array, qps_query_table)
                worker_qps = int(ceil(((query_table.total_qps + 1) / nworkers) * PERIOD))

                # sleep up front to smoothen out QPS
                time.sleep(index*1.1/nworkers)

                while True:
                    start_time = time.time()
                    for i in xrange(worker_qps):
                        query_gen = query_table.get_random_query()
                        try:
                            query = query_gen.query_f(prefix)
                            conn.query(query)
                            conn.store_result()
                        except _mysql.MySQLError as (n,m):
                            logger.debug(n)
                            if n == ER_SERVER_GONE:
                                # the server might have died and restarted in between.
                                # try to reconnect once.
                                conn = _mysql.connect(**client_arguments)
                            elif n in uncaught_errors:
                                raise
                            logger.warning(query)
                            logger.warning("[%d] : %s" % (n,m))

                        query_gen.stats[index] += 1

                    diff = time.time() - start_time
                    sleep_time = PERIOD - diff
                    if sleep_time > 0:
                        logger.debug("sleep %g" % sleep_time)
                        time.sleep(sleep_time)
            except KeyboardInterrupt as e:
                logger.debug("WAITING TO SEND PAUSED")
                conn.store_result()
    except Exception as e:
        logger.error("Exception in child process %d: %s" % (index, str(e)))
        logger.debug(traceback.format_exc())
        del info_pipe
        exit(1)

def stat_loop(qps_array, qps_query_table, pipe):
    POLLING_PERIOD = PERIOD
    prev_qs = [0]*500
    workload = None
    while True:
        pipe.send(True)
        try:
            workload = pipe.recv()
            while True:
                prev_time = time.time()
                time.sleep(POLLING_PERIOD)
                now = time.time()
                for i in workload.keys():
                    stats = qps_query_table[i]
                    diff = sum(stats) - prev_qs[i]
                    prev_qs[i] += diff
                    qps_array[i] = (diff) / (now - prev_time)
        except KeyboardInterrupt as e:
            if workload:
                for i in workload.keys():
                    qps_array[i] = 0

class WorkerPool(object):
    MAX_QUERIES = 500
    def __init__(self, SettingsCls):
        self.nworkers = SettingsCls.workers
        self.client_arguments = SettingsCls.get_client_arguments()

        self.settings_dict = SettingsCls.get_dict()

        # Assume there are no more than 500 queries.
        self.qps_query_table = [multiprocessing.Array('L', [0]*self.nworkers, lock=False)\
                            for i in range(self.MAX_QUERIES)]
        self.qps_array = multiprocessing.Array('d', [0.0]*500, lock=False)

        
        self.pipes = [None] * (self.nworkers + 1)
        self.workers = [None] * (self.nworkers + 1)

        self.workload = None

        logging.debug("Creating workers from the constructor")
        for i in range(self.nworkers):
            self._launch_worker(i)

        self._launch_stat_proc()

        logger.info("created %d workers" % len(self.workers))

        self.paused = True

    def is_alive(self):
        alive = [w and w.is_alive() for w in self.workers]
        all_alive = all(alive)
        if not all_alive:
            running_workers = len([t for t in alive if t])
            logger.debug("%d running workers" % running_workers)

        # If one worker dies, the entire pool is "dead"
        if not all_alive:
            self.clear()

        return all_alive

    # An iterator over the worker processes and pipes for living workers.
    @property
    def living_workers(self):
        for w, p in zip(self.workers, self.pipes):
            if w.is_alive():
                yield w,p

    def send_workload(self, workload):
        self.workload = workload
        self.paused = False

        logger.debug("SENDING PIPES")
        for w,p in self.living_workers:
            p.send(workload)

        logger.debug("SENT PIPES")


    def pause(self):
        self.paused = True
        for w,p in self.living_workers:
            os.kill(w.pid, signal.SIGINT)
        success = True
        for w,p in self.living_workers:
            success &= self._sync(w, p)
        return success

    def clear(self):
        self.pause()
        for w,p in self.living_workers:
            w.terminate()
            w.join()

    def _sync(self, w, p):
        while True:
            ready = p.poll(.1)
            if ready:
                return p.recv()
            elif not w.is_alive():
                return False

    def _launch_worker(self, i):
        logger.debug("launching worker %d" % i)
        info_pipe, worker_pipe = multiprocessing.Pipe()

        w = multiprocessing.Process(target=worker, \
                            args=(i, worker_pipe, self.qps_query_table, self.qps_query_table, \
                                  self.nworkers, self.client_arguments))

        w.start()
        self.pipes[i] = info_pipe
        self.workers[i] = w
        return self._sync(w, info_pipe)

    def _launch_stat_proc(self):
        parent_pipe, child_pipe = multiprocessing.Pipe()
        self.stat_proc = multiprocessing.Process(target=stat_loop, \
                            args=(self.qps_array, self.qps_query_table, child_pipe))
        self.stat_proc.start()

        self.pipes[-1] = parent_pipe
        self.workers[-1] = self.stat_proc
        return self._sync(self.stat_proc, parent_pipe)
