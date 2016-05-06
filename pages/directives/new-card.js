(function() {
     'use strict';

     angular
          .module('pages')
          .directive('newCard', newCard);

     newCard.$inject = ['cardsHelper', 'cardData', 'pagesHelper', 'editorService', '$compile', '$timeout', 'logger'];

     function newCard (cardsHelper, cardData, pagesHelper, editorService, $compile, $timeout, logger) {
          return {
               restrict: 'A',
               templateUrl:'modules/pages/directives/new-card.html',
               scope: {
                    card:'=',
                    rendered: '&'
               },
               transclude:true,
               //replace:true,
               link: function (scope, element, attrs) {
                    scope.uniqueID = function() {
                         var text     = "";
                         var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

                         for( var i=0; i < 8; i++ ) {
                            text += possible.charAt(Math.floor(Math.random() * possible.length));
                         }
                         return text;
                    };

                   scope.range = function (n) {
                       return _.range(parseInt(n, 10) || 0);
                   };

                   var delayExpr = (attrs.delay || '').replace(/^{*|}*$/g, '');
                    scope.delay = scope.$eval(delayExpr) || 0;

                    scope.card.html = cardsHelper.compileCardHtml(scope.card.html, scope.card);
                    scope.card.changed = false;
                    delete scope.card.reference;

                    var classId = scope.uniqueID();
                    scope.cardid = cardsHelper.generateRandomText();
                    scope.index = attrs.index;
                    scope.html = scope.card.html;
                    scope.$eval(attrs.delay)

                    scope.css = scope.card.css;
                    scope.js = scope.card.js;
                    scope.variables = scope.card.variables; //user card variables
                    scope.less = '';

                   scope.$watch('card.html', function (html, oldHtml) {
                       if (html == oldHtml) return;

                       if ($(oldHtml).find('.editable').length != $(html).find('.editable').length) {
                           // re-render medium editor for new html
                           var builderScope = scope.$parent.$parent;
                           var client = builderScope.client || builderScope.selectedClient;
                           if (client) {
                               editorService.destroyEditor();
                               element.find('[medium-editor-model]').html(html);
                               $timeout(function () {
                                   editorService.renderEditor(client, builderScope, true);
                               });
                           }
                       }
                   });

                   $timeout(function () {
                    var less_content = ".card-" + classId + "{ " + scope.css + " }";
                    less.render(less_content).then(function(output) {
                         var content = '';                        
                         if (scope.card.original_html === '') {
                              var ori_content = '';
                              ori_content += '<div medium-editor-model ng-model="card.html">' + scope.card.html + '</div>';                         
                              ori_content += '<style parse-style dynamic-css-binding="">' + scope.css + '</style><div style="clear:both"></div>';
                              var ori_compiledContent = $compile(ori_content)(scope);

                              // original_html is never used, seems redundant
                              scope.card.original_html = $(ori_compiledContent[0]).html();
                         }
                         if (scope.js !== '') {
                              if (typeof jQuery(scope.card.html).find('#masterslider') != 'undefined') {
                                   var dom_element = jQuery(scope.card.html);
                                   var ms_container = jQuery(dom_element).find(".ms-slide");
                                   jQuery(dom_element).find("#masterslider").empty();
                                   jQuery(dom_element).find("#masterslider").append(ms_container);
                                   scope.card.html = jQuery(dom_element).get(0).outerHTML;  
                              }
                         }

                         scope.js = scope.js.replace(/\$\(\'/g, "$('.card-" + classId + " ");
                         content += '<div class="card-' + classId + '"><div medium-editor-model ng-model="card.html">' + scope.card.html + '</div></div>';
                         content += '<script>setTimeout(function() { ' + scope.js + ' }, 1)</script>';
                         content += '<style parse-style dynamic-css-binding="">' + output.css + '</style><div style="clear:both"></div>';
                         var compiledContent = $compile(content)(scope);
                        element.append(compiledContent);

                        $timeout(function() {
                            scope.$emit('updateCardHtml', true);
                        });

                        scope.rendered();

                         scope.bindVariablesToScope = function() {
                              if (!scope.card) return;
                              scope.card.actions.forEach(function (action) {
                                   try { 
                                        var key = Object.keys(action)[0];
                                        scope[key] = action[key];
                                   } catch(err) {}
                              });
                         };

                         scope.removeCard = function(){  
                              element.find('#deleteCardModal').modal2('hide');
                              editorService.destroyEditor();
                              $timeout(function() {
                                   //angular.element(document.querySelector('.buildPage')).removeClass('hidden');
                                   //angular.element(document.querySelector('.editCard')).addClass('hidden');
                                   scope.$parent.toggleCardSettings(false);
                                   cardData.removeCard(scope.$parent.newPage.cards, scope.card);
                                   scope.$parent.$parent.isPageDirty = true;
                              },300);
                              
                         };

                        scope.duplicateCard = function(){
                            element.find('#duplicateCardModal').modal2('hide');
                            $timeout(function () {
                                cardData.duplicateCard(scope.$parent.newPage.cards, scope.card);
                                scope.$parent.$parent.isPageDirty = true;
                                logger.info('Card duplicated below');
                            }, 300);
                        };
                    
                         scope.setActiveCard = function () {
                              cardData.setActiveCard(scope.card);
                              //angular.element(document.querySelector('.buildPage')).addClass('hidden');
                              //angular.element(document.querySelector('.editCard')).removeClass('hidden');
                              scope.$parent.openCardSettingsSidebar();
                         };

                         scope.$watch(function() {
                              return scope.card.actions;
                         }, function (actions) {
                              if (actions){
                                   scope.bindVariablesToScope();
                              }
                         }, true);
                         
                         scope.openDeleteModal = function () {
                              element.find('#deleteCardModal').modal2('show');
                         };

                         scope.openDuplicateModal = function () {
                             element.find('#duplicateCardModal').modal2('show');
                         };

                         var builderScope = scope.$parent.$parent;
                         var client = builderScope.client || builderScope.selectedClient;
                         if (client) {
                             editorService.renderEditor(client, builderScope);
                         }
                         
                    }).catch(function(err){
                         logger.error('Error with LESS');
                         logger.error(err.message);
                    });
                   }, scope.delay);
               }

          };
     }
}());
