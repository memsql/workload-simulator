"""Add a description here
"""

from flask import Flask, request, session, g, redirect, url_for, \
             abort, render_template, flash, make_response

from cStringIO import StringIO
import logging
import multiprocessing
import re
import subprocess
import sys
import _mysql
import string

import database
import plancache
import query_table
import utils
import worker

import random
from datetime import datetime, timedelta

try:
    import simplejson as json
except ImportError as e:
    import json

logger = logging.getLogger('server')
logger.setLevel(logging.DEBUG)

DEBUG         = True
SECRET_KEY    = 'foobar'
PING_TIMEOUT  = 10   # in seconds
VERY_LONG_AGO = datetime(1990, 03, 02) # send me a bday card

app = Flask(__name__)
app.config.from_object(__name__)

g_workload  = None
g_workers   = None
g_last_ping = VERY_LONG_AGO
g_settings  = None

# immutable, at least in theory
class Settings:
    def __init__(self, d):
        self.memsql_host = None
        self.memsql_port = None
        self.memsql_user = None
        self.memsql_pass = None
        self.memsql_db = None
        self.workers = None
        change = False
        try:
            for key, setting in d.items():
                if not hasattr(self, key):
                    continue
                if isinstance(setting, str): 
                    setting = setting.lstrip().rstrip()
                if key in ['memsql_port', 'workers']:
                    setting = int(setting)
                if getattr(self, key) != setting:
                    change = True
                    setattr(self, key, setting)
        except ValueError as e:
            raise ServerException('Invalid settings. Please verify port number and workers processes', ServerException.ER_SETTINGS)

    def __eq__(self, another):
        return hasattr(another, 'memsql_host') and self.memsql_host == another.memsql_host \
                   and hasattr(another, 'memsql_port') and self.memsql_port == another.memsql_port \
                   and hasattr(another, 'memsql_user') and self.memsql_user == another.memsql_user \
                   and hasattr(another, 'memsql_pass') and self.memsql_pass == another.memsql_pass \
                   and hasattr(another, 'memsql_db') and self.memsql_db == another.memsql_db \
                   and hasattr(another, 'workers') and self.workers == another.workers

    def __hash__(self):
        return hash(frozenset(self.get_dict().items()));

    def get_db_conn(self):
        return utils.get_db_conn(self.memsql_host, self.memsql_port, \
                    self.memsql_user, self.memsql_pass, self.memsql_db)

    def get_dict(self):
        return {
                'memsql_host'   : self.memsql_host,
                'memsql_port'   : self.memsql_port,
                'memsql_user'   : self.memsql_user,
                'memsql_pass'   : self.memsql_pass,
                'memsql_db'     : self.memsql_db,
                'workers'       : self.workers
        }

    def get_client_arguments(self):
        return {
                'host'      : self.memsql_host,
                'port'      : self.memsql_port,
                'user'      : self.memsql_user,
                'passwd'    : self.memsql_pass,
                'db'        : self.memsql_db,
                'unix_socket' : '/tmp/memsql.sock'
        }

class ServerException(Exception):
    ER_UNKNOWN  = 0
    ER_DBCONN   = 1
    ER_DBNAME   = 2
    ER_JS       = 3
    ER_QUERY    = 4
    ER_SETTINGS = 5

    def __init__(self, message, n=ER_UNKNOWN):
        self.message = message
        self.n = n

    def to_dict(self):
        return {'errno' : self.n, 'message' : self.message}

    def __str__(self):
        return "[%d] %s" % self.message

class WorkloadException(ServerException):
    def __init__(self, id_to_error):
        self.id_to_error = id_to_error

    def to_dict(self):
        ret = {
            'errno' : ServerException.ER_QUERY, 
            'message' : 'Invalid queries in workload',
            'query_map' : self.id_to_error
        }
        return ret

def format_response(running, error=None, **kwargs):
    ret = {'running' : running}
    if error:
        assert isinstance(error, ServerException)
        ret['error'] = error.to_dict()
        
    ret.update(kwargs)
    return json.dumps(ret)

