// User configurable options
var options = {
	chartHistory: 50, // How many spark line chart positions to retain before removing them
};



// Code only below this line - here be dragons


var Highcharts = require('highcharts');

var app = angular.module('app', [
	'highcharts-ng',
]);

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

app.filter('byteSize', function() {
	return function(value) {
		if (!value || !isFinite(value)) return '0B';

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

app.controller('conkieController', function($scope) {
	// .battery {{{
	$scope.battery = {
		charging: false,
		levelPercent: 100,
		chargingTime: undefined,
		dischargingTime: undefined,
	};

	navigator.getBattery().then(function(battery) {
		var batteryUpdate = function() {
			console.log('BATTERY UPDATE', battery);
			$scope.$apply(function() {
				$scope.battery.charging = battery.charging;
				$scope.battery.levelPercent = Math.ceil(battery.level * 100);
				$scope.battery.chargingTime = battery.chargingTime;
				$scope.battery.dischargingTime = battery.dischargingTime;
			});
		};

		// Register ourselves as the battery update handler
		battery.addEventListener('chargingchange', batteryUpdate);
		battery.addEventListener('levelchange', batteryUpdate);
		battery.addEventListener('chargingtimechange', batteryUpdate);
		battery.addEventListener('dischargingtimechange', batteryUpdate);

		batteryUpdate();
	});
	// }}}

	// .system / .ram / .net - backend state objects {{{
	// This actually just gets updated by the backend process via IPC
	$scope.system;
	$scope.ram;
	$scope.net;
	$scope.io;
	$scope.dropbox;
	$scope.time = {};
	// }}}

	// Bind to IPC message bus to recieve backend updates {{{
	require('electron').ipcRenderer
		.on('updateState', function(e, data) {
			$scope.$apply(function() {
				// .system {{{
				$scope.system = data.system;
				if (isFinite($scope.system.cpuUsage)) {
					$scope.charts.cpu.series[0].data.push($scope.system.cpuUsage);
					if ($scope.charts.cpu.series[0].data.length > options.chartHistory) $scope.charts.cpu.series[0].data.shift();
				}
				// }}}

				// .ram {{{
				$scope.ram = data.ram;
				if (isFinite($scope.ram.used)) {
					if ($scope.ram.total) $scope.charts.ram.options.yAxis.max = $scope.ram.total;
					$scope.charts.ram.series[0].data.push($scope.ram.used);
					if ($scope.charts.ram.series[0].data.length > options.chartHistory) $scope.charts.ram.series[0].data.shift();
				}
				// }}}

				// .net {{{
				$scope.net = data.net;

				data.net.forEach(function(adapter) {
					// Not seen this adapter before - create a chart object {{{
					if (!$scope.charts[adapter.interface]) $scope.charts[adapter.interface] = _.defaultsDeep({
						series: [{
							data: [],
							pointStart: 1,
						}],
					}, $scope.charts.template);
					// }}}
					// Append bandwidth data to the chart {{{
					if (isFinite(adapter.downSpeed)) {
						$scope.charts[adapter.interface].series[0].data.push(adapter.downSpeed);
						if ($scope.charts[adapter.interface].series[0].data.length > options.chartHistory) $scope.charts[adapter.interface].series[0].data.shift();
					}
					// }}}
				});
				// }}}

				// .netTotal {{{
				$scope.netTotal = data.net.reduce(function(total, adapter) {
					if (adapter.downSpeed) total.downSpeed += adapter.downSpeed;
					if (adapter.upSpeed) total.upSpeed += adapter.upSpeed;
					return total;
				}, {
					downSpeed: 0,
					upSpeed: 0,
				});
				// }}}

				// .battery {{{
				if ($scope.battery && isFinite($scope.battery.levelPercent)) {
					$scope.charts.battery.series[0].data.push($scope.battery.levelPercent);
					if ($scope.charts.battery.series[0].data.length > options.chartHistory) $scope.charts.battery.series[0].data.shift();
				}
				// }}}

				// MISC {{{
				$scope.dropbox = data.dropbox;
				// }}}

				// .io {{{
				$scope.io = data.io;

				if (isFinite($scope.io.totalRead)) {
					$scope.charts.io.series[0].data.push($scope.io.totalRead);
					if ($scope.charts.io.series[0].data.length > options.chartHistory) $scope.charts.io.series[0].data.shift();
				}
				// }}}

				// .time {{{
				$scope.time.t24h = moment().format('HH:mm');
				// }}}
			});
		});
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
			pointStart: 1,
		}],
	}, $scope.charts.template);

	$scope.charts.ram = _.defaultsDeep({
		yAxis: {
			min: 0,
		},
		series: [{
			data: [],
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
			pointStart: 1,
		}],
	}, $scope.charts.template);

	$scope.charts.io = _.defaultsDeep({
		yAxis: {
			min: 0,
		},
		series: [{
			data: [],
			pointStart: 1,
		}],
	}, $scope.charts.template);
	// }}}
});
