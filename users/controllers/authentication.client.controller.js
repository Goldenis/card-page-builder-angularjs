'use strict';

angular.module('users').controller('AuthenticationController', ['$scope', '$http', '$location', 'Authentication', '$state','remember',
	function($scope, $http, $location, Authentication, $state, remember) {
		$scope.authentication = Authentication;
          $scope.credentials = {};

          $scope.credentials.remember = false;
          if (remember('username') && remember('password') ) {
               $scope.credentials.remember = true;
               $scope.credentials.username = remember('username');
               $scope.credentials.password = remember('password');
          } else {
               $scope.credentials.username = '';
               $scope.credentials.password = '';
          }
          $scope.rememberMe = function() {
               if ($scope.credentials.remember == false) {
                    remember('username', '');
                    remember('password', '');
                    $scope.credentials.username = '';
                    $scope.credentials.password = '';
               }
          };

		$scope.signin = function() {
			$http.post('/auth/signin', $scope.credentials).success(function(response) {
				$scope.authentication.user = response;
                    if($scope.credentials.remember == true) {
                         remember('username', {value: $scope.credentials.username, expires: 60 * 60 * 24 * 14});
                         remember('password', {value: $scope.credentials.password, expires: 60 * 60 * 24 * 14});
                    }
				// And redirect to the my Cards page
                    if (response.role === 'developer') {
                         $state.go('myCards');
                    }
                    if (response.role === 'client') {
                         $state.go('listPages');
                    }
                    if (response.role === 'admin') {
                         $state.go('myCards');
                    }
                    if (response.role === 'team') {
                         $state.go('myCards');
                    }
			}).error(function(response) {
				$scope.error = response.message;
                    $scope.credentials.username = '';
                    $scope.credentials.password = '';
                    $scope.credentials.remember = false;
                    remember('username', '');
                    remember('password', '');
			});
		};
	}
]);
