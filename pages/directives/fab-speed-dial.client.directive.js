(function () {
    "use strict";

    angular
        .module('pages')
        .config(function ($provide) {
            $provide.decorator('mdFabSpeedDialDirective', ['$delegate', mdFabSpeedDialDecorator]);
        });

    function mdFabSpeedDialDecorator($delegate) {
        var directive = $delegate[0];

        var link = directive.link;

        directive.compile = function () {
            return function (scope, element, attrs, ctrl) {
                element.unbind('mouseenter', ctrl.open);
                element.unbind('mouseleave', ctrl.close);

                element.bind('mouseenter', async(ctrl.open));
                element.bind('mouseleave', async(ctrl.close));

                return link.apply(this, arguments);
            };
        };

        return $delegate;

        function async(callback) {
            return function () {
                var self = this,
                    args = _.toArray(arguments);
                setTimeout(function () {
                    callback.apply(self, args);
                }, 0);
            };
        }
    }
}());
