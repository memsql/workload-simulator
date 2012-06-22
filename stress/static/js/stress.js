var qps_graph = null;

function updateWorkloadLoop() {
    $.ajax({
        'url' : '/stats',
        'type' : 'GET',
        'dataType' : 'JSON',
        'success' : onWorkloadReceive,
        'error' : genericError
    });
}

function onWorkloadReceive(data, textStatus, jqXHR) {
    if (playButton.running == 0)
    {
        return;
    }

    console.log(data);
    if (!data['running'])
    {
        if (data['error'])
        {
            createError(data['error']);
        }
        playButton.pause();
    }
    else
    {
        var total_qps = 0;
        stats = data['stats'];
        for (var i in stats)
        {
            var qps_number = parseFloat(stats[i]);
            total_qps += qps_number;
            query_widget_map[i].setDialValue(qps_number);
        }
        qps_graph.record_point(total_qps);

        setTimeout(updateWorkloadLoop, 100);
    }
}

var playButton = new function PlayButton() {
    var _this = this;
    _this.initialize = function() {
        var _this = this;
        _this.running = 0; // make this dynamic
        _this.dom = $('.play-button');

        _this.resetButton();

        _this.dom.find('a').click(function() {
            if (_this.running == 0) {
                _this.play(true);
            } else if (_this.running == 1) {
                _this.pause(true)
            }
        });
    };
    _this.play= function(async) {
        for (var i in query_widget_map)
        {
             query_widget_map[i].dom.click();
        }
        setLoadingStatus("Validating Workload");
        $.ajax({
            'type' : 'POST',
            'url'  : '/workload',
            'dataType' : 'JSON',
            'async' : async,
            'data' : {
                'workload' : JSON.stringify(getWorkload()),
                'settings' : JSON.stringify(getSettings())
            },
            'success' : function(data, textStatus, jqXHR) {
                console.log('successfully submitted workload');
                console.log(data);
                clearLoadingStatus();
                if (data['running'])
                {
                    _this.running = 1;
                    qps_graph.reinit_series();
                    freezeAllQueryWidgets();
                    freezeSettingsForm();
                    deactivateDialValue();
                    $("#new-widget").css('backgroundColor', '#eee');
                    _this.resetButton();
                }
                else
                {
                    _this.running = 0;
                }

                if (data['error'])
                {
                    createError(data['error']);
                }
            },
            'error' : function() { clearLoadingStatus(); genericError(); }
        });
    };
    _this.pause = function(async) {
        setLoadingStatus("Pausing Workload.");
        $.ajax({
            'type' : 'POST',
            'url'  : '/pause',
            'async' : async,
            'success' : function(data, textStatus, jqXHR) {
                clearLoadingStatus();
                console.log('paused workload');
                console.log(data);
                if (!data['running'])
                {
                    _this.running = 0;
                    unfreezeAllQueryWidgets();
                    unfreezeSettingsForm();
                    activateDialValue();
                    $("#new-widget").css('backgroundColor', '#fff');
                    _this.resetButton();
                }
                if (data['error'])
                {
                    createError(data['error']);
                }
            },
            'error' : function() { clearLoadingStatus(); genericError(); }
        });
    };
    _this.resetButton = function() {
        var _this = this;
        var a  = _this.dom.find('a');
        if (_this.running == 0) {
            a.removeClass('btn-danger');
            a.addClass('btn-success');
            a.html('PLAY');
        } else {
            a.removeClass('btn-success');
            a.addClass('btn-danger');
            a.html('PAUSE');
            updateWorkloadLoop();
        }
    };
}

function clearWorkload()
{
    clearQueryWidgets();
    localStorage.removeItem('workload_cache');
}

function readSessionFile(contents)
{
    var ret = JSON.parse(contents);
    if (!(ret.settings && ret.workload))
    {
        throw SyntaxError;
    }

    return ret;
}

function handleUpload(files)
{
    if (files.length < 1)
    {
        return;
    }

    f = files[0];
    var reader = new FileReader();
    reader.onload = function(val) { 
        var info = null;
        try {
            info = readSessionFile(reader.result);
        } catch (SyntaxError) {
            createError({'errno' : ER_JS, 'message' : "Invalid workload file"});
        }
        loadSettings(info.settings);
        loadWorkload(info.workload);
        cacheSettings();
        cacheWorkload();
    };

    reader.readAsText(f);
}

$(document).ready(function() {
    $("#new-widget").click(function(e) {
        if (playButton.running == 0)
        {
            new QueryWidget();
        }
    });

    playButton.initialize();

    $("#save-workload").click(function() {
        settings = encodeURIComponent(JSON.stringify(getSettings()));
        workload = encodeURIComponent(JSON.stringify(getWorkload()));
        args = 'settings=' + settings + '&workload=' + workload;
        window.open('/save?' + args);
    });

    $("#clear-button").click(function() {
        $("#clear-modal").modal({keyboard : false, backdrop : 'static', show: true});
    });

    $('#ok-clear-button').click(clearWorkload);

    var workload_s = localStorage.getItem('workload_cache');
    if (workload_s)
    {
       loadWorkload(JSON.parse(workload_s));
    }
    else
    {
        new QueryWidget();
    }

    autoSave(cacheWorkload);
    autoSave(pingServer);

    window.onbeforeunload = byeServer;

    playButton.pause(false);
});
