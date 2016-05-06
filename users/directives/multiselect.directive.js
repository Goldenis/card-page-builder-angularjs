(function() {
     'use strict';

     angular
          .module('users')
          .directive('multiselect', multiselect)
          .directive('multiselectPopup', multiselectPopup);

     multiselect.$inject = ['$parse', '$document', '$compile', 'optionParser'];

     function multiselect ($parse, $document, $compile, optionParser) {
          return {
               restrict: 'E',
               require: 'ngModel',
               link: function (originalScope, element, attrs, modelCtrl) {
                    var exp = attrs.options,
                         parsedResult = optionParser.parse(exp),
                         isMultiple = attrs.multiple ? true : false,
                         isSingle = attrs.single ? true : false,
                         header = attrs.header || "Select",
                         required = false,
                         scope = originalScope.$new(),
                         changeHandler = attrs.change || angular.noop,
                         actionHandler = attrs.action || angular.noop,
                         selected = attrs.selected,
                         initialLoad = true;

                    scope.items = [];

                    scope.header = header;
                    scope.multiple = isMultiple;
                    scope.single = isSingle;
                    scope.disabled = false;

                    originalScope.$on('$destroy', function () {
                         scope.$destroy();
                    });

                    var popUpEl = angular.element('<multiselect-popup></multiselect-popup>');

                    //required validator
                    if (attrs.required || attrs.ngRequired) {
                         required = true;
                    }
                    attrs.$observe('required', function(newVal) {
                         required = newVal;
                    });

                    //watch disabled state
                    scope.$watch(function () {
                         return $parse(attrs.disabled)(originalScope);
                    }, function (newVal) {
                         scope.disabled = newVal;
                    });

                    //watch single/multiple state for dynamically change single to multiple
                    scope.$watch(function () {
                         return $parse(attrs.multiple)(originalScope);
                    }, function (newVal) {
                         isMultiple = newVal || false;
                    });

                    //watch option changes for options that are populated dynamically
                    scope.$watch(function () {
                         return parsedResult.source(originalScope);
                    }, function (newVal) {
                         if (angular.isDefined(newVal))
                              parseModel();
                    }, true);

                    //watch model change
                    scope.$watch(function () {
                         return modelCtrl.$modelValue;
                    }, function (newVal, oldVal) {
                         //when directive initialize, newVal usually undefined. Also, if model value already set in the controller
                         //for preselected list then we need to mark checked in our scope item. But we don't want to do this every time
                         //model changes. We need to do this only if it is done outside directive scope, from controller, for example.
                         if (angular.isDefined(newVal)) {
                              markChecked(newVal);
                              if (initialLoad)
                                   initialLoad =false;
                              else
                                   scope.$eval(changeHandler);
                         }
                         
                         getHeaderText();
                         modelCtrl.$setValidity('required', scope.valid());
                    }, true);

                    function clientsInSelcted(modelValue) {
                         var check = false;
                         modelCtrl.$modelValue.forEach(function(model) {
                              if (model.companyName == modelValue) {
                                   check = true;
                              }
                         });
                         if (check) return true;
                         return false;
                    }

                    function parseModel() {
                         scope.items.length = 0;
                         var model = parsedResult.source(originalScope);
                         if(!angular.isDefined(model)) return;
                         for (var i = 0; i < model.length; i++) {
                              var local = {};
                              local[parsedResult.itemName] = model[i];
                              var bChecked = false;
                              if (header === "Clients") {
                                   bChecked = clientsInSelcted(parsedResult.viewMapper(local));
                              }
                              scope.items.push({
                                   label: parsedResult.viewMapper(local),
                                   model: model[i],
                                   checked: bChecked
                              });
                         }
                    }

                    parseModel();

                    element.append($compile(popUpEl)(scope));

                    function getHeaderText() {
                         if (is_empty(modelCtrl.$modelValue)) return scope.header; //scope.header = 'Select';
                         if (isMultiple) {
                              scope.header = modelCtrl.$modelValue.length + ' ' + 'checked';
                         } else {
                              var local = {};
                              local[parsedResult.itemName] = modelCtrl.$modelValue;

                              scope.header = parsedResult.viewMapper(local);
                         }
                    }

                    function is_empty(obj) {
                         if (!obj) return true;
                         if (obj.length && obj.length > 0) return false;
                         for (var prop in obj) if (obj[prop]) return false;
                         return true;
                    }

                    scope.valid = function validModel() {
                         if(!required) return true;
                         var value = modelCtrl.$modelValue;
                         return (angular.isArray(value) && value.length > 0) || (!angular.isArray(value) && value != null);
                    };

                    function selectSingle(item) {
                         if (item.checked) {
                              scope.uncheckAll();
                         } else {
                              scope.uncheckAll();
                              item.checked = !item.checked;
                         }
                         setModelValue(false);
                    }

                    function selectMultiple(item, $event) {
                         item.checked = !item.checked;
                         setModelValue(true);
                    }

                    function setModelValue(isMultiple) {
                         var value;

                         if (isMultiple) {
                              value = [];
                              angular.forEach(scope.items, function (item) {
                                   if (item.checked) value.push(item.model);
                              })
                         } else {
                              angular.forEach(scope.items, function (item) {
                                   if (item.checked) {
                                        value = item.model;
                                        return false;
                                   }
                              })
                         }
                         modelCtrl.$setViewValue(value);
                    }

                    function markChecked(newVal) {
                         angular.forEach(scope.items, function (item) {
                                   item.checked = false;
                         });
                         if (!angular.isArray(newVal)) {
                              angular.forEach(scope.items, function (item) {
                                   if (angular.equals(item.model, newVal)) {
                                        item.checked = true;
                                        return false;
                                   }
                              });
                         } else {
                              angular.forEach(newVal, function (i) {
                                   angular.forEach(scope.items, function (item) {
                                        if (angular.equals(item.model, i)) {
                                             item.checked = true;
                                        }
                                   });
                              });
                         }
                    }

                    scope.assign = function () {
                         scope.$eval(actionHandler);
                         //scope.uncheckAll();
                         scope.toggleSelect();
                    };

                    scope.checkAll = function () {
                         if (!isMultiple) return;
                         angular.forEach(scope.items, function (item) {
                              item.checked = true;
                         });
                         setModelValue(true);
                    };

                    scope.uncheckAll = function () {
                         angular.forEach(scope.items, function (item) {
                              item.checked = false;
                         });
                         setModelValue(true);
                    };

                    scope.select = function (item, $event) {
                         if (isMultiple === false && isSingle== true) {
                              selectSingle(item);
                         } else {
                              selectMultiple(item, $event);
                         }
                    }
               }
          };
     }

     multiselectPopup.$inject = ['$document'];

     function multiselectPopup ($document) {
          return {
               restrict: 'E',
               scope: false,
               replace: true,
               templateUrl: 'modules/users/directives/multiselect.html',
               link: function (scope, element, attrs) {

                    scope.isVisible = false;

                    scope.toggleSelect = function () {
                         if(!scope.disabled) {
                              if (element.hasClass('open')) {
                                   element.removeClass('open');
                                   $document.unbind('click', clickHandler);
                              } else {
                                   element.addClass('open');
                                   $document.bind('click', clickHandler);
                                   scope.focus();
                              }
                         }
                    };

                    function clickHandler(event) {
                         if (elementMatchesAnyInArray(event.target, element.find(event.target.tagName)))
                              return;
                         element.removeClass('open');
                         $document.unbind('click', clickHandler);
                         scope.$apply();
                    }

                    scope.focus = function focus(){
                         var searchBox = element.find('input')[0];
                         searchBox.focus();
                    };

                    var elementMatchesAnyInArray = function (element, elementArray) {
                         for (var i = 0; i < elementArray.length; i++)
                              if (element == elementArray[i])
                                   return true;
                         return false;
                    }
               }
          }
     }
})();
