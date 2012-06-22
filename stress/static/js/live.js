var signature_to_widget = {};

var resort = 0;
var MAX_QUERIES = 24;
var CURRENT_QUERIES = 0;

function signatureToQueryWidget(signature)
{
    var ret = signature_to_widget[signature];
    if (ret)
    {
        return ret;
    }
    else if (CURRENT_QUERIES >= MAX_QUERIES)
    {
        return null;
    }

    setLoadingStatus("Loading queries from MemSQL plancache.");

    widget = new QueryWidget();
    CURRENT_QUERIES++;
    widget.codemirror.setValue(signature);
    widget.freeze();
    signature_to_widget[signature] = widget;
    return widget;
}

function updateWorkloadLoop() {
    $.ajax({
        'url' : '/live/stats',
        'type' : 'GET',
        'data'  : { 'settings' : JSON.stringify(getSettings())},
        'dataType' : 'JSON',
        'success' : onWorkloadReceive,
        'error' : genericError
    });
}

function onWorkloadReceive(data, textStatus, jqXHR) {
    if (!data.running)
    {
        if (data.error)
        {
            createError(data.error);
        }
        var onlyTryOnceHandler = function() {
            $(window).unbind('settingsUpdated', onlyTryOnceHandler);
            updateWorkloadLoop();
        }
        $(window).bind('settingsUpdated', onlyTryOnceHandler);
        return;
    }

    updateMetrics(JSON.parse(data.metrics))

    if (resort == 1)
    {
        for (s in signature_to_widget)
        {
            signature_to_widget[s].delete();
            delete signature_to_widget[s];
            CURRENT_QUERIES--;
        }
        resort = 0;
    }


    var total_qps = 0;
    var tuples = [];
    var plancache = JSON.parse(data.plancache);

    for (var key in plancache) tuples.push([key, plancache[key]]);

    tuples.sort(function(a, b) {
        a = a[1];
        b = b[1];

        return a < b ? -1 : (a > b ? 1 : 0);
    });

    for (var i = tuples.length - 1; i >= 0; i--) {
        var s = tuples[i][0];
        var qps_number = parseFloat(tuples[i][1]);

        var widget = signatureToQueryWidget(s);
        if (widget)
        {
            widget.setDialValue(qps_number);
        }

        total_qps += qps_number;
    }

    clearLoadingStatus();
    qps_graph.record_point(total_qps);

    setTimeout(updateWorkloadLoop, 100);
}

//--------------------------
// Metrics
//

var haventLoadedMetricsYet = true;

function updateMetrics(mets) {
    for (var key in metricsNames) {
        var val = parseFloat(mets[metricsNames[key]]);
        if (isNaN(val)) val = 0;
        metricsValues[key] = val; 
    }
    if (haventLoadedMetricsYet) {
        reloadMetricsChart();
        haventLoadedMetricsYet = false;
    }
}

function reloadMetricsChart() {
    mets_graph.series[0].data[0].update(metricsValues['array'], false);
    mets_graph.series[0].data[1].update(metricsValues['hash'], false);
    mets_graph.series[0].data[2].update(metricsValues['buffer'], false);

    mets_graph.series[1].data[0].update(metricsValues['array'], false);
    mets_graph.series[1].data[1].update(metricsValues['hash'], false);
    mets_graph.series[1].data[2].update(metricsValues['cached'], false);
    mets_graph.series[1].data[3].update(metricsValues['table'], false);
    var other = metricsValues['buffer'] - (metricsValues['cached'] + metricsValues['table']);
    if (other < 0) {
        other = 0;
        mets_graph.series[0].data[2].update(metricsValues['cached'] + metricsValues['table'], false);
    }
    mets_graph.series[1].data[4].update(other, false);
    mets_graph.redraw();
}

var metricsNames = {
    'array': 'Alloc_large_array',
    'hash': 'Alloc_hash_buckets',
    'buffer': 'Buffer_manager_memory',
    'cached': 'Buffer_manager_cached_memory',
    'table': 'Alloc_table_memory',
};

var metricsValues = {};

$(document).ready(function() {
    qps_graph.record_point(0);
    updateWorkloadLoop();

    mets_graph = new Highcharts.Chart(metricsChartConfig);
    setInterval(reloadMetricsChart, 3000);

    $("#save-workload").click(function() {
        settings = encodeURIComponent(JSON.stringify(getSettings()));
        workload = encodeURIComponent(JSON.stringify(getWorkload()));
        args = 'settings=' + settings + '&workload=' + workload;
        window.location.replace('/save?' + args);
    });

    $("#resort-queries").click(function() {
        resort = 1;
    });

    if (redirected) {
        $("#readonly-modal").modal({keyboard : false, backdrop : 'static', show: true});
    }
});

