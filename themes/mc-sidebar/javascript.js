var app = angular.module('app', []);

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
				$scope.battery.chargingTime = battery.chargingTime;
				$scope.battery.dischargingTime = battery.dischargingTime;
				$scope.battery.levelPercent = Math.ceil(battery.level * 100);
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
});
