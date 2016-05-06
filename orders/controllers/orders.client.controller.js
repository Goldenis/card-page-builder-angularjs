(function () {
     "use strict";

     angular
          .module('orders')
          .controller('OrderController', OrderController);

     OrderController.$inject = ['$scope', 'Authentication', 'Clients', 'Orders', 'logger'];

     function OrderController($scope, Authentication, Clients, Orders, logger) {
          var vm = this;
          vm.newOrder = {};
          vm.me = Authentication.user;
          vm.clients = Clients.query();
          vm.orders = Orders.query();
          vm.saveNewOrder = saveNewOrder;
          vm.updateStatus = updateStatus;
          vm.deleteOrder = deleteOrder;
          vm.openDeleteModal = openDeleteModal;

          function openDeleteModal(order) {
               $('#deleteModal').modal2('show');
               vm.selectedOrder = order;
          }

          function saveNewOrder(newOrder) {
               var order = new Orders(newOrder);
               order.$save(function (order) {
                    vm.orders.push(order);
                    $('#newOrder').modal('hide');
                    logger.success('Added ' + order.name + ' order.');
               }, function () {
                    logger.error('Error while adding order');
               })
          }

          function updateStatus(order) {
               Orders.update({orderId:order._id}, order).$promise.then(function (data) {
                    logger.info('Order status set to ' + data.status);
               }).catch(function () {
                    logger.error('Error while changing status');
               })
          }

          function deleteOrder() {
               var id = vm.selectedOrder._id;
               var index = vm.orders.indexOf(vm.selectedOrder);
               vm.selectedOrder.$remove({orderId:id});
               $('#deleteModal').modal2('hide');
               vm.orders.splice(index, 1);
               logger.success('Order deleted')
          }

          $scope.datePickers = {
               orderDate:     false,
               dueDate:       false
          };
          $scope.format = 'MM/dd/yyyy';
          $scope.clear = function () {
               $scope.dt = null;
          };

          $scope.open = function($event, number) {
               $event.preventDefault();
               $event.stopPropagation();
               angular.forEach($scope.datePickers, function (value, index) {
                    $scope.datePickers[index]= index == number;
               })
          };
     }

}());
