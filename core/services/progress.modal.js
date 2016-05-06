(function() {
     'use strict';

     angular
          .module('core')
          .directive('progressModal', progressModal);

    progressModal.$inject = ['$mdDialog', '$mdTheming', '$q', '$timeout', 'logger'];

     function progressModal ($mdDialog, $mdTheming, $q, $timeout, logger) {
         return {
             restrict: 'E',
             template: '<div id="{{name}}" class="custom-modal"><div class="hidden dummy"></div></div>',
             replace: true,
             scope: {
                 title: '=',
                 name: '=',
                 track: '='
             },
             link: function (scope, element, attributes, controller) {
                 scope.theme = $mdTheming.defaultTheme();

                 var show = false;

                 scope.hideDialog = function () {
                     if (!show) return;
                     show = false;
                     $mdDialog.hide();
                 };

                 scope.showDialog = function () {
                     if (show) return;
                     show = true;
                     $mdDialog.show({
                         scope: scope.$new(),
                         templateUrl: 'modules/core/services/progress.modal.html',
                         parent: angular.element(document.body),
                         focusOnOpen: false
                     }).finally(scope.hideDialog);
                 };

                 scope.$watch('track', function (track) {
                     if (!track) return;

                     scope.steps = [];
                     scope.showDialog();
                     scope.pending = true;

                     $q.when(track)
                         .then(trackFinished, trackError, trackProgress)
                         .finally(scope.hideDialog);
                 });

                 function trackFinished() {
                     scope.progress = 100;
                     scope.pending = false;
                     scope.track = null;
                 }

                 function trackError(error) {
                     scope.track = null;
                     scope.pending = false;
                     logger.error(error);
                 }

                 function trackProgress(data) {
                     if (!data) return;
                     scope.progress = data.progress;

                     if (data.status && !_.contains(scope.steps, data.status)) {
                         scope.steps.push(data.status);
                     }

                     if (scope.track && scope.progress == 100) {
                         trackFinished();
                     }
                 }
             }
         };
     }
})();
