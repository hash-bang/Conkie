var app = angular.module('app', []);

app.controller('conkerController', function($scope) {
	$scope.battery = {
		power: 100,
	};
});
