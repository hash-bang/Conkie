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
		if (!value || !isFinite(value)) return;

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

app.controller('conkerController', function($scope) {
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
		battery.onchargingchange
		= battery.onchargingtimechange
		= battery.ondischargingtimechange
		= battery.onlevelchange
		= batteryUpdate;

		batteryUpdate();
	});
	// }}}

	// .system / .ram / .net - backend state objects {{{
	// This actually just gets updated by the backend process via IPC
	$scope.system;
	$scope.ram;
	$scope.net;
	// }}}

	// Bind to IPC message bus to recieve backend updates {{{
	require('electron').ipcRenderer
		.on('updateState', function(e, data) {
			$scope.$apply(function() {
				$scope.system = data.system;
				$scope.ram = data.ram;
				$scope.net = data.net;
				$scope.dropbox = data.dropbox;

				// Chart updates {{{
				if (isFinite($scope.ram.used)) {
					$scope.charts.ram.series[0].data.push($scope.ram.used);
					if ($scope.charts.ram.series[0].data.length > options.chartHistory) $scope.charts.ram.series[0].data.shift();
				}

				if (isFinite($scope.system.cpuUsage)) {
					$scope.charts.cpu.series[0].data.push($scope.system.cpuUsage);
					if ($scope.charts.cpu.series[0].data.length > options.chartHistory) $scope.charts.cpu.series[0].data.shift();
				}
				// }}}
			});
		});
	// }}}

	$scope.charts = {};
	$scope.charts.template = {
		size: {
			width: 120,
			height: 20,
		},
		options: {
			chart: {
				borderWidth: 0,
				type: 'area',
				margin: [2, 0, 2, 0],
				backgroundColor: null,
				borderWidth: 0,
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
					animation: true,
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

	$scope.charts.ram = _.defaults({
		series: [{
			data: [],
			pointStart: 1,
		}],
	}, $scope.charts.template);

	$scope.charts.cpu = _.defaults({
		series: [{
			data: [],
			pointStart: 1,
		}],
	}, $scope.charts.template);
});
