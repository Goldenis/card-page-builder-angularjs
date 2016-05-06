(function () {
     "use strict";

     angular
          .module('cards')
          .controller('MyCardsController', MyCardsController);

     MyCardsController.$inject = ['Users', 'currentUser', 'Cards', 'logger', 'cardsHelper', '$q', 'appConfig', 'Orders'];

     function MyCardsController(Users, currentUser, Cards, logger, cardsHelper, $q, appConfig, Orders) {
          var vm = this;
          vm.clients = [];
          vm.user = currentUser;
          vm.allOrders = Orders.query();
          vm.canClaimCards = vm.user.role == 'admin' || _.contains(vm.user.permissions, 'ClaimCards');
          vm.canViewMyCards = vm.user.role == 'admin' || _.contains(vm.user.permissions, 'ViewMyCards');
          vm.canEditMyCards = vm.user.role == 'admin' || _.contains(vm.user.permissions, 'EditMyCards');
          vm.allStatuses = appConfig.cardStatuses;
          vm.searchFilter = {
               name : '',
               clients: [],
               orders: [],
               status: []
          };
          if(vm.canViewMyCards) {
               Users.getMyCards({userId: vm.user._id})
                    .$promise
                    .then(function (cards) {
                         vm.allUserCards = cards;
                    })
                    .catch(function (err) {
                         logger.error('Error fetching cards', err);
                    });
          }

          vm.init = function() {
               var promises = [];
               promises.push(cardsHelper.getClients());
               $q.all(promises).then(function(data) {
                    vm.clients = data[0];
               });
          }

          vm.removeClaim = function (card) {
               var index = vm.allUserCards.indexOf(card);
               Cards.removeClaim({cardId:card._id}, {card: card, user:vm.user})
                    .$promise
                    .then(function () {
                         vm.allUserCards.splice(index, 1);
                         logger.success('Card successfully removed from your list');
                    })
                    .catch(function (err) {
                         logger.error('Error while trying remove card', err);
                    })
          }
     }

}());
