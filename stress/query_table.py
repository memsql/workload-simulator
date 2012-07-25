from bisect import bisect_right
import datetime
import logging
import os
import random

logger = logging.getLogger('query_table')
logger.setLevel(logging.INFO)

STRING_TOKEN = "^"
NUMBER_TOKEN = "@"

# Can use anything after G for arbitrary tokens
TIME_TOKEN   = "@T"
MARK_TOKEN   = "@M"

# These are ordered very specifically so that
# if i < j, SPLIT_TOKENS[i] is not a prefix of
# SPLIT_TOKENS[j]
ALL_PARAM_TOKENS = ["@M", "@T", "@", "^"]

# Final Types
OLD_STRING = 0
NEW_STRING = 1
OLD_NUMBER = 2
NEW_NUMBER = 3

def split_and_fold(s, c):
    build = []
    spl = s.split(c)
    for i, piece in enumerate(spl):
        if i > 0:
            build.append(c)
        build.append(piece)

    return build

def tokenize_query(query):
    string_list = [query]
    for i, c in enumerate(ALL_PARAM_TOKENS):
        build = []
        for j, s in enumerate(string_list):
            if s in ALL_PARAM_TOKENS[:i]:
                build.append(s)
            else:
                build.extend(split_and_fold(s, c))
        string_list = build
    return string_list

# Very simple heuristics. Uses old numbers with select queries
def parse_query(qlist):
    qtype = qlist[0].lstrip().split()[0].lower()
    ret = []
    if qtype == "select":
        for q in qlist:
            if q == STRING_TOKEN:
                ret.append(OLD_STRING)
            elif q == NUMBER_TOKEN:
                ret.append(OLD_NUMBER)
            else:
                ret.append(q)
    else:
        for q in qlist:
            if q == STRING_TOKEN:
                ret.append(NEW_STRING)
            elif q == NUMBER_TOKEN:
                ret.append(NEW_NUMBER)
            else:
                ret.append(q)

    return ret
        

def find_gt(a, x):
    'Find leftmost value greater than x'
    i = bisect_right(a, x)
    return i

counter = 0
def get_new_random_number(prefix):
    global counter
    ret = counter
    counter += 1
    return prefix + str(ret)

def get_old_random_number(prefix):
    ret = random.randint(1, max(counter, 2))
    return prefix + str(ret)

def get_random_string(prefix, n):
    global counter
    ret = counter
    counter += 1
    s = prefix + "|" + str(ret)
    return s[:n]

def get_global_marker(prefix):
    return prefix

global_time = datetime.datetime.now()
def get_random_time():
    global global_time
    current_time = int("%.4d%.2d%.2d%.2d%.2d%.2d" % global_time.timetuple()[:6])
    global_time += datetime.timedelta(seconds = 1)
    return str(current_time)

def generate_query_function(query):
    qlist = tokenize_query(query)
    qlist = parse_query(qlist)
    build = []
    for q in qlist:
        if q == OLD_STRING or q == NEW_STRING:
            build.append(repr("'"))
            build.append("get_random_string(prefix, 32)")
            build.append(repr("'"))
        elif q == OLD_NUMBER:
            build.append("get_old_random_number(prefix)")
        elif q == NEW_NUMBER:
            build.append("get_new_random_number(prefix)")
        elif q == TIME_TOKEN:
            build.append("get_random_time()")
        elif q == MARK_TOKEN:
            build.append("get_global_marker(prefix)")
        else:
            build.append(repr(q))
    ret = ','.join(build)
    query_f_s = 'lambda prefix: "".join([%s])' % ret
    query_f = eval(query_f_s)
    return query_f_s, query_f

class QueryGen(object):
    def __init__(self, query_id, query, stats):
        self.query_id = query_id
        self.queryf_str, self.query_f = generate_query_function(query)
        self.stats = stats

class QueryTable(object):
    def __init__(self, workload, qps_array, qps_query_table):
        self.probabilities = []
        self.query_objects = []

        self.total_qps    = sum([int(info['qps']) for info in workload.values()])
        self.max_query_id = max([int(k) for k in workload.keys()])

        workload_l = workload.items()
        workload_l.sort(key=lambda (q, i) : i['qps'])

        qps_prob = 0.0
        for query_id, info in workload_l:
            if info['qps'] == 0:
                qps_prob = 0
            else:
                qps_prob += (info['qps']*1.0)/self.total_qps

            stats = qps_query_table[query_id]

            self.probabilities.append(qps_prob)
            self.query_objects.append(QueryGen(query_id, info['query'], stats))

        self.qps = qps_array

    def is_empty(self):
        return self.total_qps == 0

    def get_random_query(self):
        i = find_gt(self.probabilities, random.random())
        return self.query_objects[i]
