import time

import worker

client_arguments = dict(host = '127.0.0.1', port = 3306, user = 'root', passwd = '', db = 'test')

workload = {
        0 : {
            'query' : 'select * from x where id > @',
            'qps'   : 1000
        }
}


if __name__ == '__main__':
    pool = worker.WorkerPool(10, client_arguments)
    assert pool.is_alive()
    pool.send_workload(workload)
    time.sleep(10)
    print "--> WOKE UP"
    assert pool.is_alive()
    print "--> ABOUT TO PAUSE"
    pool.pause()
    print "--> DONE PAUSING"
