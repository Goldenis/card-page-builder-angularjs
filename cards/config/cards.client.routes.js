'use strict';

//Setting up route
angular.module('cards')
	.config(['$stateProvider', 'IdleProvider',
	function($stateProvider,IdleProvider) {
		
        getClients.$inject = ['Clients', '$q'];
          function getClients(Clients, $q) {
          	var deferred = $q.defer();
          	Clients.query().$promise.then(function (clients) {
                deferred.resolve(clients);
            });
          	return deferred.promise;
        };

        getCurrentUser.$inject = ['Authentication', '$q'];
        function getCurrentUser(Authentication, $q) {
            var deferred = $q.defer();
            deferred.resolve(Authentication.user);
            return deferred.promise;
        };

        getCards.$inject = ['Cards', 'Authentication', '$q'];
      	function getCards(Cards, Authentication, $q) {
	      	var deferred = $q.defer();
	      	var me = Authentication.user;
      		if(me.role === 'admin' || me.role === 'client' || _.contains(me.permissions,'ViewAllCards')) {
                Cards.query().$promise.then(function (cards) {
                    deferred.resolve(cards);
                }).catch(function (err) {
                	console.log(err);
                    deferred.reject('Error while fetching cards');
                });
            }
          	return deferred.promise;
        };

        getCard.$inject = ['Cards'];
        function getCard(Cards) {
        	return Cards.get({cardId: $stateParams.cardId});
        }

		// Cards state routing
		$stateProvider.
		state('listCards', {
			title: 'Cards',
			url: '/cards',
			templateUrl: 'modules/cards/views/list-cards.client.view.html',
			controller:'CardsListController',
			controllerAs: 'vm'
		}).
		state('createCard', {
			title: 'Create a Card',
			url: '/cards/create',
			templateUrl: 'modules/cards/views/create-card.client.view.html',
			controller:'CardsCreateController',
			controllerAs: 'vm'
		}).
		state('viewCard', {
			url: '/cards/:cardId',
			templateUrl: 'modules/cards/views/view-card.client.view.html',
			controller:'CardsViewController',
			//controllerAs: 'vm',
			resolve: {
				getClients: getClients
			}
		}).
        state('myCards', {
        	title: 'My Cards',
			url: '/myCards',
			templateUrl: 'modules/cards/views/view-myCards.client.view.html',
               controller:'MyCardsController',
               controllerAs:'myCard',
               resolve:{
                    currentUser: getCurrentUser
               },
               authenticate: true
		}).
		state('previewCard', {
			title: 'Preview Card',
			url: '/cards/:cardId/preview',
			templateUrl: 'modules/cards/views/preview-card.client.view.html',
			controller:'CardsViewController',
			//controllerAs: 'vm',
			resolve: {
				getClients: getClients
			}
		}).
		state('editCard', {
			title: 'Edit Card',
			cardId: ':cardId',
			url: '/cards/:cardId/edit',
			templateUrl: 'modules/cards/views/edit-card.client.view.html',
			controller:'CardsEditController',
			resolve: {
				getClients: getClients,
				setIdleTimeout: function () {
					IdleProvider.idle(5*60); // in seconds
					IdleProvider.timeout(60);
				}
			}
		});

          
	}
]);
