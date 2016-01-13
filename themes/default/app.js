// Imports {{{
var _ = require('lodash');
var $ = require('jquery');
var angular = require('angular');
var electron = require('electron');
var Highcharts = require('highcharts');
var moment = require('moment');
// }}}


// User configurable options
var options = {
	chartPeriod: moment.duration(1, 'hour').as('milliseconds'), // How far backwards each chart should log - this period effectvely equals the X axis range
	chartPeriodCleanup: moment.duration(5, 'minutes').as('milliseconds'), // Clean up chart data periodically
	conkieStatsModules: [ // Modules we want Conkie stats to load
		'cpu',
		'dropbox',
		'io', // Also provides 'topIO'
		'memory',
		'net',
		'power',
		'system',
		'temperature',
		'topCPU',
		'topMemory',
	],
	conkieStats: { // Options passed to conkie-stats
		topProcessCount: 5,
		net: {
			ignoreNoIP: true,
			ignoreDevice: ['lo'],
		},
	},
	mainBattery: ['BAT0', 'BAT1'], // Which battery to examine for power info (the first one found gets bound to $scope.stats.battery)
	window: {
		left: -10,
		top: 40,
		width: 240,
		height: 1000,
	},
};



// Code only below this line - here be dragons
// -------------------------------------------


var app = angular.module('app', [
	'highcharts-ng',
]);


// Angular / Filters {{{
/**
* Format a given number of seconds as a human readable duration
* e.g. 65 => '1m 5s'
* @param number value The value to process
* @return string The formatted value
*/
app.filter('duration', function() {
	return function(value) {
		if (!value || !isFinite(value)) return;

		var duration = moment.duration(value, 'seconds');
		if (!duration) return;

		var out = '';

		var hours = duration.hours();
		if (hours) out += hours + 'h ';

		var minutes = duration.minutes();
		if (minutes) out += minutes + 'm ';

		var seconds = duration.seconds();
		if (seconds) out += seconds + 's';

		return out;
	};
});


/**
* Return a formatted number as a file size
* e.g. 0 => 0B, 1024 => 1 kB
* @param mixed value The value to format
* @param boolean forceZero Whether the filter should return '0 B' if it doesnt know what to do
* @return string The formatted value
*/
app.filter('byteSize', function() {
	return function(value, forceZero) {
		if (!value || !isFinite(value)) return (forceZero ? '0 B' : null);

		var exponent;
		var unit;
		var neg = value < 0;
		var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

		if (neg) {
			value = -value;
		}

		if (value < 1) {
			return (neg ? '-' : '') + value + ' B';
		}

		exponent = Math.min(Math.floor(Math.log(value) / Math.log(1000)), units.length - 1);
		value = (value / Math.pow(1000, exponent)).toFixed(2) * 1;
		unit = units[exponent];

		return (neg ? '-' : '') + value + ' ' + unit;
	};
});


/**
* Return a number as a formatted percentage
* @param mixed value The value to format
* @return string The formatted value
*/
app.filter('percent', function() {
	return function(value) {
		if (!value || !isFinite(value)) return '';

		return Math.round(value, 2) + '%';
	};
});

// }}}

