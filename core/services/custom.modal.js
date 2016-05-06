(function() {
     'use strict';

     angular
          .module('core')
          .directive('customModal', customModal);

     customModal.$inject = ['$mdDialog', '$mdTheming', '$sce'];

     function customModal ($mdDialog, $mdTheming, $sce) {
         return {
             restrict: 'E',
             template: '<div id="{{name}}" class="custom-modal"><div class="hidden dummy"></div></div>',
             replace: true,
             transclude: true,
             scope: {
                 title: '=',
                 text: '=',
                 bg: '=',
                 name: '=',
                 button: '=',
                 action: '&'
             },
             link: function (scope, element, attributes, controller, transclude) {
                 scope.theme = $mdTheming.defaultTheme();

                 if (!scope.text) {
                     transclude(scope, function (content) {
                         var html = $('<div>').append(content).html();
                         scope.html = $sce.trustAsHtml(html);
                     });
                 }

                 scope.show = false;

                 scope.hideDialog = function () {
                     if (!scope.show) return;
                     scope.show = false;
                     $mdDialog.hide();
                 };

                 scope.showDialog = function () {
                     if (scope.show) return;
                     scope.show = true;
                     $mdDialog.show({
                         scope: scope.$new(),
                         templateUrl: 'modules/core/services/custom.modal.html',
                         parent: angular.element(document.body),
                         focusOnOpen: false
                     }).finally(scope.hideDialog);
                 };
             }
         };
     }
})();
