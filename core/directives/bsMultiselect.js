(function () {
    "use strict";

    // adapter to bootstrap-multiselect 3rd party library

    angular
        .module('core')
        .directive('bsMultiselect', ['$timeout', function ($timeout) {
            var render = function (element, options) {
                $timeout(function () {
                    var inheritClass = options.inheritClass;
                    delete options.inheritClass;

                    $(element).multiselect(options);

                    if (inheritClass) {
                        var cl = $(element).attr('class');
                        $(element).next('.bootstrap-multiselect').addClass(cl);
                    }
                });
            };

            return function(scope, element, attrs) {
                var defaultOptions = {
                    inheritClass: true,
                    buttonContainer: '<div class="bootstrap-multiselect" />'
                };

                var options = angular.extend({}, defaultOptions);
                scope.$watch(attrs.bsMultiselect, function (newOptions) {
                    options = angular.extend({}, defaultOptions, newOptions);
                    $(element).multiselect('destroy');
                    render(element, options);
                }, true);

                render(element, options);

                scope.$on('$destroy', function () {
                    $(element).multiselect('destroy');
                });
            };
        }]);
}());
