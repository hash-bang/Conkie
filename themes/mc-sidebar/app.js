// User configurable options
var options = {
	chartHistory: 50, // How many spark line chart positions to retain before removing them
	conkieStats: { // Options passed to conkie-stats
		topProcessCount: 5,
		net: {
			ignoreNoIP: true,
			ignoreDevice: ['lo'],
		},
	},
	mainBattery: ['BAT0', 'BAT1'], // Which battery to examine for power info (the first one found gets bound to $scope.stats.battery)
};



// Code only below this line - here be dragons
// -------------------------------------------


// Imports {{{
var _ = require('lodash');
var $ = require('jquery');
var angular = require('angular');
var electron = require('electron');
var Highcharts = require('highcharts');
var moment = require('moment');
// }}}

var app = angular.module('app', [
	'highcharts-ng',
]);


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


/**
* The main Conkie controller
* Each of the data feeds are exposed via the 'stats' structure and correspond to the output of [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats)
*/
app.controller('conkieController', function($scope, $timeout) {
	// .stats - backend-IPC provided stats object {{{
	$scope.stats = {}; // Stats object (gets updated via IPC)

	electron.ipcRenderer
		// Event: updateStats {{{
		.on('updateStats', function(e, data) {
			$scope.$apply(function() {
				$scope.stats = data;

				// Chart data updates {{{

				// .stats.power {{{
				if ($scope.stats.power) {
					$scope.stats.battery = $scope.stats.power.find(function(dev) {
						return (_.contains(options.mainBattery, dev.device));
					});
					if ($scope.stats.battery) {
						$scope.charts.battery.series[0].data.push($scope.stats.battery.percent);
						if ($scope.charts.battery.series[0].data.length > options.chartHistory) $scope.charts.battery.series[0].data.shift();
					}
				}
				// }}}

				// .stats.io {{{
				if (isFinite($scope.stats.io.totalRead)) {
					$scope.charts.io.series[0].data.push($scope.stats.io.totalRead);
					if ($scope.charts.io.series[0].data.length > options.chartHistory) $scope.charts.io.series[0].data.shift();
				}
				// }}}

				// .stats.memory {{{
				if (isFinite($scope.stats.memory.used)) {
					if ($scope.stats.memory.total) $scope.charts.memory.options.yAxis.max = $scope.stats.memory.total;
					$scope.charts.memory.series[0].data.push($scope.stats.memory.used);
					if ($scope.charts.memory.series[0].data.length > options.chartHistory) $scope.charts.memory.series[0].data.shift();
				}
				// }}}

				// .net {{{
				$scope.stats.net.forEach(function(adapter) {
					var id = adapter.interface; // Use the adapter interface name as the chart name
					// Not seen this adapter before - create a chart object {{{
					if (!$scope.charts[id]) $scope.charts[id] = _.defaultsDeep({
						series: [{
							data: [],
							pointStart: 1,
						}],
					}, $scope.charts.template);
					// }}}
					// Append bandwidth data to the chart {{{
					if (isFinite(adapter.downSpeed)) {
						$scope.charts[id].series[0].data.push(adapter.downSpeed);
						if ($scope.charts[id].series[0].data.length > options.chartHistory) $scope.charts[id].series[0].data.shift();
					}
					// }}}
				});
				// }}}

				// .stats.system {{{
				if (isFinite($scope.stats.system.cpuUsage)) {
					$scope.charts.cpu.series[0].data.push($scope.stats.system.cpuUsage);
					if ($scope.charts.cpu.series[0].data.length > options.chartHistory) $scope.charts.cpu.series[0].data.shift();
				}
				// }}}

				// META: .stats.time {{{
				$scope.stats.time = {
					t24h: moment().format('HH:mm'),
				};
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
				// }}}
			});
		})
	// }}}
	// Configure conkie-stats to provide us with information {{{
	$timeout(function() {
		electron.ipcRenderer
			.send('statsRegister', [
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
			]);
	});
	$timeout(function() {
		electron.ipcRenderer
			.send('statsSettings', options.conkieStats);
	});
	// }}}
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
			pointStart: 1,
		}],
	}, $scope.charts.template);

	$scope.charts.memory = _.defaultsDeep({
		yAxis: {
			min: 0,
		},
		series: [{
			data: [],
			color: '#FFFFFF',
			pointStart: 1,
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
			pointStart: 1,
		}],
	}, $scope.charts.template);

	$scope.charts.io = _.defaultsDeep({
		yAxis: {
			min: 0,
		},
		series: [{
			data: [],
			color: '#FFFFFF',
			pointStart: 1,
		}],
	}, $scope.charts.template);
	// }}}
});
