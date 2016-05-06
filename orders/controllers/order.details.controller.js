(function () {
     "use strict";

     angular
          .module('orders')
          .controller('OrderDetailsController', OrderDetailsController);

     OrderDetailsController.$inject = ['Orders', '$stateParams', '$scope', 'logger', 'Clients', '$q', 'clientHelper'];

     function OrderDetailsController(Orders, $stateParams, $scope, logger, Clients, $q, clientHelper) {
          var vm = this;
          var orderId = $stateParams.orderId;
          vm.order = Orders.get({orderId:orderId});
          vm.clients = Clients.query();
          var promises = [vm.order.$promise, vm.clients.$promise];
          $q.all(promises).then(function () {
               initializeController();
          });

          function initializeController() {
               vm.tempOrder = Object.create(vm.order);
               vm.tempOrder.client = vm.clients[clientHelper.getIndex(vm.clients, vm.order.client)];
               vm.updateOrder = updateOrder;

               function updateOrder(order, form) {
                    vm.submitted = true;
                    if(form.$valid){
                         Orders.update({orderId:order._id}, order).$promise.then(function (updatedOrder) {
                              vm.order = updatedOrder;
                              logger.success('Order successfully updated');
                         }).catch(function () {
                              logger.error('Error updating order');
                         })
                    } else {
                         logger.warning('Form not valid');
                         return false;
                    }
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
     }

}());

