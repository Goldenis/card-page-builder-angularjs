(function () {
    "use strict";

    angular
        .module('logs')
        .controller('LogsController', LogsController);

    LogsController.$Inject = ['$scope', 'Logs'];

    function LogsController($scope, Logs) {
        var vm = this;

        vm.entries = Logs.query();
        vm.loading = true;

        vm.refresh = refresh;

        init();

        function init() {
            loading(vm.entries);
        }

        function loading(resource) {
            vm.loading = true;
            return resource.$promise.finally(function () {
                vm.loading = false;
            });
        }

        function refresh() {
            loading(Logs.query()).then(function (entries) {
                vm.entries = entries;
            });
        }
    }
}());
