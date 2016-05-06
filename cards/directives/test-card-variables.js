(function() {
     'use strict';

     angular
          .module('cards')
          .directive('testbar', testbar);

     testbar.$inject = ['cardData', '$rootScope'];

     function testbar (cardData, $rootScope) {
          return {
               restrict: 'A',
               templateUrl: 'modules/cards/directives/test-card-variables.html',
               scope:{},
               link: function (scope, element, attrs, ctrs) {
                    scope.card = cardData.getActiveCard;

                    /*scope.setValue = function(shortCode, value){
                         var obj = { short: shortCode, val: value};
                         console.log(obj);
                         if ( typeof scope.card().actions != "undefined" ) {
                              var in_array = false;
                              for (var i = 0; i < scope.card().actions.length; i += 1) {
                                   if(scope.card().actions[i].short == shortCode){
                                        in_array = true;
                                        scope.card().actions[i].val = value;
                                   }
                              }
                              if (!in_array) {
                                   scope.card().actions.push(obj);    
                              }
                         } else {
                              scope.card().actions = [];
                              
                         }
                         //cardData.getActiveCard().actions;
                         cardData.setActiveCard(scope.card());
                    };*/

                    scope.setValue = function(shortCode, value){
                         var action = _.findItemByKey(scope.card().actions, shortCode);
                         if (action) {
                              action[shortCode] = value;
                         }

                         console.log(shortCode + ":" + value);
                         $rootScope.$emit('updateCardHtml');

                         return value;
                    };

                    scope.$watch(function () {
                         return cardData.getActiveCard()
                    }, function (newValue) {
                         if(newValue){
                              scope.cardFile = newValue;
                              listVariables(scope);
                         }
                    });

                    scope.selectPageConfig = {
                         create: true,
                         createOnBlur: true,
                         maxItems: 1,
                         allowEmptyOption: true,
                         preload: true,
                         valueField: 'url',
                         labelField: 'name',
                         sortField: 'name',
                         searchField: ['name', 'url'],
                         load: function (query, callback) {
                              callback([{
                                   name: 'Page 1',
                                   url: absolutePath('/page1')
                              }, {
                                   name: 'Page 2',
                                   url: absolutePath('/page2')
                              }, {
                                   name: 'Page 3',
                                   url: absolutePath('/page3')
                              }]);
                         }
                    };
               }
          }
     }

     function listVariables(scope) {
          scope.dropOpts=[]; scope.inputOpts=[]; scope.areaOpts=[]; scope.checkOpts=[]; scope.fileOpts = []; scope.videoOpts = []; scope.pageOpts = []; scope.repeatOpts = [];
          if (typeof scope.card().variables == 'undefined')
               scope.card().variables = [];
          for (var i = 0; i < scope.card().variables.length; i += 1) {
               //var val = scope.card().variables[i];
               var val = jQuery.extend(true, {}, scope.card().variables[i]);

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
                         scope.inputOpts.push(val);
                         break;
                    case 'textarea':
                         scope.areaOpts.push(val);
                         break;
                    case 'checkbox':
                         scope.checkOpts.push(val);
                         break;
                    case 'file':
                         scope.fileOpts.push(val);
                         break;
                    case 'video':
                         scope.videoOpts.push(val);
                         break;
                    case 'pageslist':
                         scope.pageOpts.push(val);
                         break;
                    case 'repeat':
                         val.value = parseInt(val.value, 10) || 0;
                         scope.repeatOpts.push(val);
                         break;
               }
          }
     }

     function absolutePath(path) {
          return location.protocol + '//' + location.host + ('/' + path).replace('//', '/');
     }

}());
