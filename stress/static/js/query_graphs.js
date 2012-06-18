Highcharts.setOptions({
    global: {
                useUTC: false
            },
colors: ['#26ADE4']
});

var chartConfig =  {
    chart: {
               renderTo: 'qps-graph',
               type: 'spline',
               events: {
                   load: null /*function() {
                             // set up the updating of the chart each second
                             var series = this.series[0];
                             setInterval(function() {
                                 var x = (new Date()).getTime(), // current time
                                 y = Math.random() / 5 + 0.8;
                             series.addPoint([x, y]); //, true, true);
                             }, 100);
                         }*/
               }
           },
    plotOptions: {
                     series : {
                                  lineWidth: 1,
                                  marker: {
                                      enabled: false
                                  }
                              }
                 },
    title: {
               text: 'Live random data'
           },
    xAxis: {
               type: 'datetime',
               tickPixelInterval: 100
           },
    yAxis: {
               title: {
                          text: 'Queries Per Second'
                      },
               plotLines: [{
                              value: 0,
                              width: 1,
                              color: '#808080'
                          }]
           },
    tooltip: {
                 formatter: function() {
                                return '<b>'+ this.series.name +'</b><br/>'+
                                    Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) +'<br/>'+
                                    Highcharts.numberFormat(this.y, 2);
                            }
             },
    legend: {
                enabled: false
            },
    exporting: {
                   enabled: false
               },
    series: [{
                name: 'Random data',
                data:null
                    /*
                (function() {
                    // generate an array of random data
                    var data = [],
                time = (new Date()).getTime(),
                i;
                for (i = -19; i <= 0; i++) {
                    data.push({
                        x: time + i * 1000,
                        y: Math.random()
                    });
                }
                return data;
                })()
                */
            }]
}

function QueryGraph(title)
{
    var _this = this;

    _this.initialize = function(title) {
        _this.config = $.extend(true, {}, chartConfig);
        console.log(_this.config);
        _this.config.title.text = title;
        _this.config.chart.events.load = function() { };

        _this.chart = new Highcharts.Chart(_this.config);

        _this.reinit_series();
    }

    _this.reinit_series = function() {
        var _this = this;
        _this.chart.series[0].setData([]);
    };

    _this.record_point = function(y) {
        var x = (new Date()).getTime();
        if (livemode && _this.chart.series[0].yData.length >= 1000)
        {
            _this.chart.series[0].addPoint([x, y], true, true);
        }
        else
        {
            _this.chart.series[0].addPoint([x, y]);
        }
    }

    _this.initialize(title);
}
