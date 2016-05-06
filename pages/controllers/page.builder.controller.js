(function () {
     "use strict";

     angular
          .module('pages')
          .controller('PageBuilderController', PageBuilderController);

     PageBuilderController.$inject = ['cardData', 'editorService', 'pagesHelper', '$q', 'Pages', '$scope', '$rootScope', 'Authentication', 'logger', 'cardsHelper', 'clientHelper', '$timeout', '$stateParams', '$state', '$location', '$mdUtil', '$mdSidenav', '$log', '$cookieStore', 's3Storage', '$mdDialog', 'IntercomSvc', 'Logs'];

     function PageBuilderController(cardData, editorService, pagesHelper, $q, Pages, $scope, $rootScope, Authentication, logger, cardsHelper, clientHelper, $timeout, $stateParams, $state, $location, $mdUtil, $mdSidenav, $log, $cookieStore, s3Storage, $mdDialog, IntercomSvc, Logs) {
          $scope.me = Authentication.user;
          $scope.pageId = $stateParams.pageId;
          $scope.leaveUrl = '';
          $scope.vleavePage = false;
          $scope.isPageDirty = false;
          $scope.loadingProgress = 0;

          $scope.$watch(function() { return cardData.getActiveCard(); }, function() {$scope.selectedCard = cardData.getActiveCard(); });

          $scope.$watchCollection('newPage.cards', function (cards, oldCards) {
              if (oldCards && $scope.page) {
                  $scope.page.saveWholePage = true;
              }

              var client = $scope.client || $scope.selectedClient;
              editorService.renderEditor(client, $scope);
          });

         $scope.replaceLayoutHeader = function () {
             $rootScope.hideNavbar = true;
         };

          loadPageData($scope.pageId);

          $(window).on('keydown', saveKeyPressHandler);

          $scope.$on('$stateChangeStart', function(event, newUrl, oldUrl) {
               $rootScope.hideNavbar = false;
               $(window).off('keydown', saveKeyPressHandler);
               if ($scope.vleavePage == false && $scope.isPageDirty) {
                    $('#leavePageModal').modal2('show');
                    event.preventDefault();
                    $scope.leaveUrl = newUrl;
               }
              else {
                   $timeout.cancel(keepEditingTimer);
                   Pages.editing({ reset: true }, { pageId: $scope.pageId });
               }
          });

          // recurrent task to slide editing timestamp, executes every 10 seconds, timeout 30 seconds
          var keepEditingTimer = $timeout(function keepEditing() {
              Pages.editing({ pageId: $scope.pageId }, function () {
                  keepEditingTimer = $timeout(keepEditing, 10000);
              }, function (response) {
                  console.error('keep page edited request failed', response);
                  if (response.status == 404) return; // page not found - stop keep editing requests
                  keepEditingTimer = $timeout(keepEditing, 10000);
              });
          }, 0);

         function loadPageData(pageId) {
              $scope.lazyLoading = true;

              Pages.get({ pageId: $scope.pageId, exclude: ['sourceCode', 'exportedCSS'] }).$promise.then(function (page) {
                  $scope.page = page;
                  var promises = [cardData.getClient(page.client.companyName), cardData.getClientCards(page.client, true)];
                  $q.all(promises).then(function (results) {
                      $scope.clients = [results[0]];
                      $scope.allCards = results[1];
                      initializeController();

                      if ($scope.me.role === 'client') {
                          // no background tasks to fetch other clients details
                          $scope.lazyLoading = false; // loaded
                      }
                      else {
                          // background tasks
                          $timeout(function () {
                              $q.all([cardData.getClients(), cardData.getAllCards()]).then(function (results) {
                                  $scope.clients = unionEntities($scope.clients, results[0]);
                                  $scope.allCards = unionEntities($scope.allCards, results[1]);
                              }).finally(function () {
                                  $scope.lazyLoading = false; // loaded
                              });
                          }, 200);
                      }
                  }).catch(function (err) {
                      $scope.lazyLoading = false; // loaded
                      return $q.reject(err);
                  });
              }).catch(function (err) {
                  console.error(err);
                  $scope.loadingError = 'Unable to load this page';
              });
          }

          function initializeController() {
               $scope.newPage = {};
               $scope.canSaveOrEdit = $scope.me.role === 'admin' || $scope.me.role === 'client';
               $scope.canChangeClient = $scope.me.role === 'admin';
               console.log("pageId:" + $scope.pageId);

                //$scope.newPage = $scope.page;
                $rootScope.title = "Cardkit | " + $scope.page.name;

               $scope.updatedUrl = $scope.page.url;
               $scope.updatedName = $scope.page.name;

               if ($scope.page.cards && ($scope.page.cards.length != undefined)) {
                   $timeout(function () {
                       for (var i = 0; i < $scope.page.cards.length; i++) {
                           cardData.addCardToPage($scope.page.cards[i]);
                       }
                       $scope.newPage.cards = $scope.page.cards;

                       _.each($scope.newPage.cards, function (card) {
                           card.loaded = false;
                       });
                   }, 4000);
               }
               else {
                   $scope.newPage.cards = [];
               }

               //$scope.client = clientHelper.getClientByName($scope.clients, $scope.page.client.client);

               $scope.leavePage = function (argument) {
                    $('#leavePageModal').modal2('hide');

                    $timeout.cancel(keepEditingTimer);
                    Pages.editing({ reset: true }, { pageId: $scope.pageId });

                    $timeout(function() {
                         $scope.vleavePage = true;
                         resetDirtyPage($scope);
                         $location.path($scope.leaveUrl.url);
                    },300);
               }

               $scope.resetSidebar = function() {
                    console.log("resetSidebar");
                    $scope.$broadcast('resetOpts');
               }

              var deferLoaded = $q.defer();
              $scope.loaded = deferLoaded.promise;
              $scope.loadingCompleted = function (card) {
                  if (card) { card.loaded = true; }
                  var cardsLoaded = _.where($scope.newPage.cards, { loaded: true });
                  var loadingComplete = cardsLoaded.length == ($scope.newPage.cards || []).length;

                  if (loadingComplete) {
                      $timeout(resetBackgroundsAttachment, 500);
                      $timeout(closeCardSettingsBeforePopup, 500);
                  }

                  // hide busy indicator once 2+ cards loaded (should fill the whole viewport thus can be shown asap)
                  if ((loadingComplete || cardsLoaded.length >= 2) && !$scope.loadingDone) {
                      $scope.loadingProgress = 100;
                      $timeout.cancel($scope.loadingTimer);
                      $timeout(function () { $scope.loadingDone = true; });
                      deferLoaded.resolve();
                  }
              };

               $scope.getCards = function (specificClient) {
                    //specificClient = specificClient || $scope.client || $scope.clients[0];
                    var cClient;
                    console.log(specificClient);
                    if (specificClient != undefined)
                      $scope.client = clientHelper.getClientByName($scope.clients, specificClient.companyName) || specificClient;
                    else
                      $scope.client = $scope.clients[0];
                    //$scope.client = specificClient || $scope.client || $scope.clients[0];
                    //$scope.client.client = $scope.client.companyName;

                    //$scope.cards = cardsHelper.clientLiveCards($scope.allCards, $scope.client || $scope.me, $scope.me.role);
                    if ($scope.me.role !== 'admin') {
                      //$scope.client = $scope.me;
                      var userClients = Authentication.clients();
                      $scope.client = clientHelper.getClientByName($scope.clients, _.contains(userClients, $scope.client.companyName) ? $scope.client.companyName : $scope.me.client);
                      console.log($scope.client);
                    }
                    console.log($scope.client);

                    $scope.cards = cardsHelper.clientLiveCards($scope.allCards, $scope.client, $scope.me.role);
                    if ($scope.allCards.length) {
                        $scope.cards.length ? logger.info(($scope.cards[0].client || $scope.client.companyName) + ' cards fetched') : logger.info('There is no available cards');

                        try {
                          pagesHelper.setHeaderFooter($scope.client || $scope.client, 'admin');
                        }
                        catch(error) {
                          console.log(error);
                        }
                    }

                   $scope.sourceScreens = sortCards(pagesHelper.adoptPagesDataStructure(JSON.parse(JSON.stringify($scope.cards.slice()))));
               };

               init();

               $rootScope.saveChangesAndClose = function () {
                   $rootScope.saveChanges().then(function () {
                       $scope.vleavePage = true;
                       $state.go('listPages');
                   });
               };

               $rootScope.saveChanges = function() {
                   $scope.savingPage = true;

                   var done = $q.defer();

                   var start = new Date();
                   done.promise.then(function (page) {
                       if (!page) return;

                       var durationMs = new Date() - start;
                       if (durationMs <= 10000) return;

                       logEvent('Slow Page Saving', {
                           pageId: page._id,
                           pageName: page.name,
                           clientName: page.client.companyName,
                           durationMs: durationMs
                       });
                   });

                   var cardsLen = $scope.newPage.cards.length;
                   var saveTimeout = $timeout(function () {
                       done.reject('Timeout while saving the page');
                   }, cardsLen < 7 ? 45000 : (cardsLen < 10 ? 90000 : 150000));

                   try {
                       $timeout(function () {
                           done.notify({progress: 5, status: 'Building page...'});
                       });

                       var prepared = ensureModalsClosed();

                       var saved = prepared.then(function () {
                           var preview = generatePagePreview($scope.newPage, '#body', true);
                           var saving = $scope.updatePage();
                           saving.then(null, null, done.notify);
                           return $q.all([saving, preview]);
                       });

                       saved.then(function (responses) {
                           IntercomSvc.trackEvent('Saved page', {
                               article: {
                                   value: $scope.selectedClient.companyName + ' | ' + $scope.updatedName,
                                   url: $location.absUrl()
                               }
                           });

                           var page = responses[0] || $scope.page;
                           var thumbUrl = responses[1];
                           if (thumbUrl) {
                               return savePageThumbnail(page._id, thumbUrl).catch(function (error) {
                                   console.error(error);
                                   logger.error('Unable to save page thumbnail');
                               }).then(function () { return page; });
                           }

                           return page;
                       }).then(done.resolve)
                         .catch(function (error) {
                           error = error instanceof Array ? error[0] : error;
                           done.reject(error);
                       });
                   }
                   catch (ex) {
                       done.reject(ex);
                   }

                   $scope.savingPageProgress = done.promise;
                   $scope.savingPageProgress.then(function () {
                       $timeout.cancel(saveTimeout);
                       $scope.fixBackgroundAttachment = true;
                       resetDirtyPage($scope);
                   });

                   return $scope.savingPageProgress;
               };

              $rootScope.discardChanges = function (force) {
                  if (!force) {
                      $('#discardPageModal').modal2('show');
                  }
                  else {
                      pagesHelper.resetPageBuilder($scope);
                      $('#discardPageModal').modal2('hide');
                  }
              };

              $scope.validatePage = function (page) {
                  var pageName = $scope.updatedName;
                  if (!pageName || pageName.trim() == '') return 'Error: Enter page name';
                  return null;
              };

               $scope.updatePage = function () {
                   var errorMessage = $scope.validatePage($scope.page);
                   if (errorMessage) {
                       return $q.reject(errorMessage);
                   }

                   $scope.isPageDirty = false;
                   return pagesHelper.updatePageBuilder($scope);
               };

              
               $scope.exportPage = function() {
                    return pagesHelper.exportPageBuilder($scope);
               };

               $scope.sortableOptions = {
                    connectWith: ".connected-apps-container",
                    'ui-floating': false,
                    start: function (e, ui) {
                        $(ui.item).addClass('dragging');
                    },
                    stop: function (e, ui) {
                        $(ui.item).removeClass('dragging');
                        $(ui.placeholder).remove();

                         if ($(e.target).hasClass('first') &&
                              ui.item.sortable.droptarget &&
                              e.target != ui.item.sortable.droptarget[0]) {
                              //$scope.sourceScreens = pagesHelper.adoptPagesDataStructure(JSON.parse(JSON.stringify($scope.cards.slice())));
                              $scope.sourceScreens = sortCards(pagesHelper.adoptPagesDataStructure(JSON.parse(JSON.stringify($scope.cards.slice()))));
                              $scope.isPageDirty = true;
                              if ($scope.page) $scope.page.saveWholePage = true;
                         }
                    }
               };
               $scope.sortableOptions1 = {
                   connectWith: ".connected-apps-container",
                   scroll: true,
                   'ui-floating': false,
                   handle: '.myAngularHandle',
                   update: function (event, ui) {
                       $scope.isPageDirty = true;
                       if ($scope.page) $scope.page.saveWholePage = true;
                   }
               };

              $scope.toggleCards = buildToggler('cardLibrary');
              $scope.toggleCardSettings = $mdUtil.debounce(function (show) {
                  $scope.csopen = show;
              }, 350);

              $scope.openCardSettingsSidebar = function () {
                  $scope.hideSidebars();
                  $scope.toggleCardSettings(true);
              };

              $scope.hideSidebars = function () {
                  $scope.toggleCards(false);
                  $scope.toggleCardSettings(false);
              };

              $scope.loadClientTags = function (client, query) {
                  if (!client) return $q.when([]);
                  return Pages.queryTags({ query: query }, { clientName: client.companyName }).$promise;
              };

              $scope.openPageSettings = function (ev, page) {
                  var dialogScope = $scope.$new();
                  dialogScope.page = page;
                  dialogScope.clients = $scope.clients;
                  dialogScope.selectClient = $scope.canChangeClient;

                  $mdDialog.show({
                      templateUrl: 'modules/pages/views/page-settings-dialog.client.view.html',
                      controller: 'PageSettingsEditorController',
                      scope: dialogScope,
                      parent: angular.element(document.body),
                      targetEvent: ev,
                      clickOutsideToClose:true,
                      focusOnOpen: false
                  }).then(function (details) {
                      if ($scope.page) angular.extend($scope.page, details);
                      if ($scope.newPage) angular.extend($scope.newPage, details);

                      $scope.updatedName = details.name;
                      $scope.updatedUrl = details.url;

                      if ($scope.selectedClient != details.client) {
                          $scope.selectedClient = details.client;
                          $scope.getCards($scope.selectedClient, 'changed');
                      }

                      savePageDetails($scope.pageId, details).then(function () {
                          logger.success('Page settings saved');
                      });
                  });
              };

              // build actions object for debugging purposes
              $scope._mapObject = function (actions) {
                  var r = {};
                  _.map(actions, function (action) { r[_.keys(action)[0]] = _.values(action)[0]; });
                  return r;
              };

              //
              // PRIVATE FUNCTIONS
              //

              function init() {
                  $scope.loadingProgress = 10;

                  $scope.loadingTimer = $timeout(function timer() {
                      $scope.loadingProgress = Math.min($scope.loadingProgress + 20, 90);
                      $scope.loadingTimer = $timeout(timer, 400 + Math.round(Math.random() * 300));
                  }, 500);

                  /*********     getting current client. Priority 1. page client 2.current user client   ***********/
                  //$scope.client = clientHelper.getClientByName($scope.clients, $scope.page.client.companyName);
                  $scope.getCards($scope.page.client);
                  $scope.selectedClient = $scope.clients[$scope.clients.indexOf(clientHelper.getClientByName($scope.clients, $scope.page.client.companyName))];
                  console.log($scope.selectedClient);

                  $scope.pagesList = Pages.query({
                      clientName: $scope.me.role == 'client' ? $scope.selectedClient.companyName : undefined,
                      exclude: ['cards', 'sourceCode', 'exportedCSS']
                  }).$promise;

                  if (!$scope.page || !($scope.page.cards || []).length) {
                      $scope.loadingCompleted();
                  }

                  if (!$cookieStore.get('page-builder-introduced')) {
                      $scope.introduction = true;
                      $timeout(function () {
                          $scope.introduction = false;
                      }, 120 * 1000);
                      $cookieStore.put('page-builder-introduced', true);
                  }

                  $('.page.content').on('click', 'a[href]', function (event) {
                      event.preventDefault();
                  });

                  $scope.loaded.then(function () {
                      editorService.renderEditor($scope.selectedClient || $scope.client, $scope, true);

                      $('.page.content').on('change input', function(e) {
                          $scope.isPageDirty = true;
                          markCardChanged(e.target);
                      });

                      $rootScope.$on('updateCardHtml', function (event, refresh) {
                          if (!refresh) {
                              $scope.isPageDirty = true;
                          }

                          markCardChanged(event.target);

                          enablePlugins($('.page.content'));
                      });
                  });
              }

              function buildToggler(navID) {
                  var debounceFn = $mdUtil.debounce(function (show) {
                      var sidenav = $mdSidenav(navID);
                      if (sidenav.isOpen() === show) return;
                      $scope.$apply(function () {
                          $scope.csopen = false;
                          sidenav.toggle().then(function () {
                              $log.debug('toggle ' + navID + ' is done');
                          });
                      });
                  }, 300);
                  return debounceFn;
              }

              function sortCards(cards) {
                  return cards.sort(function (card1, card2) {
                      var int1 = parseInt(card1.name, 10) || 0;
                      var int2 = parseInt(card2.name, 10) || 0;
                      if (int1 != int2) return int1 - int2;
                      return (card1.name || '').localeCompare(card2.name);
                  });
              }

              function generatePagePreview(page, body, unobtrusively) {
                  var done = $q.defer();

                  try {
                      var clone = clonePage(body);
                      var bodyContent = preparePreviewContent(clone);
                      $(body).hide();

                      screenshot(bodyContent).then(function (canvas) {
                          var pageName = $scope.updatedName;
                          return extractThumbnail(canvas, pageName);
                      }).catch(function (error) {
                          console.error(error);
                          logger.error('Unable to generate page thumbnail');
                          if (!unobtrusively) { return $q.reject(error); }
                          else { $timeout(done.resolve); }
                      }).finally(function () {
                          $(clone).remove();
                          $(body).show();
                      }).then(done.resolve, done.reject, done.notify);
                  }
                  catch (ex) {
                      if (!unobtrusively) { return $q.reject(error); }
                      else { $timeout(done.resolve); }
                  }

                  return done.promise;
              }

              function clonePage(pageBody) {
                  var $pageBody = $(pageBody);
                  var $clone = $pageBody.clone().appendTo($pageBody.parent());
                  $clone.attr('id', $clone.attr('id') + 'Preview');
                  return $clone;
              }

              function preparePreviewContent(body) {
                  var $body = $(body);

                  $body.find('.controls_wrapper').remove();
                  $body.find('.page.content').removeClass('open');
                  $body.scrollTop(0);

                  $scope.hideSidebars();

                  // reset background-size css property, because html2canvas can't handle them properly and leaves black areas
                  $body.find('*').filter(function () {
                      var styles = document.defaultView.getComputedStyle(this, null);
                      var backgroundSize = styles.getPropertyValue('background-size');
                      return backgroundSize != 'auto';
                  }).each(function () {
                      $(this).css('background-size', 'auto');
                  });

                  return $body.find('.page.content');
              }

              function screenshot(element) {
                  var done = $q.defer();

                  $timeout(function () {
                      done.notify({ progress: 0, status: 'Generating page preview image…' });
                  });

                  var $element = $(element);
                  var baseUrl = $location.protocol() + "://" + $location.host() + ":" + $location.port();

                  $timeout(function () {
                      done.notify({ progress: 5 });
                      html2canvas($element[0], {
                          height: 20000,
                          //logging: true,
                          useCORS: true,
                          proxy: baseUrl + '/proxy',
                          onrendered: function (canvas) {
                              done.notify({ progress: 30 });
                              done.resolve(canvas);
                          }
                      });
                  }, 1000);

                  return done.promise;
              }

              function extractThumbnail(canvas, filename) {
                  var done = $q.defer();

                  var maxWidth = 250;
                  var uniqueFileName = 'app/' + s3Storage.salt() + '-' + filename + '-thumb_' + maxWidth + '.jpg';
                  var thumbType = 'image/jpg';

                  var previewUrl = canvas.toDataURL(thumbType);
                  console.log('screenshot generated', previewUrl);

                  s3Storage.thumbnail(previewUrl, thumbType, maxWidth)
                      .then(function (thumbBuffer) {
                          done.notify({ progress: 35 });
                          return s3Storage.uploadOptimized(uniqueFileName, thumbBuffer, thumbType);
                      }).then(function (thumbUrl) {
                          done.notify({ progress: 42 });
                          $scope.newPage.preview = { thumbUrl: thumbUrl || null };
                          return thumbUrl;
                      }).then(done.resolve, done.reject);

                  return done.promise;
              }

              function savePageThumbnail(pageId, thumbUrl) {
                  var pagePreview = new Pages({ _id: pageId });
                  pagePreview.preview = { thumbUrl: thumbUrl || null };
                  return pagePreview.$update({ pageId: pageId });
              }

              function savePageDetails(pageId, details) {
                  var page = new Pages({ _id: pageId });
                  angular.extend(page, details);
                  return page.$update({ pageId: pageId });
              }
          }

         function resetBackgroundsAttachment() {
             $(document.querySelectorAll('#card8')).attr('style', function(i, style) {
                 // remove inline background-attachment css property
                 return style.replace(/background-attachment[^;]+;?/gi, '');
             });
         }

         function unionEntities(targetArr, arr1/*, ..., arrN*/) {
             targetArr = targetArr || [];

             var otherArrs = Array.prototype.slice.call(arguments, 1);
             otherArrs.forEach(function (arr) {
                 if (!arr) return;

                 var targetIds = _.pluck(targetArr, '_id');
                 var differentEntities = _.filter(arr, function (item) {
                     return !_.contains(targetIds, item._id);
                 });

                 differentEntities.forEach(function (item) { targetArr.push(item); });
             });
             return targetArr;
         }

         function saveKeyPressHandler(e) {
             // Ctrl+S or Command+S (for Mac) handler
             if (e.keyCode == 83 && (navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey)) {
                 e.preventDefault();
                 $scope.saveChanges();
             }
         }

         function closeCardSettingsBeforePopup() {
             $('.page.content').on('shown.bs.modal', function () {
                 if ($scope.csopen) {
                     $scope.csopen = false;
                     $scope.hideSidebars();
                     $scope.$digest();
                 }
             });
         }

         function ensureModalsClosed() {
             var done = $q.defer();

             var $body = $('#body');
             var $openModal = $body.find('.modal.in');
             if ($openModal.length) {
                 var publishOnce = function () {
                     $openModal.off('hidden.bs.modal', publishOnce);
                     done.resolve();
                 };
                 $openModal.on('hidden.bs.modal', publishOnce);
                 $openModal.modal('hide');
             }
             else {
                 done.resolve();
             }

             return done.promise;
         }

         function logEvent(type, metadata) {
             var logEntry = new Logs({
                 entryType: type,
                 user: $scope.me._id,
                 metadata: metadata
             });

             return logEntry.$save();
         }

         function resetDirtyPage($scope) {
             $scope.isPageDirty = false;
             if ($scope.page) {
                 delete $scope.page.saveWholePage;
             }
             _.each($scope.newPage && $scope.newPage.cards, function (card) {
                 delete card.changed;
             });
         }

         function markCardChanged(target) {
             var cardScope = angular.element($(target).closest('.card-container')[0]).scope();
             if (cardScope && cardScope.card) {
                 cardScope.card.changed = true;
             }
         }

         function enablePlugins(element) {
             // background video plugin
             if ($.fn.vide) {
                 $(element).find('[data-vide-bg]').each(function(i, element) {
                     var $element = $(element);
                     var options = $element.attr('data-vide-options');
                     var path = compactPairs($element.attr('data-vide-bg').split(','));

                     $element.vide(path, options);
                 });
             }
         }

         /**
          * Compact and normalize Vide plugin params, which are passed in one of the following formats:
          * 1) mp4: path/to/video1, webm: path/to/video2, ogv: path/to/video3, poster: path/to/poster
          * 2) path/to/video
          * @see https://github.com/VodkaBears/Vide#readme
          * @param strPairs
          * @returns {*} normalized Vide plugin params as string.
          */
         function compactPairs(strPairs) {
             var str = strPairs.join(',');
             var videParamsNumber = (str.replace(/https?:/g, '').match(/:/g) || []).length;
             if (videParamsNumber == 0) return str; // 1-param options

             var pairs = strPairs.map(function(keyValueStr) {
                 var arr = keyValueStr.split(':').map(function (str) { return str.trim(); });
                 return [arr[0], arr.slice(1).join(':')];
             });

             var result = _.filter(pairs, function(pair) { return pair[1] != ''; })
                 .map(function (pair) { return pair.join(': '); })
                 .join(', ');

             return result;
         }
     }
}());
