'use strict';

// Setting up route
angular.module('core')
.config(['$stateProvider', '$urlRouterProvider',
	function($stateProvider, $urlRouterProvider) {
		// Redirect to home view when route not found
		$urlRouterProvider.otherwise('/');

		// Home state routing
		$stateProvider.
		state('home', {
			public: true,
			url: '/',
			templateUrl: 'modules/core/views/home.client.view.html',
			resolve: {
				auth: function(Authentication){
					
				}
			}		
		}).
        state('faq', {
			public: true,
            url: '/faq',
            templateUrl: 'modules/core/views/faq.client.view.html'
        }).
        state('matchstic-faq', {
            url: '/matchstic-faq',
            templateUrl: 'modules/core/views/matchstic-faq.client.view.html'
        }).
        state('oncue-faq', {
            url: '/oncue-faq',
            templateUrl: 'modules/core/views/oncue-faq.client.view.html'
        });

	}
])
.run(run);

run.$inject = ['$rootScope', '$state', '$location', 'Authentication', 'Authorization'];
function run($rootScope, $state, $location, Authentication, Authorization) {
	$rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState) {
		if (toState.public) return;
		if (toState.name === 'home') {
			if (Authentication.user) {
				$state.go('listPages');
			    event.preventDefault();
			    return;
			}
		} else if (!Authentication.user) {
			$state.go('home');
			event.preventDefault();
			return;
		}
        else if (!Authorization.isAuthorized(toState)) {
            event.preventDefault();
            $state.go('home');
            return;
        }
	});
};
