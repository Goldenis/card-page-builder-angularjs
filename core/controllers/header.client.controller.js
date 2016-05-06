'use strict';

angular.module('core').controller('HeaderController', ['$scope', 'Authentication', 'Menus', '$http', '$window', 'remember',
	function($scope, Authentication, Menus, $http, $window, remember) {
		$scope.authentication = Authentication;
        $scope.ui = {};
		
		$scope.isCollapsed = false;
		$scope.menu = Menus.getMenu('topbar');

		$scope.toggleCollapsibleMenu = function() {
			$scope.isCollapsed = !$scope.isCollapsed;
		};

          $scope.signOut= function () {
               $http.get('/auth/signout')
                    .success(function () {
                         //remember('username', '');
                         //remember('password', ''); TODO define remember me flow
                         $window.location.href = '/';
               })
                    .error(function (err) {
                         console.log('error', err);
               })
          };

        $scope.$watch('ui.toolbarOpened', function (opened) {
            if (!opened && !$scope.$parent.flexHeader) {
                $scope.ui.toolbarOpened = true;
            }
        });

		// Collapsing the menu after navigation
		$scope.$on('$stateChangeSuccess', function() {
			$scope.isCollapsed = false;
		});
	}
]);
