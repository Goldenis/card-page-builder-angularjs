(function () {
     "use strict";

     angular
          .module('users')
          .controller('AdminController', AdminController);

     AdminController.$inject = ['Users', 'appConfig', '$http', 'assign', 'Authentication', 'logger'];

     function AdminController(Users, appConfig, $http, assign, Authentication, logger) {
          var vm = this;
          vm.authentication = Authentication;
          vm.allPermissions = appConfig.allPermissions;
          vm.allRoles = appConfig.allRoles;
          vm.newUser = {};
          vm.errors = {};
          vm.users = vm.users || [];
          vm.changePermissions = changePermissions;
          vm.deleteUser = deleteUser;
          vm.saveNewUser = saveNewUser;
          vm.changePassword = changePassword;

          vm.assignPermissions = function (user, role) {
               assign.permissions(vm.users, user, role);
          };

          Users.getAllUsers().$promise.then(function (users) {
               vm.users = users;
          }).catch(function (err) {
               vm.errors = { permissions : err.data.message };
          });

          function changePermissions(user, role) {
               var index = vm.users.indexOf(user);
               Users.changePermissions({userId: user._id}, {permissions: user.permissions, role: role})
                    .$promise
                    .then(function () {
                         vm.users[index].changed = false;
                         logger.success(user.firstName + ' ' + user.lastName + ' permissions updated');

               })
                    .catch(function (err) {
                         vm.errors = { permissions : err.data.message };
                         logger.error('Error updating permissions');
               })
          }

          function deleteUser() {
               Users.delete({userId: vm.selectedUser._id})
                    .$promise
                    .then(function () {
                         var index = vm.users.indexOf(vm.selectedUser);
                         vm.users.splice(index, 1);
                         $('#deleteModal').modal2('hide');
                         logger.success(vm.selectedUser.firstName + ' ' + vm.selectedUser.lastName + ' deleted');
                    })
                    .catch(function (err) {
                         vm.errors = { permissions : err.data.message };
                         logger.error('Error deleting '+ vm.selectedUser.firstName + ' ' + vm.selectedUser.lastName);
                    })
          }

          function saveNewUser(newUser, form) {
               vm.users.push(newUser);
               assign.permissions(vm.users, newUser, newUser.role);
               $('#newUserModal').modal('hide');
               $http.post('/auth/signup', newUser).success(function(response) {
                    vm.users[vm.users.length - 1] = response;
                    vm.newUser = {};
                    logger.success(newUser.firstName + ' ' + newUser.lastName + ' added');
               }).error(function(err) {
                    vm.users.pop();
                    vm.errors = { permissions : err.message };
                    logger.error('Error adding '+ newUser.firstName + ' ' + newUser.lastName);
               });
          }

          function changePassword(newPassword) {
               Users.changeUserPassword({userId: vm.selectedUser._id}, {newPassword : newPassword})
                    .$promise
                    .then(function () {
                         $('#passwordModal').modal('hide');
                         logger.success('Password successfully changed');
                    })
                    .catch(function (err) {
                         vm.errors = { permissions : err.data.message };
                         logger.error('Error changing password');
                    })
          }

          vm.openPasswordModal = function (user) {
               $('#passwordModal').modal('show');
               $('#name').text(user.firstName+' '+user.lastName);
               vm.selectedUser = user;
          };
          vm.openDeleteModal = function (user) {
               $('#deleteModal').modal2('show');
               vm.selectedUser = user;
          };
          vm.openNewUserModal = function () {
               $('#newUserModal').modal('show');
          };
     }
}());
