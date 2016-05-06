'use strict';

//Setting up route
angular.module('pages').config(['$stateProvider',
	function($stateProvider) {
		// Pages state routing
		$stateProvider.
		state('listPages', {
			title: 'Pages',
			url: '/pages',
			templateUrl: 'modules/pages/views/list-pages.client.view.html',
               controller: 'PagesController',
               controllerAs: 'pages'
		}).
		state('createPage', {
			title: 'New page',
			url: '/pages/create',
               templateUrl: 'modules/pages/views/page.builder.html',
               controller:'PageBuilderController'
		}).
		state('viewPage', {
			title: 'View page',
			url: '/pages/:pageId',
			templateUrl: 'modules/pages/views/view-page.client.view.html'
		}).
		state('editPage', {
			title: 'Edit page',
			url: '/pages/:pageId/edit',
			templateUrl: 'modules/pages/views/page.builder.html',
               controller:'PageBuilderController'
		});
	}
]);
