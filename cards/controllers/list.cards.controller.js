(function () {
     "use strict";

     angular
          .module('cards')
          .controller('CardsListController', CardsListController);

     CardsListController.$inject = ['$scope', 'Authentication', 'Users', 'assign', 'appConfig', 'Cards', 'logger', 'cardsHelper', '$q', '$state', 'Orders', '$timeout', '$cookieStore', 'Clients'];

     function CardsListController($scope, Authentication, Users, assign, appConfig, Cards, logger, cardsHelper, $q, $state, Orders, $timeout, $cookieStore, Clients) {
          var vm = this;

          /*******      Variables           ***********/

          vm.clients = '';
          vm.authentication = Authentication;
          vm.me = Authentication.user;
          vm.cards = '';
          vm.allOrders = Orders.query();
          vm.allUsers = '';
          vm.selected = {};
          vm.selectedClients = [];
          vm.enabledJSEditor = false;
          vm.searchFilter = {
               name : '',
               clients: [],
               orders: [],
               users: []
          };

          vm.loadingDone = false;
          vm.loadingProgress = 0;

          vm.canClaimCards = vm.me.role === 'developer' || vm.me.role === 'team'; // || _.contains(vm.me.permissions, 'ClaimCards');
          vm.canEditCards = vm.me.role === 'admin' || _.contains(vm.me.permissions, 'EditAnyCard');
          vm.allStatuses = appConfig.cardStatuses;

          /*******      END Variables       ***********/

          /*******      Functions           ***********/

          vm.openClaimModal = openClaimModal;
          vm.updateStatus = updateStatus;
          vm.assignCard = assignCard;
          vm.claimCard = claimCard;
          vm.duplicateCard = duplicateCard;
          vm.openDeleteModal = openDeleteModal;
          vm.deleteCard = deleteCard;
          vm.getClientURL = getClientURL;

          vm.onload = onload;

          vm.currentPage = 0;
          vm.pageSize = $cookieStore.get('cards-page-size') || 15;
          vm.pages = pages;

          $scope.$watch('vm.pageSize', function (pageSize) {
               $cookieStore.put('cards-page-size', pageSize);
          });

          $scope.$watch('vm.searchFilter', function (after, before) {
              vm.currentPage = 0;
              if (after.clients.length != before.clients.length) {
                $cookieStore.put('card-clients', createClientsIdArray(after.clients));
              }
          }, true);

          /*******      END Functions       ***********/

          function createClientsIdArray(clients) {
            var ids = [];
            if (!Array.isArray(clients)) return [];
            clients.forEach(function(client) {
              ids.push(client._id);
            });
            return ids;

          }

          function duplicateCard(oriCard) {
               Cards.get({ cardId: oriCard._id }).$promise.then(function (card) {
                    delete card._id;
                    delete card.user;
                    card.name = "COPY - " + card.name;
                    card.timelog = [];
                    card.$save(function (response) {
                         logger.success(oriCard.name + " has been duplicated successfully.");
                         $state.reload();
                    }, function (errorResponse) {
                         console.log(errorResponse.data.message);
                         logger.error(errorResponse.data.message);
                    });
               });
          }

          function openDeleteModal(card) {
               vm.selectedCard = card;
               $('#deleteCardModal').modal2('show');
          }

          function deleteCard(card) {
               var index = vm.cards.indexOf(card);
               card.$remove({cardId:card._id});
               vm.cards.splice(index, 1);
               $('#deleteCardModal').modal2('hide');
               logger.success('Card deleted');
          }

          function findCardByIds(client_ids) {
            var clients = [];
            var clients_name = [];
            client_ids.forEach(function(cid, idx, array) {
              Clients.get({ clientId: cid }).$promise.then(function (client) {                
                clients.push(client);
                clients_name.push(client.companyName);
                vm.selectedClients.push(client.companyName);
                if (idx === array.length - 1){ 
                  vm.searchFilter.clients = clients;
                  vm.selectedClients = clients_name;
                }
              });
            });
          }

          function onload() {
               var clients, cards, users;
               vm.loadingProgress = 10;
               //vm.searchFilter.clients = $cookieStore.get('card-clients') || [];
               findCardByIds($cookieStore.get('card-clients') || []);
// console.log(vm.searchFilter.clients);
               var promises = [];
               promises.push(clients = cardsHelper.getClients());
               promises.push(cards = cardsHelper.getCards({ exclude: ['html', 'css', 'less', 'js', 'timelog', 'variables'] }));
               promises.push(users = Users.getAllUsers().$promise);
               $q.all(promises).then(function(data) {
                    vm.loadingProgress = 70;
                    $timeout(function () {
                        vm.clients = data[0];
                        //vm.clients = _.sortBy(data[0], 'companyName');
                        if (vm.me.role === 'client') {
                             var filtered = cardsHelper.clientCardFilter(data[1], vm.me);
                             vm.ready = filtered.ready;
                             vm.edits = filtered.edits;
                        } else {
                             vm.cards = data[1];
                             _.each(vm.cards, function(c, i) { c._num = i; });
                        }
                        vm.allUsers = assign.excludeByRole(data[2],'client');
                        vm.loadingProgress = 100;
                        $timeout(function () {
                            vm.loadingDone = true;
                        });
                    }, 100);
               });

               clients.then(function () { vm.loadingProgress += 10; });
               cards.then(function () { vm.loadingProgress += 25; });
               users.then(function () { vm.loadingProgress += 15; });
          }

          function claimCard () {
               $('#claimModal').modal2('hide');
               console.log(vm.selectedCard);
               console.log(vm.selected.user);
               
               Cards.claim({cardId:vm.selectedCard._id}, {card: vm.selectedCard, user:vm.selected.user})
                    .$promise
                    .then(function (data) {
                         vm.selectedCard.claimedBy[0] = Authentication.user;
                         logger.success('Card successfully claimed');
                    })
                    .catch(function () {
                         logger.error('Error claiming card');
                    })
          };

          function openClaimModal(card) {
               $('#claimModal').modal2('show');
               if (!vm.selected.user) {
                    vm.selected.user = Authentication.user;
               }
               vm.selectedCard = card;
          };

          function assignCard(card, user) {
               Cards.claim({cardId:card._id}, {card: card, user: user})
                    .$promise
                    .then(function (data) {
                         card.claimedBy[0] = user;
                         logger.success('Card assigned to : ' + user.firstName + ' ' + user.lastName);
                    })
                    .catch(function () {
                         logger.error('Error assigning card');
                    })
          };

          function updateStatus(card, status) {
               card.cardStatus = status || card.cardStatus;               
               Cards.update({cardId:card._id, trigger:'updateStatus'}, card)
                    .$promise
                    .then(function (updatedCard) {
                         logger.info('Status set to: ' + updatedCard.cardStatus);
                    })
                    .catch(function (err) {
                         console.log(err);
                         logger.info('Error updating card status');
                    })
          };

          function pages(cards) {
               var pagesCount = Math.ceil(cards.length / vm.pageSize);
               return _.range(pagesCount);
          };

          function getClientURL(client) {
            return client.toLowerCase().split(' ').join('_'); 
          };
      }

}());
