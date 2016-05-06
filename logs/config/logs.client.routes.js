'use strict';

//Setting up route
angular.module('logs').config(['$stateProvider',
    function ($stateProvider) {
        // Logs state routing
        $stateProvider.
            state('listLogs', {
                title: 'Log',
                url: '/log',
                templateUrl: 'modules/logs/views/logs.client.view.html',
                controller: 'LogsController',
                controllerAs: 'log'
            });
    }
]);