def validate_workload():
    global g_workload
    global g_workers
    global g_settings

    try:
        conn = _mysql.connect(**g_settings.get_client_arguments())

        try:
            qt = query_table.QueryTable(g_workload, g_workers.qps_array, g_workers.qps_query_table)
            failed_queries = {}
            for q in qt.query_objects:
                query = q.query_f('0')
                logger.debug("Validating [%s]" % query)
                try:
                    conn.query(query)
                    conn.store_result()
                except _mysql.MySQLError as e:
                    n,m = e
                    if n in worker.uncaught_errors:
                        failed_queries[q.query_id] = str(e)
                    else:
                        logger.debug("Uncaught [%d] : %s" % (n, m))
                    
            if len(failed_queries) > 0:
                raise WorkloadException(failed_queries)
                
            if qt.is_empty():
                raise ServerException("Workload is empty. Adjust the dial to indicate how many times to run the query per-second.", ServerException.ER_JS)
            
            logger.debug("VALID WORKLOAD!")
        finally:
            conn.close()
    except _mysql.MySQLError as e:
        check_connection_settings(g_settings)
        raise ServerException('Unable to validate workload. Could not connect to database.', ServerException.ER_UNKNOWN) 

def check_connection_settings(settings):
    try:
        conn = settings.get_db_conn()
    except database.MySQLError as e:
        n,m = e
        if n == worker.ER_DB_DNE:
            raise ServerException(str(e), ServerException.ER_DBNAME)
        else:
            raise ServerException(str(e), ServerException.ER_DBCONN)

    try:
        conn.query('show tables')
    except database.MySQLError as e:
        raise ServerException(str(e), ServerException.ER_DBNAME)
    finally:
        conn.close()

# Raises a ServerException with a human readable error if the workers
# aren't in tip-top shape.
def check_workers():
    global g_workers
    global g_settings

    if not g_workers.is_alive():
        check_connection_settings(g_settings)
        raise ServerException("Unable to initialize workers.")
        
    logger.debug("Checked workers PASSED")

def reset_workers():
    global g_workers
    global g_settings

    if g_workers is not None:
        g_workers.clear()
    logger.info("Creating %d workers", g_settings.workers)
    g_workers = worker.WorkerPool(g_settings)

@app.route('/', methods=['GET'])
def render_index():
    global g_last_ping
    global g_settings

    if (datetime.now() - g_last_ping).seconds <= PING_TIMEOUT:
        return redirect(url_for('get_live_page', redirected=True));
    else:
        g_last_ping = datetime.now();
        return render_template('index.html', settings=g_settings, live=False)

@app.route('/workload', methods=['POST'])
def submit_workload():
    global g_workers
    global g_workload
    global g_settings

    try:
        g_workload = {}

        for query_id, info in json.loads(request.values.get('workload')).items():
            try:
                info['qps'] = int(info['qps'])
            except ValueError as e:
                info['qps'] = int(float(info['qps']))
            g_workload[int(query_id)] = info
        if len(g_workload) == 0:
            raise ServerException("The workload table is empty. Use the workspace below to add new queries.", \
                    ServerException.ER_JS)

        g_settings = Settings(json.loads(request.values.get('settings')))
        if g_workers is None \
                or not g_workers.is_alive() \
                or g_workers.settings_dict != g_settings.get_dict():
            reset_workers()

        check_workers()

        validate_workload()

        if not g_workers.pause():
            raise ServerException("Unknown Error- workers failed")

        g_workers.send_workload(g_workload)
        return format_response(True)
    except ServerException as e:
        return format_response(False, e)

@app.route('/ping', methods=['POST'])
def ping():
    global g_last_ping
    
    if (datetime.now() - g_last_ping).seconds <= PING_TIMEOUT:
        g_last_ping = datetime.now()
        return 'OK'
    else:
        return 'Timeout'

@app.route('/unload', methods=['PUT'])
def unload():
    global g_last_ping
    g_last_ping = VERY_LONG_AGO
    return ''

@app.route('/pause', methods=['POST'])
def pause():
    global g_workers

    try:
        if g_workers is None or g_workers.paused:
            return format_response(False)

        check_workers()

        g_workers.pause()
        assert g_workers.paused
        return format_response(False)
    except ServerException as e:
        return format_response(False, e)

stat_check_count = 0
full_check_period = 10 # should work out to once per second
@app.route('/stats', methods=['get'])
def get_stats():
    global g_workers
    global g_workload
    global stat_check_count
    global full_check_period

    try:
        if g_workers is None:
            return format_response(False)

        if stat_check_count % full_check_period == 0:
            check_workers()

        stat_check_count += 1

        ret = {}
        for query_id, info in g_workload.items():
            ret[query_id] = max(0, g_workers.qps_array[query_id])

        return format_response(True, None, stats=ret)
    except ServerException as e:
        return format_response(False, e)


