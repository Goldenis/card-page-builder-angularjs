(function() {
     'use strict';

     angular
          .module('pages')
          .directive('cardVariableFile', cardVariableFile);

     cardVariableFile.$inject = ['cardsHelper', 'appConfig', 'cardData', 'logger', '$rootScope', '$sce', 's3Storage', '$window'];

     function cardVariableFile (cardsHelper, appConfig, cardData, logger, $rootScope, $sce, s3Storage, $window) {
          return {
               restrict: 'A',
               templateUrl:'modules/pages/directives/card-variable-file.html',
               scope:true,
               link: function (scope, element, attrs, ctrls) {
                    scope.kind = attrs.cardVariableFile;
                    scope.displayKind = (scope.kind == 'video' ? 'Video' : 'Image');

                    scope.card = cardData.getActiveCard;
                    scope.AWS = appConfig.credentialsAWS;
                    scope.variableName = attrs.name;
                    scope.shortCode = attrs.shortcode;

                    scope.$watch(function () {
                         return cardData.getActiveCard()
                    }, function (newValue) {
                         console.log(newValue);
                         if(newValue){
                              angular.forEach(newValue.actions, function (item, index) {
                                   if (!item) return;
                                   var key = Object.keys(item)[0];
                                   if(scope.shortCode === key){
                                        scope.currentImage = item[key];
                                        //scope.variableValue = scope.currentImage || attrs.value || appConfig.defaultImg;
                                        scope.variableValue = scope.currentImage || attrs.value || '';
                                        scope.renderme = scope.variableValue ? 'renderme' : '';

                                        scope.variableValue = $sce.trustAsResourceUrl(scope.variableValue);
                                   }
                              });
                         }
                    });

                    scope.renderme = attrs.render;
                    scope.client = attrs.client;

                    function setValue(shortCode, value){
                         for (var i = 0; i < scope.card().actions.length; i += 1) {
                              if(typeof scope.card().actions[i][shortCode] != 'undefined'){
                                   scope.card().actions[i][shortCode] = encodeURI(value);
                                   scope.variableValue = encodeURI(value);
                                   scope.variableValue = $sce.trustAsResourceUrl(scope.variableValue);
                              }
                         }
                         $rootScope.$emit('updateCardHtml');
                    }

                    scope.upload = function (file) {
                         console.log('upload');
                         if (!file) return;

                         var uniqName = cardsHelper.generateUniqueName(file.name, scope.client);
                         var action = _.findItemByKey(scope.card().actions, scope.shortCode);

                         var uploaded = null;
                         if (scope.kind == 'video') {
                              uploaded = s3Storage.upload(uniqName, file);
                         }
                         else {
                              var imgFixedSize = resolveImageFixedSize(action, 2000, 2000);
                              uploaded = s3Storage.uploadOptimized(uniqName, file, null, imgFixedSize);
                         }

                         return uploaded.then(function (url) {
                              setValue(scope.shortCode, url);
                              logger.success(scope.displayKind + ' uploaded successfully');
                         }, function (err) {
                              logger.error('Error uploading image');
                         }, function (progress) {
                              scope.uploadProgress = progress;
                         });
                    };

                    scope.deleteSelectedImage = function (event, short) {
                         //var reset = '{{' + short + '}}';
                         var reset = '';
                         setValue(short, reset);
                         scope.uploadProgress = undefined;
                         $(event.target).closest('.fileUploadForm')[0].reset();
                        scope.$root.$emit('updateCardHtml');
                    };

                    /**
                     * Calculates fixed image dimensions according to CSS stylesheet from page builder.
                     * Used for image optimization + resizing feature.
                     * @returns {width, height} fixed image size
                     */
                    function resolveImageFixedSize(action, maxWidth, maxHeight) {
                         var oldValue = _.values(action)[0];
                         if (!oldValue) return {};

                         var $body = $('.page.content');
                         var $usages = $body.find('img').filter(function() { return $(this).attr('src') == oldValue; })
                             .add($body.find('*').filter(function () { return ($(this).css('background-image') || '').contains(oldValue); }));

                         var sizes = $usages.map(function () {
                              var styles = _.chain($window.getMatchedCSSRules(this)).pluck('style').flatten().value().concat([this.style]);
                              var fixedWidth = fixedSizePx(styles, 'max-width') || fixedSizePx(styles, 'width');
                              var fixedHeight = fixedSizePx(styles, 'max-height') || fixedSizePx(styles, 'height');

                              return {
                                   width: fixedWidth || undefined,
                                   height: fixedHeight || undefined
                              };
                         });

                         var result = {
                              width: _.max(sizes, 'width').width, // or undefined
                              height: _.max(sizes, 'height').height // or undefined
                         };

                         result.width = result.width && maxWidth && Math.min(result.width, maxWidth);
                         result.height = result.height && maxHeight && Math.min(result.height, maxHeight);

                         return result;
                    }

                    /**
                     * Extract fixed size css property value among the whole element stylesheet,
                     * if some percentage declared, consider css property as floating size and return undefined.
                     * @param styles CSS stylesheet
                     * @param cssProperty lookup property
                     * @returns {Number} property fixed size (if any)
                     */
                    function fixedSizePx(styles, cssProperty) {
                         var propertyValuesPx = _.chain(styles).pluck(cssProperty).compact().map(toPx).value();
                         if (propertyValuesPx.length && _.every(propertyValuesPx)) {
                              return _.max(propertyValuesPx);
                         }
                    }

                    /**
                     * Parses out pixels number from css property value.
                     * covers: 100px, 500, -20
                     * ignores: 50%, 30vh
                     * @param str
                     * @returns {Number} Pixels number.
                     */
                    function toPx(str) {
                         var m = (str || '').match(/([\d.]+)(px)?$/i);
                         return m && m[1] && parseFloat(m[1]);
                    }
               }
          };
     }
}());
