(function () {
     "use strict";

     angular
          .module('users')
          .controller('AccountDetailsController', AccountDetailsController);

     AccountDetailsController.$inject = ['Users', '$stateParams', '$q', 'assign', '$state', 'Cards', 'Clients', 'appConfig', 'clientHelper', 'logger'];

     function AccountDetailsController(Users, $stateParams, $q, assign, $state, Cards, Clients, appConfig, clientHelper, logger) {
          var vm = this;
          var userId = $stateParams.accountId;
          vm.user = Users.get({userId: userId});
          vm.allUserCards = Users.getMyCards({userId: userId});
          vm.clients = Clients.query();
          var promises = [vm.user.$promise, vm.clients.$promise, vm.allUserCards.$promise];
          $q.all(promises).then(function () {
               initializeController();
          });

          function initializeController() {
               vm.tempUser = Object.create(vm.user);
               vm.user.clients = _.chain(vm.user.clients).union([vm.user.client]).compact().map(function(clientName) {
                    return vm.clients[vm.clients.indexOf(clientHelper.getClientByName(vm.clients, clientName))];
               }).value();
               vm.allRoles = appConfig.allRoles;
               vm.allPermissions = appConfig.allPermissions;

               vm.assignPermissions = function () {
                    assign.permissions(new Array(vm.tempUser), vm.tempUser, vm.tempUser.role)
               };

               vm.updateAccount = function () {
                    if (vm.user.client) vm.tempUser.client = null;
                    vm.tempUser.clients ? vm.tempUser.clients = _.pluck(vm.tempUser.clients, 'companyName') : vm.tempUser.clients = [];

                    Users.changeUserData({userId:userId}, vm.tempUser)
                         .$promise
                         .then(function (user) {
                              logger.success(user.firstName + ' \'s account successfully updated');
                              $state.go('admin');
                         })
                         .catch(function () {
                              logger.error('Error updating account');
                         });
               };

               vm.removeClaim = function (card) {
                    var index = vm.allUserCards.indexOf(card);
                    Cards.removeClaim({cardId:card._id}, {card: card, user:vm.user})
                         .$promise
                         .then(function () {
                              vm.allUserCards.splice(index, 1);
                              logger.success('Card successfully removed');
                         })
                         .catch(function () {
                              logger.error('Error while removing card');
                         })
               }
          }
     }
}());