/**
* The main Conkie controller
* Each of the data feeds are exposed via the 'stats' structure and correspond to the output of [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats)
*/
app.controller('conkieController', function($scope, $interval, $timeout) {
	// .stats - backend-IPC provided stats object {{{
	$scope.stats = {}; // Stats object (gets updated via IPC)

	electron.ipcRenderer
		// Event: updateStats {{{
		.on('updateStats', function(e, data) {
			$scope.$apply(function() {
				var now = new Date();
				$scope.stats = data;

				// Chart data updates {{{

				// .stats.power {{{
				if ($scope.stats.power) {
					$scope.stats.battery = $scope.stats.power.find(function(dev) {
						return (_.contains(options.mainBattery, dev.device));
					});
					if ($scope.stats.battery) $scope.charts.battery.series[0].data.push([now, $scope.stats.battery.percent]);
				}
				// }}}

				// .stats.io {{{
				if (isFinite($scope.stats.io.totalRead)) $scope.charts.io.series[0].data.push([now, $scope.stats.io.totalRead]);
				// }}}

				// .stats.memory {{{
				if (isFinite($scope.stats.memory.used)) {
					if ($scope.stats.memory.total) $scope.charts.memory.options.yAxis.max = $scope.stats.memory.total;
					$scope.charts.memory.series[0].data.push([now, $scope.stats.memory.used]);
				}
				// }}}

				// .net {{{
				$scope.stats.net.forEach(function(adapter) {
					var id = adapter.interface; // Use the adapter interface name as the chart name
					// Not seen this adapter before - create a chart object {{{
					if (!$scope.charts[id]) $scope.charts[id] = _.defaultsDeep({
						series: [
							{
								name: 'Download',
								data: [],
							},
							{
								name: 'Upload',
								color: '#505050',
								data: [],
							},
						],
					}, $scope.charts.template);
					// }}}
					// Append bandwidth data to the chart {{{
					if (isFinite(adapter.downSpeed)) $scope.charts[id].series[0].data.push([now, adapter.downSpeed]);
					if (isFinite(adapter.upSpeed)) $scope.charts[id].series[1].data.push([now, adapter.upSpeed]);
					// }}}
				});
				// }}}

				// .stats.system {{{
				if (isFinite($scope.stats.system.cpuUsage)) $scope.charts.cpu.series[0].data.push([now, $scope.stats.system.cpuUsage]);
				// }}}

				// META: .stats.netTotal {{{
				$scope.stats.netTotal = $scope.stats.net.reduce(function(total, adapter) {
					if (adapter.downSpeed) total.downSpeed += adapter.downSpeed;
					if (adapter.upSpeed) total.upSpeed += adapter.upSpeed;
					return total;
				}, {
					downSpeed: 0,
					upSpeed: 0,
				});
				// }}}

				// Change the periodStart of each chart {{{
				_.forEach($scope.charts, function(chart, id) {
					chart.options.xAxis.periodStart = new Date(now - options.chartPeriod);
				});
				// }}}
				// }}}

			});
		})
	// }}}
	// Configure conkie-stats to provide us with information {{{
	$timeout(function() {
		electron.ipcRenderer
			.send('statsRegister', options.conkieStatsModules)
	});
	$timeout(function() {
		electron.ipcRenderer
			.send('statsSettings', options.conkieStats);
	});
	// }}}
	// Position the widget {{{
	$timeout(function() {
		electron.ipcRenderer
			.send('setPosition', options.window);
	});
	// }}}
	// Periodically clean up redundent data for all charts {{{
	$interval(function() {
		console.log('CLEAN!');
		var cleanTo = Date.now() - options.chartPeriod;
		_.forEach($scope.charts, function(chart, id) {
			_.forEach(chart.series, function(series, seriesIndex) {
				// Shift all data if the date has fallen off the observed time range
				console.log('CLEAN', id, seriesIndex, series.data);
				series.data = _.dropWhile(series.data, function(d) {
					return (d[0] < cleanTo);
				});
				console.log('CLEANS', id, series.data);
			});
		});
	}, options.chartPeriodCleanup);
	// }}}
	// }}}

	// .time {{{
	$interval(function() {
		$scope.time = moment().format('HH:mm');
		console.log('TIME IS NOW', $scope.time);
	}, 1000);
	// }}}

	// Charts {{{
	$scope.charts = {};
	$scope.charts.template = {
		size: {
			width: 150,
			height: 33,
		},
		options: {
			chart: {
				animation: false,
				borderWidth: 0,
				type: 'area',
				margin: [2, 0, 2, 0],
				backgroundColor: null,
				borderWidth: 0,
				style: {
					border: '1px solid white',
				},
			},
			credits: {
				enabled: false
			},
			title: {
				text: ''
			},
			xAxis: {
				type: 'datetime',
				periodStart: new Date(Date.now() - options.chartPeriod),
				labels: {
					enabled: false
				},
				title: {
					text: null
				},
				startOnTick: false,
				endOnTick: false,
				tickPositions: [],
			},
			yAxis: {
				labels: {
					enabled: false
				},
				title: {
					text: null
				},
				endOnTick: false,
				startOnTick: false,
				tickPositions: [0],
			},
			legend: {
				enabled: false,
			},
			tooltip: {
				enabled: false,
			},
			plotOptions: {
				series: {
					animation: false,
					lineWidth: 1,
					shadow: false,
					states: {
						hover: {
							lineWidth: 1
						}
					},
					marker: {
						radius: 1,
						states: {
							hover: {
								radius: 2
							}
						}
					},
					fillOpacity: 0.25
				},
				column: {
					negativeColor: '#910000',
					borderColor: 'silver'
				},
			},
		},
	};

	$scope.charts.battery = _.defaultsDeep({
		yAxis: {
			min: 0,
			max: 100,
		},
		series: [{
			data: [],
			color: '#FFFFFF',
		}],
	}, $scope.charts.template);

	$scope.charts.memory = _.defaultsDeep({
		yAxis: {
			min: 0,
		},
		series: [{
			data: [],
			color: '#FFFFFF',
		}],
	}, $scope.charts.template);

	$scope.charts.cpu = _.defaultsDeep({
		yAxis: {
			min: 0,
			max: 100,
		},
		series: [{
			data: [],
			color: '#FFFFFF',
		}],
	}, $scope.charts.template);

	$scope.charts.io = _.defaultsDeep({
		yAxis: {
			min: 0,
		},
		series: [{
			data: [],
			color: '#FFFFFF',
		}],
	}, $scope.charts.template);
	// }}}
});
