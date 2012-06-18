from collections import defaultdict
import logging
import multiprocessing
import time

import worker
import utils

logger = logging.getLogger('plancache')
logger.setLevel(logging.DEBUG)

def save_plancache_loop(SettingsClass, stats, metrics, lock):
    POLLING_PERIOD = worker.PERIOD*10
    prev_time = 0
    prev_pc = {}

    pc_time = 0
    pc_counter = 0

    conn = SettingsClass.get_db_conn()

    while True:
        current_time = time.time()
        rows_pc = conn.query('show plancache')
        rows_mets = conn.query('show status extended')
        pc_time += time.time() - current_time
        pc_counter += 1
        with lock:
            for row in rows_pc:       # fetch plancache
                query = row.QueryText
                db    = row.Database

                if db != SettingsClass.memsql_db:
                    continue

                commits = row.Commits if row.Commits is not None else 0
                rollbacks = row.Rollbacks if row.Rollbacks is not None else 0

                execs = commits + rollbacks

                if query in prev_pc:
                    if query in stats or execs != prev_pc[query]:
                        stats[query] = \
                            (execs - prev_pc[query]) * 1.0/(current_time - prev_time)

                prev_pc[query] = execs

            for row in rows_mets:    # fetch db metrics
                var_name = row.Variable_name
                var_val = row.Value
                metrics[var_name] = var_val

        logger.debug("Total time spent [%g] Average Time Spent [%g]" % (pc_time, pc_time/pc_counter))

        prev_time = current_time
        time.sleep(POLLING_PERIOD)


g_plancaches = {};

def plancacheFactory(settings):
    if not g_plancaches.has_key(settings):
        g_plancaches[settings] = PlancacheStats(settings)
    return g_plancaches[settings];

class PlancacheBroken(Exception):
    pass

class PlancacheStats(object):
    def __init__(self, SettingsClass):
        self.manager = multiprocessing.Manager()
        self.pc_dict = self.manager.dict()
        self.metrics = self.manager.dict()
        self.pc_lock = self.manager.Lock()
        self.pc_proc = multiprocessing.Process(target=save_plancache_loop, args=(SettingsClass, self.pc_dict, self.metrics, self.pc_lock))
        self.pc_proc.start()

    def __del__(self):
        self.pc_proc.terminate()

    def get_metrics(self):
        if not self.pc_proc.is_alive():
            raise PlancacheBroken
        try:
            with self.pc_lock:
                return self.metrics.copy()
        except IOError as e:
            raise PlancacheBroken

    def get_stats(self):
        if not self.pc_proc.is_alive():
            raise PlancacheBroken
        try:
            with self.pc_lock:
                return self.pc_dict.copy()
        except IOError as e:
            raise PlancacheBroken
