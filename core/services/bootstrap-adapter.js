(function ($) {
    'use strict';

    $(function () {
        $.fn.modal2 = function (opts) {
            var child = this.children()[0];
            var scope = angular.element(child).scope();
            if (!scope) return;

            safeApply(function () {
                if (resolveShow(opts)) scope.showDialog();
                else scope.hideDialog();
            });
        };

        function safeApply(scope, fn) {
            if (scope.$$phase) fn();
            else scope.apply(fn);
        }

        function resolveShow(show) {
            return show == 'show' ? true : (show == 'hide' ? false : null);
        }
    });
}(jQuery));
