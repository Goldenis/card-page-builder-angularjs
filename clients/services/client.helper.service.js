(function () {
     'use strict';

     angular
          .module('clients')
          .factory('clientHelper', clientHelper);

     clientHelper.$inject = ['$location', 'logger', '$q'];

     function clientHelper($location, logger, $q) {
          var service = {
               getClientByName: getClientByName,
               getIndex: getIndex,
               addClietVariesToLess: addClietVariesToLess,
               editClientUpdate: editClientUpdate
          };
          return service;

          function getClientByName(clients, name) {
               for (var i = 0; i < clients.length; i += 1) {
                    if(clients[i].companyName==name){
                         return clients[i];
                    }
               }
               return false;
          };

          function addClietVariesToLess(variables) {
               var less_client_variables = '';
               if (variables) {
                    for (var i = 0; i < variables.length; i += 1) {
                         if (variables[i].kind == 'File' || variables[i].kind == 'Video') {
                              less_client_variables =  less_client_variables.concat(variables[i].variable,":'", variables[i].value,"';\n");
                         } else {
                              less_client_variables =  less_client_variables.concat(variables[i].variable,":", variables[i].value,";\n");
                         }
                    }
               }
               less_client_variables = less_client_variables +'\n';
               return less_client_variables;
          };

          function getIndex(clients, client) {
               for (var i = 0; i < clients.length; i += 1) {
                    if (clients[i]._id == client._id) {
                         return i;
                    }
               }
               return -1;
          }

          function editClientUpdate(client, title, entity) {
               var _client = client;
               return _client.$update(function() {
                    if (title == 'add') {
                         logger.success('Client ' + entity + ' added successfully');
                    } else if (title == 'update') {
                         logger.success('Client ' + entity + ' updated successfully');
                    } else if (title == 'remove') {
                         logger.success('Client ' + entity + ' removed successfully');
                    } 
                    //$location.path('clients/' + _client._id + '/edit');
               }, function(errorResponse) {
                   var error = errorResponse.data.message;
                    console.log(error );
                    return $q.reject(errorResponse);
               });
          }


     }
})();
