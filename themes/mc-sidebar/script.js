var app = angular.module('app', [
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

				if (isFinite(battery.chargingTime)) {
					var duration = moment.duration(battery.chargingTime, 'seconds');
					$scope.battery.chargingTime =
						duration.hours() + 'h ' +
						duration.minutes() + 'm ' +
						duration.seconds() + 's';
				} else {
					$scope.battery.chargingTime = null;
				}

				if (isFinite(battery.dischargingTime)) {
					duration = moment.duration(battery.dischargingTime, 'seconds');
					$scope.battery.dischargingTime =
						duration.hours() + 'h ' +
						duration.minutes() + 'm ' +
						duration.seconds() + 's';
				} else {
					$scope.battery.dischargingTime = null;
				}
			});
		};

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
			});
		});
	// }}}
});
