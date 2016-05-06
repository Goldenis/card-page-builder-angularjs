"use strict";

angular
    .module('core')
    .directive('ngIncludeNoscope', function () {
        return {
            restrict: 'AE',
            templateUrl: function (elem, attrs) {
                return elem.scope().$eval(attrs.ngIncludeNoscope);
            }
        };
    });
