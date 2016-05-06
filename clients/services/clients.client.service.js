'use strict';

//Clients service used to communicate Clients REST endpoints
angular.module('clients').factory('Clients', ['$resource',
	function($resource) {
		return $resource('clients/:clientId', { clientId: '@_id', name: '@companyName'
		}, {
			update: {
				method: 'PUT'
			}
		});
	}
]);
