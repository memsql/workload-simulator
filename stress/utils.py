"""Helper functions.
"""

import logging
import optparse 
import database
from sqlalchemy import pool

# Some basic configuration
LOGGING_FORMAT  = '%(levelname)s: %(asctime)-15s: %(message)s'

# Uniform interface for parsing options, with some common built-in options.
options = None
largs   = None

parser = optparse.OptionParser(add_help_option=False)
parser.add_option("--memsql-host", help="memsql hostname", default="127.0.0.1")
parser.add_option("--memsql-port", help="memsql port", type="int", default=3306)
parser.add_option("--memsql-user", help="memsql user", default="root")
parser.add_option("--memsql-pass", help="memsql pass", default="")
parser.add_option("--memsql-db", help="memsql database", default="")
parser.add_option("-w", "--workers", help="default number of workers", type="int", default=50)
parser.add_option("-p", "--server-port", type="int", default=9000, help="server port")

parser.add_option("", "--help", action="help")

def _parse_options():
    global options
    global largs
    if not (options and largs):
        options, largs = parser.parse_args()

def get_options():
    """Return the parsed (named) options."""
    global options
    _parse_options()
    return options

def get_largs():
    """Return the parsed (free) options."""
    global largs
    _parse_options()
    return largs

# Wraps SQLAlchemy's DB Pool into our own connection pool.
db_pool = pool.manage(database)
def get_db_conn(host=None, port=None, user=None, password=None, database=None):
    """Returns a database connection from the connection pool."""
    global db_pool
    assert options

    if host is None:
        host = options.memsql_host
    if port is None:
        port = options.memsql_port
    if user is None:
        user = options.memsql_user
    if password is None:
        password = options.memsql_password
    if database is None:
        database = options.memsql_db

    return db_pool.connect(
            host='%s:%d' % (host, port), 
            user=user, password=password, database=database)

# Sets up the global logger.
logger = logging.basicConfig(level=logging.ERROR, format=LOGGING_FORMAT)
logger = logging
