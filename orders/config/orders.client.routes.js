(function () {
     "use strict";

     //Setting up route
     angular
          .module('orders')
          .config(config);

           config.$inject = ['$stateProvider'];

          function config($stateProvider) {
               // Clients state routing
               $stateProvider.
                    state('orders', {
                         title: "Orders",
                         url: '/orders',
                         templateUrl: 'modules/orders/views/orders.client.view.html',
                         controller: 'OrderController',
                         controllerAs: 'order',
                         authenticate: true,
                         authorize: '!team'
                    })
                    .state('orderDetails', {
                         title: "Order Details",
                         url: '/orderDetails/:orderId',
                         templateUrl: 'modules/orders/views/orders.details.client.view.html',
                         controller: 'OrderDetailsController',
                         controllerAs: 'orderD',
                         authenticate: true,
                         authorize: '!team'
                    })
                    .state('addCards', {
                         title: "Add Cards",
                         url: '/order/:orderId/addCards',
                         templateUrl: 'modules/orders/views/add.cards.client.view.html',
                         //templateUrl: 'fw/admin-add-cards.html',
                         controller: 'AddCardsController',
                         controllerAs: 'addCards',
                         authenticate: true,
                         authorize: '!team'
                    });
          }

}());
