var colors = Highcharts.getOptions().colors,
categories = ['Transaction Buffer', 'Hash Tables', 'Buffer Manager'],
name = 'MemSQL Memory Usage',
data = [{
        y: 50,
        color: colors[0],
        drilldown: {
            name: 'Transaction Buffer',
            categories: ['Transaction Buffer'],
            data: [50],
            color: colors[0]
        }
    }, {
        y: 20,
        color: colors[1],
        drilldown: {
            name: 'Hash Tables',
            categories: ['Hash Tables'],
            data: [20],
            color: colors[1]
        }
    }, {
        y: 30,
        color: colors[2],
        drilldown: {
            name: 'Buffer Manager',
            categories: ['Table', 'Cached', 'Other'],
            data: [10, 10, 0],
            color: colors[2]
        }
    }];


// Build the data arrays
var memUsage = [];
var submemUsage = [];
for (var i = 0; i < data.length; i++) {

    memUsage.push({
        name: categories[i],
        y: data[i].y,
        color: data[i].color
    });

    for (var j = 0; j < data[i].drilldown.data.length; j++) {
        var brightness = 0.2 - (j / data[i].drilldown.data.length) / 5 ;
        submemUsage.push({
            name: data[i].drilldown.categories[j],
            y: data[i].drilldown.data[j],
            color: Highcharts.Color(data[i].color).brighten(brightness).get()
        });
    }
}


// Create the chart
var metricsChartConfig = {
    chart: {
        renderTo: 'mets-graph',
        type: 'pie',
        plotBorderWidth: null,
        plotBackgroundColor: null,
        spacingBottom: 100,
        height: 500,
        borderWidth: 0,
    },
    title: {
        text: 'MemSQL Memory Usage',
        margin: 60,
    },
    yAxis: {
        title: {
            text: 'Total percent of memory'
        }
    },
    plotOptions: {
        pie: {
            shadow: false,
            allowPointSelect: true,
            cursor: 'pointer',
            size: '100%',
            dataLabels: {
                enabled: true,
                color: '#000000',
                connectorColor: '#000000',
                formatter: function() {
                    return '<b>'+ this.point.name +'</b>: '+ this.y.toFixed(2) +' MB (' + this.percentage.toFixed(2) + ' %)';
                }
            }
        }
    },
    tooltip: {
        formatter: function() {
            ret = '';
            switch (this.point.name) {
                case 'Transaction Buffer':
                    ret += 'Transaction log records before they\'re flushed to disk.';
                    break;
                case 'Hash Tables':
                    ret += 'Used for table indices.';
                    break;
                case 'Buffer Manager':
                    ret += 'Buffer Manager -- see subcategories.';
                    break;
                case 'Table':
                    ret += 'Allocators that store table data.';
                    break;
                case 'Cached':
                    ret += 'Allocated from OS which isn\'t used by allocators.';
                    break;
                case 'Other':
                    ret += 'Other buffer manager memory.';
                    break;
            }
            return ret;
        }
    },
    series: [{
        name: '',
        data: memUsage,
        size: '70%',
        dataLabels: {
            formatter: function() {
                // should be in terms of this.percentage instead of this.y but percentage is broken in dynamic highcharts
                return this.y > 100 ? this.point.name + ': ' + this.y.toFixed(2) + ' MB': null;
            },
            color: 'white',
            distance: -30
        }
    }, {
        name: '',
        data: submemUsage,
        innerSize: '70%',
        dataLabels: {
            formatter: function() {
                return this.y > 1 ? '<b>'+ this.point.name +':</b> ' + this.y.toFixed(2) + ' MB'  : null;
            }
        }
    }]
};

