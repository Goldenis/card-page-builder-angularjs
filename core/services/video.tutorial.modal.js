(function() {
     'use strict';

     angular
          .module('core')
          .directive('videoTutorialModal', videoTutorialModal);

     videoTutorialModal.$inject = ['$mdDialog', '$mdTheming', '$sce', 'cardData'];

     function videoTutorialModal ($mdDialog, $mdTheming, $sce, cardData) {
         return {
             restrict: 'E',
             template: '<div id="{{name}}" class="custom-modal"><div class="hidden dummy"></div></div>',
             replace: true,
             transclude: true,
             scope: {
                 vlink: '=',
                 name: '=',
             },
             link: function (scope, element, attributes, controller, transclude) {
                console.log(scope.vlink);
                 scope.theme = $mdTheming.defaultTheme();

                 if (!scope.text) {
                     transclude(scope, function (content) {
                         var html = $('<div>').append(content).html();
                         scope.html = $sce.trustAsHtml(html);
                     });
                 }

                 scope.show = false;

                scope.$watch(function () {
                     return cardData.getActiveCard()
                }, function (newValue) {
                    console.log(newValue);
                    if (newValue != undefined && newValue.cardTutorial != undefined)  {scope.vlink = newValue.cardTutorial.url;}
                    console.log(scope.vlink);
                });

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
                         templateUrl: 'modules/core/services/video.tutorial.modal.html',
                         parent: angular.element(document.body),
                         focusOnOpen: false
                     }).finally(scope.hideDialog);
                 };
             }
         };
     }
})();