@app.route('/status', methods=['GET'])
def get_status():
    global g_workers
    global g_workload

    if g_workers is None:
        return format_response(running=False, error=None)

    try:
        check_workers()
        running = not g_workers.paused
        return format_response(running=running, error=None)
    except ServerException as e:
        return format_response(False, e)

@app.route('/live', methods=['GET'])
def get_live_page():
    global g_settings
    redirected = request.values.get('redirected')
    return render_template('index.html', settings=g_settings, live=True, redirected=redirected)


@app.route('/live/stats', methods=['GET'])
def get_live_stats():
    global g_plancaches
   
    settings = Settings(json.loads(request.values.get('settings', '{}')))
    my_plancache = plancache.plancacheFactory(settings)

    try:
        return format_response(True, None, plancache=json.dumps(my_plancache.get_stats()), metrics=json.dumps(my_plancache.get_metrics()))
    except plancache.PlancacheBroken:
        # broken pipe to worker process- something's up
        try:
            check_connection_settings(settings)
            raise ServerException("Unable to access plancache")
        except ServerException as e:
            return format_response(False, e)

def get_use_db(cmd):
    cmd = cmd.lstrip().rstrip()
    match = re.search(r'^use\s+([^\s]*)\s*;$', cmd)
    if match:
        return match.group(1)
    else:
        None

@app.route('/sql', methods=['GET'])
def run_sql_command():
    print 'SQL COMMAND'
    print request.values.get('settings')

    try:
        settings = Settings(json.loads(request.values.get('settings')))

        sql_command = re.sub(r'"', r'\\"', request.values.get('command'))

        args = settings.get_client_arguments()

        while True:
            command = 'mysql -h %(host)s --socket=%(unix_socket)s --port=%(port)d -u %(user)s --password=%(passwd)s %(db)s --table -vvv;' % args
            p = subprocess.Popen(command, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = p.communicate(sql_command)
            exit_code = p.returncode
            if (string.count(stdout, '\n') <= 100):
                print stdout, stderr
            else:
                print 'Output too long to print', stderr

            ret = {}
            if exit_code == 0:
                output = stdout
                try:
                    output = re.split(r'^--------------$', output, maxsplit=3, flags=re.MULTILINE)[2]
                except IndexError as e:
                    pass
                output = output.split('Bye')[0]
                output = output.lstrip().rstrip()
                if output != '':
                    output = output + "\n"
                db_name = get_use_db(sql_command)
                if db_name:
                    output = "Database Changed"
                    ret['db'] = db_name
                break
            else:
                output = stderr
                if re.search(r'^ERROR 1049', output) and args['db'] != '':
                    args['db'] = ''
                else:
                    if re.search(r'^ERROR 2003', output): # can't connect to mysql
                        raise ServerException(output, ServerException.ER_DBCONN)
                    else:
                        break

        ret['output'] = output
        return json.dumps(ret)
    except ServerException as e:
        return format_response(False, e);

@app.route('/save', methods=['GET'])
def save_session():
    settings = request.values.get('settings', None)
    if settings:
        save_settings = json.loads(settings)
    else:
        save_session = Settings(json.loads(settings)).get_dict()

    workload = request.values.get('workload', None)
    if workload:
        save_workload = json.loads(workload)
    else:
        save_workload = g_workload

    contents = json.dumps({'settings' : save_settings, 'workload' : save_workload})
    headers  = {'Content-Type' : 'application/x-download', 'Content-Disposition' : 'attachment;filename=workload.json'}
    print contents
    return make_response((contents, 200, headers))

@app.route('/kill', methods=['GET'])
def kill():
    global g_workers
    global g_plancaches

    if g_workers:
        g_workers.clear()
    if g_plancaches:
        del g_plancaches
    sys.exit()

def main():
    global g_settings

    options = utils.get_options()

    g_settings = Settings({})
    g_settings.memsql_host = options.memsql_host
    g_settings.memsql_port = options.memsql_port
    g_settings.memsql_user = options.memsql_user
    g_settings.memsql_pass = options.memsql_pass
    g_settings.memsql_db = options.memsql_db
    g_settings.workers = options.workers

    app.run(debug=True, port=options.server_port, host='0.0.0.0')

if __name__ == '__main__':
    main() 
