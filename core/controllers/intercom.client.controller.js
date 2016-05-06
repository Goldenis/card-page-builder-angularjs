'use strict';

angular.module('core').controller('IntercomController', ['$scope', 'Authentication', 
	function($scope, Authentication) {
		$scope.user = Authentication.user;
    window.intercomSettings = {
      // TODO: The current logged in user's full name
      name: $scope.user.displayName,
      // TODO: The current logged in user's email address.
      email: $scope.user.email,
      // TODO: The current logged in user's sign-up date as a Unix timestamp.
      created_at: $scope.user.created,
      app_id: "ty23p0gr"
    };
	}
]);
