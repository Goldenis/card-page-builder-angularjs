(function () {
    "use strict";

    angular
        .module('logs')
        .factory('Logs', Logs);

    Logs.$inject = ['$resource'];

    function Logs($resource) {
        return $resource('logs');
    }
}());
