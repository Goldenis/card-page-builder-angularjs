(function() {
     'use strict';

     angular
          .module('pages')
          .directive('sidebar', sidebar);

     sidebar.$inject = ['cardData', '$rootScope', 'logger', 'editorService', 'Cards', '$timeout', 'cardsHelper', 'debounce'];

     function sidebar (cardData, $rootScope, logger, editorService, Cards, $timeout, cardsHelper, debounce) {
         var updateHtmlDependenciesDebounced = debounce(500, updateHtmlDependencies);

         return {
               restrict: 'A',
               templateUrl: 'modules/pages/directives/side-bar.html',
               scope: {
                   cards: '=',
                   pages: '='
               },
               link: function (scope, element, attrs, ctrs) {
                    scope.card = cardData.getActiveCard;
                    console.log(scope.card.cardTutorial);
                    scope.setValue = function(shortCode, value, extra){
                         var action = _.findItemByKey(scope.card().actions, shortCode);

                         if (action && extra !== undefined) {
                             var variable = _.findWhere(scope.card().variables, { shortCode: shortCode });
                             if (action && variable && variable.kind == 'Pages List') {
                                 var suffix = extra && extra != '_self' ? '#' + extra : '';
                                 value = (value || '').split('#')[0] + suffix;
                                 $timeout(function () {
                                     $('a[href="' + value + '"]').each(function () {
                                         $(this).attr('href', value).attr('target', extra);
                                     });
                                 }, 50);
                             }
                         }

                         if (action && action[shortCode] != value) {
                             action[shortCode] = value;
                             updateDependencies(scope, shortCode);
                             updateHtmlDependenciesDebounced(scope, shortCode);
                         }

                         console.log(shortCode + ":" + value);
                         $rootScope.$emit('updateCardHtml');
                         scope.card().changed = true;

                        return value;
                    };

                    scope.showVideoTutorial = function() {
                      $('#videoTutorial').modal2('show');
                    }

                   scope.updateCard = function (force) {
                       var card = scope.card();
                       var recentCard = findRecentCard(scope.cards, card);
                       if (!recentCard) return logger.error('Can\'t update card since it has been removed');

                       var oldCard = new Cards(angular.copy(card));

                       var $oldOriginalEditables = extractEditables(cardsHelper.compileCardHtml(oldCard.original_html || oldCard.html, oldCard));
                       var $newEditables = extractEditables(cardsHelper.compileCardHtml(recentCard.html, recentCard));

                       if (!force && hasTextConflicts($oldOriginalEditables, $newEditables)) {
                           return $('#confirmCardConflictsResolution').modal2('show');
                       }

                       angular.extend(card, recentCard);
                       card.client = oldCard.client;

                       // restore actions from old card
                       _.each(oldCard.actions, function (action) {
                           var shortCode = _.keys(action)[0];
                           var newAction = _.findItemByKey(card.actions, shortCode);
                           if (!newAction) return;
                           newAction[shortCode] = action[shortCode];
                       });

                       var $oldEditables = extractEditables(cardsHelper.compileCardHtml(oldCard.html, oldCard));
                       card.html = restoreTextChanges(cardsHelper.compileCardHtml(card.html, card), $oldEditables);

                       refreshCard(scope.$parent.newPage.cards, card);
                       scope.$parent.isPageDirty = true;

                       if (force) {
                           $('#confirmCardConflictsResolution').modal2('hide');
                       }
                   };

                   scope.selectPageConfig = {
                       create: true,
                       createOnBlur: true,
                       maxItems: 1,
                       allowEmptyOption: true,
                       preload: true,
                       valueField: 'absolutePath',
                       labelField: 'name',
                       sortField: 'name',
                       searchField: ['name', 'absolutePath'],
                       load: function (query, callback) {
                           if (!scope.pages) return;
                           scope.pages.then(function (pages) {
                               var cardClient = scope.card().client;
                               var result = _.filter(pages, function (p) {
                                   return p.client && p.client.companyName == cardClient;
                               });
                               result.unshift({ url: '', path: '', name: 'No page' });

                               var selectedClient = scope.$parent.selectedClient;
                               _.each(result, function (page) {
                                   page.absolutePath = _.absPageUrl(page, selectedClient);
                               });

                               callback(result);
                           });
                       }
                   };

                    scope.$on('resetOpts', function() {
                         scope.dropOpts=[]; scope.inputOpts=[]; scope.areaOpts=[]; scope.checkOpts=[]; scope.fileOpts = []; scope.videoOpts = []; scope.pageOpts = []; scope.repeatOpts = [];
                    });

                    scope.$watch(function () {
                         return cardData.getActiveCard()
                    }, function (newValue) {
                         if(newValue){
                              scope.cardFile = newValue;
                              if (scope.cardFile != undefined && scope.cardFile.cardTutorial != undefined)
                                scope.videoTutorial = scope.cardFile.cardTutorial.url;
                              listVariables(scope, newValue);
                         }
                    });
               }
          };

         function extractEditables(html) {
             var cleanHtml = cardsHelper.cleanUpCardHtml(html);
             return $(cleanHtml).find('.editable');
         }

         function hasTextConflicts($oldEditables, $newEditables) {
             if ($oldEditables.length != $newEditables.length) return true;
             if (_.some(_.zip($oldEditables, $newEditables), function (tuple) {
                     return $(tuple[0]).text().trim() != $(tuple[1]).text().trim();
                 })) {
                 return true;
             }
             return false;
         }

         function restoreTextChanges(newHtml, $oldEditables) {
             var $container = $('<div>').html(cardsHelper.cleanUpCardHtml(newHtml));
             var $newEditables = $container.find('.editable');
             _.zip($oldEditables, $newEditables).forEach(function (tuple) {
                 if (tuple.length == 2) {
                     $(tuple[1]).html($(tuple[0]).html());
                 }
             });
             return $container.html();
         }

         function refreshCard(cardsList, card) {
             if (!cardsList) return;
             var index = cardsList.indexOf(card);
             if (index < 0) return;

             editorService.destroyEditor();

             var card2 = new Cards(card);
             cardsList.splice(index, 1, card2);
             cardData.setActiveCard(card2);
         }

         function findRecentCard(recentCards, card) {
             var suffixRegex = /\([^)]*\)$/g; // e.g. Card name suffix >> (v2)

             var cardBaseName = getBaseName(card.name);
             var recentVersion = _.chain(recentCards)
                 .filter(function (c) { return getBaseName(c.name) == cardBaseName; })
                 .map(function (c) {
                     var cardName = (c.name || '').trim();
                     var suffix = _.first(cardName.match(suffixRegex));
                     var version = parseFloat((suffix || '').replace(/[^\d.,]*/g, '')) || 0;
                     return { card: c, version: version };
                 })
                 .sortBy('version')
                 .last().value();

             var recentCard = recentVersion ? recentVersion.card : _.findWhere(recentCards, { _id: card._id });
             return recentCard && new Cards(angular.copy(recentCard)); // null possible

             function getBaseName(cardName) {
                 cardName = (cardName || '').trim();
                 var baseName = cardName.replace(suffixRegex, '').trim();
                 return baseName.toLowerCase();
             }
         }

         function listVariables(scope, card) {
             scope.dropOpts=[]; scope.inputOpts=[]; scope.areaOpts=[]; scope.checkOpts=[]; scope.fileOpts = []; scope.videoOpts = []; scope.pageOpts = []; scope.repeatOpts = [];

             if (!card.variables) return;

             //if (typeof scope.card().variables == 'undefined')
             //     scope.card().variables = [];
             for (var i = 0; i < card.variables.length; i += 1) {
                 var val = jQuery.extend(true, {}, card.variables[i]);
                 var action = jQuery.extend(true, {}, (card.actions || [])[i]);

                 var kind = (val.kind || '').replace(/\s+/g, '').toLocaleLowerCase();
                 switch (kind) {
                     case 'dropdown':
                         var p_val = val;
                         for ( var j = 0; j< val.value.length; j++) {
                             if (!val.value[j].value) {
                                 var value_array = val.value[j].split("/");
                                 if (value_array.length > 1) {
                                     p_val.value[j] = {
                                         name: value_array[0],
                                         value: value_array[1]
                                     }
                                 } else {
                                     p_val.value[j] = {
                                         name: value_array[0],
                                         value: value_array[0]
                                     }
                                 }
                             }

                         }
                         scope.dropOpts.push(p_val);
                         break;
                     case 'textinput':
                         val.value = action[val.shortCode] || val.value;
                         scope.inputOpts.push(val);
                         break;
                     case 'textarea':
                         val.value = action[val.shortCode] || val.value;
                         scope.areaOpts.push(val);
                         break;
                     case 'checkbox':
                         val['valueTrue'] = val.value || false;
                         val.value = action[val.shortCode] || false;
                         val['checked'] = (val.value == val.valueTrue) ? true : false;
                         scope.checkOpts.push(val);
                         break;
                     case 'file':
                         scope.fileOpts.push(val);
                         break;
                     case 'video':
                         scope.videoOpts.push(val);
                         break;
                     case 'pageslist':
                         val.value = action[val.shortCode] || val.value;
                         val.valueSelected = val.value && val.value.split('#')[0];
                         val.valueTarget = ((action[val.shortCode] || '').match(/#(.*)$/) || [])[1];
                         scope.pageOpts.push(val);
                         break;
                     case 'repeat':
                         val.value = parseInt(action[val.shortCode], 10);
                         val.value = isNaN(val.value) ? parseInt(val.value, 10) || 1 : val.value;
                         scope.repeatOpts.push(val);
                         break;
                 }
             }
         }

         function updateDependencies(scope, shortCode) {
             if (shortCode == 'bgcolor') {
                 if (!_.findItemByKey(scope.card().actions, 'customcolor')) return;
                 var value = _.findItemByKey(scope.card().actions, shortCode)[shortCode];
                 scope.setValue('customcolor', value);
                 _.findWhere(scope.inputOpts, { shortCode: 'customcolor' }).value = value;
             }
         }

         function updateHtmlDependencies(scope, shortCode) {
             // update card html to reflect new repeating value
             var cvar = _.findWhere(scope.card().variables, { shortCode: shortCode });
             if (cvar && cvar.kind == 'Repeat') {
                 scope.card().html = cardsHelper.compileCardHtml(scope.card().html, scope.card());
             }
         }
     }

}());
