(function () {
     "use strict";

     angular
          .module('pages')
          .directive('dynamicCssBinding', function ($compile) {
          return {
               restrict: 'A',
               link: function postLink(scope, element) {
                    if (element.html()) {
                         var template = $compile('<style ng-bind-template="' + element.html() + '"></style>');
                         element.replaceWith(template(scope));
                    }
               }
          };
     });

}());
