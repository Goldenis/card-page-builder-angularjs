(function () {
     "use strict";

     angular
          .module('pages')
          .controller('PagesController', PagesController);

          PagesController.$Inject = ['$scope', '$state', '$stateParams', '$location', 'Authentication', 'Pages', 'logger', 'appConfig', 'pagesHelper', 'cardData', '$q', '$timeout', '$cookieStore', '$mdDialog', 'Clients', 'clientHelper', '$filter', 'IntercomSvc'];

          function PagesController($scope, $state, $stateParams, $location, Authentication, Pages, logger, appConfig, pagesHelper, cardData, $q, $timeout, $cookieStore, $mdDialog, Clients, clientHelper, $filter, IntercomSvc) {
               var vm = this;
               vm.me = Authentication.user;
               vm.pageStatuses = appConfig.pageStatuses || [];
               vm.pageStatusesReverse = vm.pageStatuses.slice().reverse();
               vm.loadingProgress = 0;

               $scope.ui = {};

              $scope.$watchCollection('pages.pages', function (pages) {
                  vm.pagesByClients = groupByClients(pages);
                  _.keys(vm.pagesByClients).forEach(function (client) {
                      $scope.ui[client] = $scope.ui[client] || {};
                      $scope.ui[client].statusFilter = $scope.ui[client].statusFilter || 'Live';
                  });
               });

              $scope.$watch('view', function (view) {
                  $cookieStore.put('list-pages-view', view);
              });

               $scope.authentication = Authentication;

              vm.resetFilter = function (ui, status) {
                  if (ui && ui.statusFilter == status) {
                      $timeout(function () {
                          ui.statusFilter = null;
                          $scope.displayPages(ui);
                      });
                  }
              };

               vm.openDeleteModal = function (page) {
                    vm.selectedPage = page;
                    $('#deletePageModal').modal2('show');
               };

               vm.duplicatePage = function(oriPage) {
                   Pages.get({ pageId: oriPage._id, exclude: ['sourceCode', 'exportedCSS'] }).$promise.then(function (page) {
                       delete page._id;
                       page.name = getDuplicateName(page);
                       page.status = "Draft";
                       page.url = _.buildUrl(page.name);
                       page.path = _.buildUrl(page.name);

                       vm.selectedPage = oriPage;
                       vm.selectedPageDuplicate = page;

                       page.$save(function (page) {
                           var index = vm.pages.indexOf(oriPage) + 1;
                           vm.pages.splice(index, 0, page);
                           $('#duplicatePageSuccessModal').modal2('show');
                           refreshPages(oriPage.client);
                       }, function () {
                           logger.error('Error while adding page');
                       });
                   });
               };

              vm.editPage = function (page, confirmed, event) {
                  if (confirmed) {
                      $('#confirmEditingPageModal').modal2('hide');
                      Pages.editing({ pageId: $scope.pageId });
                      IntercomSvc.trackEvent('Clicked edit for page', {
                          article: {
                              value: page.client.companyName + ' | ' + page.name,
                              url: $state.href('editPage', { pageId: page._id }, { absolute: true })
                          }
                      });
                      openState('editPage', { pageId: page._id }, $scope.selectedPageEditEvent);
                      return;
                  }

                  $scope.selectedPage = page;
                  Pages.editingDetails({ pageId: page._id }).$promise.then(function (editing) {
                      editing = editing instanceof Array ? editing : [editing]; // backward compatibility to the old version

                      var otherUsersEditing = _.filter(editing, function (e) { return e.user != vm.me._id; });
                      $scope.selectedPageEditingUsers = _.pluck(_.pluck(otherUsersEditing, 'user'), 'displayName');

                      if ((editing || []).length && otherUsersEditing.length) { // another user editing
                          $scope.selectedPageEditEvent = event;
                          $('#confirmEditingPageModal').modal2('show');
                      }
                      else {
                          openState('editPage', { pageId: page._id }, event);
                      }
                  });
              };

               vm.deletePage = function (page) {
                    var index = vm.pages.indexOf(page);
                    page.$remove({pageId:page._id}, function () {
                        IntercomSvc.trackEvent('Deleted page', {
                            article: page.client.companyName + ' | ' + page.name
                        });
                    });
                    vm.pages.splice(index, 1);
                    $('#deletePageModal').modal2('hide');
                    logger.success('Page deleted');
                    refreshPages(page.client);
               };

               vm.changeStatus = function (page, status, confirmed) {
                   var $dialog = $(confirmDialog(status));
                   if (!confirmed && $dialog.length) {
                       vm.selectedPage = page;
                       $dialog.modal2('show');
                   }
                   else {
                       vm.updateStatus(page, status);
                       $dialog.modal2('hide');
                   }
               };

              vm.updateStatus = function (page, status) {
                  var done = $q.defer();

                  $timeout(function () {
                      done.notify({ progress: 5, status: 'Building page...' });
                  });

                  var prevStatus = page.status;
                  page.status = status || page.status;
                  page.publishPending = false;
                  vm.exportPage = page.status == 'Live' || page.status == 'Preview' ? done.promise : null;

                  var fakeProgress = $timeout(function () {
                      done.notify({ progress: 10 });
                  }, 3000);

                  Pages.update({pageId: page._id}, page)
                      .$promise
                      .then(function (updatedPage) {
                          $timeout.cancel(fakeProgress);
                          if (updatedPage.status == "Live" || updatedPage.status == "Preview") {
                              done.notify({progress: 20});
                              cardData.getPage(page._id).$promise.then(function (res) {
                                  done.notify({progress: 40});
                                  $scope.newPage = res;
                                  pagesHelper.exportListPage($scope, updatedPage.status).then(function () {
                                      var client = clientHelper.getClientByName(vm.clients, updatedPage.client.companyName);
                                      var pageUrl = _.absPageUrl(updatedPage, client);
                                      var pageTitle = updatedPage.client.companyName + ' | ' + updatedPage.name;
                                      IntercomSvc.trackEvent('Published page', {
                                          article: pageUrl.match(/^https?:/i)
                                              ? { value: pageTitle, url: pageUrl }
                                              : pageTitle,
                                          status: updatedPage.status,
                                          previous_status: prevStatus
                                      });
                                  }).then(done.resolve, done.reject, done.notify);
                              });
                          }
                          else {
                              logger.info('Status set to: ' + updatedPage.status);
                              done.resolve();
                          }

                          refreshPages(updatedPage.client, true);
                      })
                      .catch(function () {
                          logger.info('Error updating page status');
                      })
              };

              vm.publishPages = function (ui, clientName, pages) {
                  ui[clientName].publishing = true;
                  var client = clientHelper.getClientByName(vm.clients, clientName);
                  return pagesHelper.publishPages(client, pages).then(function () {
                      logger.success('Pages have been published successfully');
                      $scope.ui[clientName].publishPending = isPublishPending(clientName, vm.pagesByClients[clientName]);
                  }).catch(function (err) {
                      logger.error('Error publishing the pages');
                  }).finally(function () {
                      ui[clientName].publishing = false;
                  });
              };

              var _searchField = $filter('searchField');
              var _filter = $filter('filter');

              $scope.displayPages = function (ui, skipReorder) {
                  var clientName = _.findKey($scope.ui, function(clientUi) { return clientUi == ui; });
                  var clientPages = vm.pagesByClients[clientName];

                  var result = clientPages.slice(); // shallow copy
                  result = ui.statusFilter ? _.where(result, { status: ui.statusFilter }) : result;
                  result = _searchField(result, 'name', 'tagsStr');
                  result = _filter(result, ui.search);

                  var filteredBeforeTags = result.slice(); // shallow copy
                  result = filterByTags(result, _.where(ui.tags, { checked: true }));

                  // extend ui properties

                  if (!skipReorder) {
                      result = sortPages(result);
                      vm.pagesByClients[clientName] = sortPages(vm.pagesByClients[clientName]);
                  }

                  ui.pages = result;
                  ui.tags = extractClientTags(clientPages, ui.tags);
                  ui.publishPending = isPublishPending(clientName, clientPages);

                  var groupedByStatus = _.countBy(clientPages, 'status');
                  ui.countsByStatus = _.object(vm.pageStatuses, vm.pageStatuses.map(function (status) {
                      return groupedByStatus[status] || 0;
                  }));

                  var groupedByTextTags = filteredBeforeTags.map(function (page) {
                      return { page: page, tags: resolveTextTags(page.tags) };
                  });

                  var clientTextTags = _.chain(clientPages).pluck('tags').map(resolveTextTags).flatten().uniq().value();

                  ui.countsByTags = _.object(clientTextTags, clientTextTags.map(function (tag) {
                      return _.filter(groupedByTextTags, function (pt) { return _.contains(pt.tags, tag); }).length;
                  }));

                  return result;
              };

              $scope.saveStatusFilter = function (ui) {
                  var statusFilters = _.map(ui, function(ui, client) {
                      return client + ':' + (ui.statusFilter || '');
                  }).join('__');
                  $cookieStore.put('list-pages-status-filters', statusFilters);
              };

              $scope.resolveTextTag = resolveTextTag;

              // Create new Page
               $scope.create = function() {
                    // Create new Page object
                    var page = new Pages ({
                         name: this.name,
                         content: this.content
                    });

                    // Redirect after save
                    page.$save(function(response) {
                         $location.path('pages/' + response._id);

                         // Clear form fields
                         $scope.name = '';
                    }, function(errorResponse) {
                         $scope.error = errorResponse.data.message;
                    });
               };

               // Remove existing Page
               $scope.remove = function(page) {
                    if ( page ) {
                         page.$remove();

                         for (var i in $scope.pages) {
                              if ($scope.pages [i] === page) {
                                   $scope.pages.splice(i, 1);
                              }
                         }
                    } else {
                         $scope.page.$remove(function() {
                              $location.path('pages');
                         });
                    }
               };

               // Update existing Page
               $scope.update = function() {
                    var page = $scope.page;

                    page.$update(function() {
                         $location.path('pages/' + page._id);
                    }, function(errorResponse) {
                         $scope.error = errorResponse.data.message;
                    });
               };

               // Find existing Page
               $scope.findOne = function() {
                    $scope.page = Pages.get({
                         pageId: $stateParams.pageId
                    });
               };

               $scope.getFirstNameOfUpdateHistory = function(user) {
                    return (user || '').split(" ")[0];
               };

              $scope.statusAction = function (status) {
                  switch (status) {
                      case 'Live': return 'Publish this Page';
                      case 'Preview': return 'Publish this Page to Beta';
                      case 'Closed': return 'Close this Page';
                      default: return status + ' this Page';
                  }
              };

              $scope.normalizePageUrl = function (page) {
                  var url = (page.path || page.url || _.buildUrl(page.name)).replace(/^\/|\/$/g, '');
                  return url;
              };

              $scope.statusCode = function (status) {
                  return (status || '').toLowerCase();
              };

              $scope.lastUpdate = function (page) {
                  return _.last(page.updateHistory) || {};
              };

              $scope.calculateGridRows = function (page, event, retry) {
                  var $tile = $(event.target).closest('.page-container');
                  var $page = $tile.find('.page');
                  var $title = $tile.find('.page-title');

                  var width = $page.width();

                  if (!width && !retry) {
                      $timeout(function () {
                          $scope.calculateGridRows(page, event, true);
                      }, 200);
                  }

                  var height = $page.height() + $title.height();

                  // magic 8 is empirical number to preserve width/height ratio (roughly), depends on md-row-height="10:1"
                  page.rowspan = Math.ceil(height / (width  || Infinity) * 8) + 1;
              };

              $scope.editPageSettings = function (ev, page) {
                  openPageEditor(ev, page).then(function (details) {
                      var savingPage = new Pages(angular.copy(page));

                      // lookup for existing tags and avoid case sensitive duplicates
                      var clientTags = _.chain(vm.pagesByClients[savingPage.client.companyName]).pluck('tags').flatten().compact().uniq(resolveTextTag).value();
                      details.tags = details.tags && details.tags.map(function (tag) {
                          var textTag = resolveTextTag(tag);
                          return clientTags.find(function(ctag) { return textTag == resolveTextTag(ctag); }) || tag;
                      });

                      angular.extend(savingPage, details);

                      savingPage.$update({ pageId: savingPage._id })
                          .then(function () {
                              var oldClient = (page.client || {}).companyName;
                              var oldTags = resolveTextTags(page.tags);

                              angular.extend(page, details);

                              // if page client changed, move it to the very beginning of new client list
                              var newClient = (details.client || {}).companyName;
                              if (oldClient != newClient) {
                                  removeItem(vm.pagesByClients[oldClient], page);
                                  vm.pagesByClients[newClient].unshift(page);
                              }

                              // refresh client tags if page tags changed, affects all clients since page client can be changed
                              var newTags = resolveTextTags(details.tags);
                              if (_.difference(oldTags, newTags).length > 0 || _.difference(newTags, oldTags).length > 0) {
                                  refreshPages(null, true);
                              }

                              // refresh publish pending flag
                              if (page.publishPending) {
                                  if (!$scope.ui[newClient].publishPending) {
                                      $scope.ui[newClient].publishPending = isPublishPending(newClient, page);
                                  }
                                  if (!$scope.ui[oldClient].publishPending) {
                                      $scope.ui[oldClient].publishPending = isPublishPending(oldClient, page);
                                  }
                              }

                              logger.success('Saved page settings');
                          })
                          .catch(function (err) {
                              logger.error('Error saving page settings: ' + (err.data.message || ''));
                          });
                  });
              };

              $scope.createNewPage = function (ev, client) {
                  var userClients = _.unionItems(vm.me.clients, vm.me.client);
                  if (!client && userClients.length == 1) {
                      client = clientHelper.getClientByName(vm.clients, userClients[0]);
                  }

                  var page = new Pages({ client: client, user: vm.me, created: new Date() });
                  openPageEditor(ev, page, !client).then(function (details) {
                      var edit = details.autoedit;
                      angular.extend(page, details);
                      delete page.autoedit;
                      page.$save().then(function (page) {
                          logger.success('Created new page');

                          if (edit) {
                              $state.go('editPage', {pageId: page._id});
                          }
                          else {
                              vm.pagesByClients[page.client.companyName].unshift(page);
                              vm.pages.unshift(page);

                              if (page.tags && page.tags.length) {
                                  _.each(vm.pagesByClients, extractClientTags);
                              }

                              refreshPages(client, true);
                          }
                      }).catch(function (err) {
                          logger.error('Error creating new page: ' + (err.data.message || ''));
                      });
                  });
              };

              $scope.filterClientPages = function (client) {
                  if (client != $scope.selectedClient) {
                      var clientName = client ? client.companyName : null;
                      $scope.selectedClient = clientName;
                      $cookieStore.put('list-pages-client', clientName);
                  }
              };

              init();

              function init() {
                  var loadingTimer = $timeout(function timer() {
                      vm.loadingProgress = Math.min(vm.loadingProgress + 15, 65);
                      loadingTimer = $timeout(timer, 150 + Math.round(Math.random() * 150));
                  }, 200);

                  vm.loadingProgress = 20;
                  $scope.view = $cookieStore.get('list-pages-view') || 'Tiles';
                  $scope.selectedClient = $cookieStore.get('list-pages-client') || null;

                  // parse out selected status filters from cookies
                  ($cookieStore.get('list-pages-status-filters') || '').split('__').forEach(function (str) {
                      var pair = str.split(':');
                      var client = pair[0];
                      $scope.ui[client] = $scope.ui[client] || {};
                      $scope.ui[client].statusFilter = pair[1];
                  });

                  var pageIdle = $timeout(function () {
                      $('#pageIdleModal').modal2('show');
                  }, 12000);

                  $timeout(function () {
                      var clients = Clients.query().$promise;
                      var pages = Pages.query({ exclude: ['cards', 'sourceCode', 'exportedCSS'] }).$promise;

                      $q.all([clients, pages]).then(function (responses) {
                          $timeout.cancel(pageIdle);
                          $timeout.cancel(loadingTimer);
                          vm.loadingProgress = 70;

                          $timeout(function () {
                              vm.clients = vm.me.role != 'client' ? responses[0] : _.filter(responses[0], function(client) { return _.contains(_.unionItems(vm.me.clients, vm.me.client), client.companyName); });
                              vm.clients = _.sortBy(vm.clients, 'companyName');

                              if (!_.some(vm.clients, function(client) { return client.companyName == $scope.selectedClient; })) {
                                  $scope.selectedClient = null;
                              }

                              if(vm.me.role === 'admin') vm.pages = responses[1];
                              if(vm.me.role === 'client') vm.pages = pagesHelper.filterOnlyClientPages(responses[1], _.unionItems(vm.me.clients, vm.me.client));

                              vm.pages = sortPages(vm.pages);

                              vm.loadingProgress = 100;
                              $timeout(function () { vm.loadingDone = true; });
                          });
                      });
                  });
              }

              function sortPages(pages) {
                  return (pages || []).sort(function (page1, page2) {
                      var diff;

                      diff = (page1.client && page1.client.companyName || '').localeCompare(page2.client && page2.client.companyName);
                      if (diff) return diff;

                      diff = vm.pageStatuses.indexOf(page1.status) - vm.pageStatuses.indexOf(page2.status);
                      if (diff) return diff;

                      diff = (page1.name || '').trim().toLowerCase().localeCompare((page2.name || '').trim().toLowerCase());
                      return diff;
                  });
              }

              function groupByClients(pages) {
                  var result = _.groupBy(pages, function(p) { return p.client && p.client.companyName; });

                  // add empty arrays for clients without pages (missing in result)
                  var clients = _.pluck(vm.clients, 'companyName');
                  var missingClients = _.without.apply(clients, [clients].concat(_.keys(result)));
                  missingClients.forEach(function (client) { result[client] = []; });

                  return result;
              }

              function confirmDialog(status) {
                  switch (status) {
                      case 'Live': return $('#publishPageModal');
                      case 'Preview': return $('#previewPageModal');
                      case 'Draft': return $('#draftPageModal');
                      case 'Closed': return $('#closePageModal');
                  }
              }

              function extractClientTags(clientPages, restoreTags) {
                  var checkedTextTags = restoreTags ? resolveTextTags(_.where(restoreTags, { checked: true })) : [];

                  var clientTags = _.chain(clientPages).pluck('tags').flatten().compact()
                      .uniq(function (tag) { return (tag.text || '').toLowerCase(); })
                      .sortBy('text').value();

                  clientTags = clientTags.map(function (tag) {
                      delete tag.checked;
                      if (_.contains(checkedTextTags, resolveTextTag(tag))) {
                          tag.checked = true;
                      }
                      return tag;
                  });

                  clientPages.forEach(function (page) {
                      // used in search filter expression
                      page.tagsStr = resolveTextTags(page.tags).join(',');
                  });

                  return clientTags;
              }

              function openPageEditor(ev, page, selectClient) {
                  var dialogScope = $scope.$new();
                  dialogScope.page = page;
                  dialogScope.pagesList = $q.when(vm.pages);
                  dialogScope.clients = vm.clients;
                  dialogScope.selectClient = selectClient || vm.me.role === 'admin';
                  return $mdDialog.show({
                      templateUrl: 'modules/pages/views/page-settings-dialog.client.view.html',
                      controller: 'PageSettingsEditorController',
                      scope: dialogScope,
                      parent: angular.element(document.body),
                      targetEvent: ev,
                      clickOutsideToClose: true,
                      focusOnOpen: false
                  });
              }

              function getDuplicateName(page) {
                  var names = _.pluck(vm.pages, 'name');

                  // unique
                  var duplicateName = "COPY - " + page.name;
                  if (!_.contains(names, duplicateName)) {
                      return duplicateName;
                  }

                  // increment
                  for (var i = 0; i < 100; i++) {
                      duplicateName = "COPY" + (i+2) + " - " + page.name;

                      // unique
                      if (!_.contains(names, duplicateName)) {
                          return duplicateName;
                      }
                  }

                  return duplicateName;
              }

              function removeItem(arr, item) {
                  var index = (arr || []).indexOf(item);
                  if (index == -1) return false;
                  arr.splice(index, 1);
                  return true;
              }

              function openState(name, params, event) {
                  var openNewTab = event && navigator.platform.match('Mac') ? event.metaKey : event.ctrlKey;
                  if (openNewTab) {
                      var url = $state.href(name, params);
                      window.open(url, openNewTab ? '_blank' : '_self');
                  }
                  else {
                      $state.go(name, params);
                  }
              }

              function refreshPages(client, skipReorder) {
                  $timeout(function () {
                      if (client) {
                          $scope.displayPages($scope.ui[client.companyName || client], skipReorder);
                      }
                      else {
                          _.values($scope.ui).forEach(function (ui) {
                              $scope.displayPages(ui, skipReorder);
                          });
                      }
                  });
              }

              function filterByTags(pages, tags) {
                  var filterTags =  resolveTextTags(_.isArray(tags) ? tags : _.toArray(arguments));
                  if (!filterTags.length) return pages;
                  var result = _.filter(pages, function (page) {
                      var pageTags = resolveTextTags(page.tags);
                      var filtered = _.intersection(pageTags, filterTags).length == filterTags.length;
                      return filtered;
                  });
                  return result;
              }

              function resolveTextTags(tags) {
                  var texts = _.chain(tags).pluck('text').compact().map(function(t) { return t.toLowerCase().trim(); }).uniq().value();
                  return texts;
              }

              function resolveTextTag(tag) {
                  return (tag.text || '').toLowerCase().trim();
              }

              function isPublishPending(client, pages) {
                  client = clientHelper.getClientByName(vm.clients, client) || client;
                  pages = pages instanceof Array ? pages : _.toArray(arguments).slice(1);
                  return pagesHelper.getPublishPendingPages(client, pages).length > 0;
              }
          }
}());
