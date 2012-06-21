[MemSQL Workload Simulator](http://developers.memsql.com/)
====================

The MemSQL Workload Simulator lets you simulate running thousands of queries per second against the database with a custom workload. It also supports
live mode, which lets you monitor the performance of a running MemSQL instance.

This project is under active, continuous development. Expect updates to come frequently as the feature set is built out. If you have suggestions for features, feel free to post them to the issues section of this repository or
implement them and submit them as a pull request. If you build an interesting workload, we would love to include it in the samples directory.


Requirements
------------

This guide is known to work on Ubuntu 12.04. Since it uses standard python packages and tools, it should work on other Linux distributions as well. 
It assumes that you already have a MemSQL server set up and running on 127.0.0.1:3306 -- refer to [developers.memsql.com](http://developers.memsql.com) 
for more info about running MemSQL.

All command-line instructions assume that your working directory is the original location of this README file.


Installing the workload simulator
---------------------------------

+ **Make sure you have python dev tools and pip installed**

```
sudo apt-get install python-dev python-setuptools libmysqlclient-dev
sudo easy_install pip
```

+ **Install dependencies**

```
sudo pip install flask sqlalchemy MySQL-python simplejson
```

Running the workload simulator
--------------------

+ **Start the server**

```
python runner
```

+ **You can stop it by sending SIGTERM to the parent python process. The easiest way to do this is to type `Ctrl-\` (control backslash) on your terminal.**


+ **Open http://localhost:9000 in a browser**

This is the "active mode" which allows you to run queries against the MemSQL server. Let's start with a simple example.

+ **Install the key-value example database and table**

```
mysql -h 127.0.0.1 -u root -P 3306 -vv < samples/key_value/key_value.json
```

+ **Load the key-value workload**

On http://localhost:9000, click Load Workload and choose the file `samples/key_value/key_value.json`

You will see three types of queries appear in a grid. Next to each there is a dial indicating how many times per second we will try to execute a query of that type.

+ **Hit PLAY**

The simulator starts executing queries against the database. The dials start showing the actual number of queries per second for each type of query. On the right you can see a real-time graph of the total number of queries per second being processed by MemSQL.

+ **Console**

At any time, you can use the console on the right to run individual queries. Running your own queries may be useful for setting up schemas, inspecting the tables, and checking syntax.

+ **Running with MySQL**

This mode does not use any MemSQL specific query constructs, so you can use it to run heavy workloads against MySQL as well.


Live mode
----------------------

+ **Navigate to http://localhost:9000/live**

This is a real-time monitor of all queries processed by MemSQL. It is refreshed every second. On the bottom right there is a pie chart detailing the memory used by MemSQL. This mode can only be used with MemSQL.


Getting advanced
------------------------

+ **Try creating your own workload in active mode.**

Generate random numbers and strings with @ and ^, respectively. For example, to insert a random integer value in the key-value example, use the query `INSERT INTO t (k, v) VALUES (@, @);`

+ **Check out the sample workload from the video (https://vimeo.com/44087431)**

The sql schema is in `samples/video/video.sql`. The workload is in `samples/video/video.json`


Troubleshooting
-------------------

If a message pops up saying, "something went wrong...", you've run into an unhandled error. If the problem persists, restart the server from the command line by interrupting with Ctrl-\ and running "python runner".
