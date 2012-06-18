var colors = Highcharts.getOptions().colors;

var metricsChartConfig = {
    chart: {
        renderTo: 'mets-graph',
        plotBackgroundColor: null,
        plotBorderWidth: null,
        plotShadow: false,
        type: 'pie'
    },
    title: {
        text: 'MemSQL Memory Usage'
    },
    tooltip: {
        formatter: function() {
            return '<b>'+ this.point.name +'</b>: '+ this.percentage +' %';
        }
    },
    plotOptions: {
        pie: {
            allowPointSelect: true,
            cursor: 'pointer',
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
    series: [{
        name: 'Memory usage',
        size: '50%',
        data: [
            {
                name: 'Large Array',
                y: 0.1,
                color: colors[0],
            },
            {
                name: 'Hash Bucket',
                y: 0.1, 
                color: colors[1],
            },
            {
                name: 'Buffer Manager',
                y: 0.1,
               // sliced: true,
               // selected: true,
                color: colors[2],
            },
        ],
        dataLabels: {
            formatter: function() {
                // FIXME: this is a hack... not sure why hash bucket percentage doesn't update properly
                if (this.point.name != 'Hash Bucket') {
                    return this.percentage > 3 ? this.point.name + ' (' + this.point.percentage.toFixed(1) + '%)' : null;
                } else {
                    return null;
                }
            },
            color: 'white',
            distance: -30
        }
    }, {
        name: 'Memory usage level 2',
        innerSize: '50%',
        data: [
            {
                name: 'Large Array',
                y: 0.1,
                color: colors[0],
            },
            {
                name: 'Hash Bucket',
                y: 0.1,
                color: colors[1],
            },
            {
                name: 'Cached',
                y: 0.03,
                color: colors[3],
            },
            {
                name: 'Table',
                y: 0.03,
                color: colors[4],
            },
            {
                name: 'Other',
                y: 0.04,
                color: colors[5],
            },
        ],
        
    }
    ]
};
