'use strict';

//Setting up route
angular.module('clients').config(['$stateProvider',
	function($stateProvider) {
		// Clients state routing
		$stateProvider.
		state('listClients', {
			title: 'Clients',
			url: '/clients',
			templateUrl: 'modules/clients/views/list-clients.client.view.html'
		}).
		state('createClient', {
			title: 'New Client',
			url: '/clients/create',
			templateUrl: 'modules/clients/views/create-client.client.view.html'
		}).
		state('viewClient', {
			title: "View Client",
			url: '/clients/:clientId',
			templateUrl: 'modules/clients/views/view-client.client.view.html'
		}).
		state('editClient', {
			title: "Edit Client",
			url: '/clients/:clientId/edit',
			templateUrl: 'modules/clients/views/edit-client.client.view.html'
		}).
        state('siteSettings', {
            title: "Settings",
            url: '/site/settings',
            templateUrl: 'modules/clients/views/edit-client.client.view.html'
        });
	}
]);
