(function () {
     "use strict";

     angular
          .module('pages')
          .directive('mediumEditorModel', mediumEditorModel);

     mediumEditorModel.$inject = ['$timeout', '$compile', '$rootScope'];

     function mediumEditorModel($timeout, $compile, $rootScope) {

          return {
               require: 'ngModel',
               restrict: 'AE',
               link: function (scope, iElement, iAttrs, ctrl) {

                    var onChange = function () {
                         //console.log('ulazin u set view value zbog emita');
                         $timeout(function () {
                              ctrl.$setViewValue(iElement.html());
                              //console.log('ctrl', ctrl);
                              //console.log(' na ovo cu postavit iElement.html()', iElement.html());
                         });
                    };

                    iElement.bind('focus',false,false);
                    iElement.bind('DOMSubtreeModified',onChange);
                    $rootScope.$on('updateCardHtml',onChange);

               }
          }
     }
}());

