'use strict';

angular.module('logs', []).run(['Menus', '$rootScope',
    function (Menus, $rootScope) {
        $rootScope.$on('$stateChangeStart', function (event, next) {
        });

        Menus.addMenuItem('topbar', 'Log', 'log', '', '', false, ['admin'], 50);
    }]
);
