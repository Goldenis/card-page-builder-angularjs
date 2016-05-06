'use strict';

//Cards service used to communicate Cards REST endpoints
angular.module('cards')

	.factory('Cards', ['$resource',
	function($resource) {
		return $resource('cards/:cardId/:controller', { cardId: '@_id', clientId: '@clientId'
		}, {
			update: {
				method: 'PUT'
			},
               claim:{
                    method: 'PUT',
                    params: {
                         controller: 'claim'
                    }
               },
               removeClaim:{
                    method: 'PUT',
                    params: {
                         controller: 'removeClaim'
                    }
               }
		});
	}
	])

//Clients service used to communicate Clients REST endpoints
	.factory('Clients', ['$resource',
	function($resource) {
		return $resource('clients/:clientId', { clientId: '@_id'
		}, {
			update: {
				method: 'PUT'
			}
		});
	}
	]);
