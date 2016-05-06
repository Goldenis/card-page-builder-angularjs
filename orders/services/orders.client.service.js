(function () {
     "use strict";

     angular
          .module('orders')
          .factory('Orders', Orders);

          Orders.$Inject = ['$resource'];

          function Orders($resource) {
               return $resource('orders/:orderId', { orderId: '@orderId'
               }, {
                    update: {
                         method: 'PUT'
                    }
               });
          }

}());
