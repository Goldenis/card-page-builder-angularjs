(function () {
     'use strict';

     angular
          .module('pages')
          .factory('pagesHelper', pagesHelper);

     pagesHelper.$inject = ['$http', 'logger', '$parse', '$compile', '$state', 'cardData', '$rootScope', '$timeout', 'Pages', 'Authentication', '$q', 'Cards', 'cardsHelper', 'pagesHtmlHelper', 'editorService'];

     function pagesHelper($http, logger, $parse, $compile, $state, cardData, $rootScope, $timeout, Pages, Authentication, $q, Cards, cardsHelper, pagesHtmlHelper, editorService) {
         var handleConflicts = pagesHtmlHelper.handleConflicts;

          var service = {
               setHeaderFooter: setHeaderFooter,
               getCardByName: getCardByName,
               getActions: getActions,
               adoptPageDataStructure:adoptPageDataStructure,
               filterOnlyClientPages: filterOnlyClientPages, //(@param1: ARRAY of pages,  @params2: client name STRING )
               adoptPagesDataStructure: adoptPagesDataStructure,
               updatePageBuilder: updatePageBuilder,
               resetPageBuilder: resetPageBuilder,
               exportPageBuilder: exportPageBuilder,
               exportListPage: exportListPage,
               publishPages: publishPages,
               getPublishPendingPages: getPublishPendingPages
          };

          return service;

          function updatePageBuilder(scope) {
               var done = $q.defer();

               if (scope.page.status == 'Live' || scope.page.status == "Preview") {
                   scope.exportPage().then(done.resolve, done.reject, done.notify);
                   return done.promise;
               }

              done.notify({ progress: 0, status: 'Saving page...' });

               $timeout(safe(done, function () {
                   var memento = resetActions(scope.newPage);
                   done.promise.finally(memento.restore);

                   stabilize(scope).then(safe(done, function () {
                       done.notify({ progress: 37 });
                       $timeout(safe(done, function () {
                           scope.savingPage = true;
                           scope.newPage.client = scope.selectedClient || scope.client;
                           scope.newPage.name = scope.updatedName;
                           scope.newPage.url = scope.updatedUrl;
                           scope.newPage.tags = (scope.page || scope.newPage).tags;
                           if (!scope.newPage.updateHistory)scope.newPage.updateHistory = scope.page && scope.page.updateHistory || [];
                           scope.newPage.updateHistory.push({date: new Date(), user: scope.me.displayName});

                           var fakeProgress = $timeout(function () {
                               done.notify({ progress: 70 });
                           }, 5000);

                           savePage(scope.newPage, scope.page).then(function (page) {
                               $timeout.cancel(fakeProgress);
                               done.notify({ progress: 100, status: 'Saved page.' });

                               $timeout(function () {
                                   logger.success("Page updated successfully");
                                   done.resolve(page);
                               });
                           }).catch(function (err) {
                               done.reject('Error updating page' + prefix(': ', requestErrorMessage(err)));
                           });
                       }, 1000));
                   }));
               }));

              return done.promise;
          }

         function resetPageBuilder(scope) {
             scope.isPageDirty = false;
             scope.vleavePage = true;
             $state.go('listPages');
         }

          function exportListPage(scope, status) {
              var done = $q.defer();

              $timeout(safe(done, function () {

                  Pages.get({ pageId: scope.newPage._id }).$promise.then(function (page) {

                       var html_dom = document.createElement("div");
                       html_dom.setAttribute("id", "export_sortable2");
                       html_dom.setAttribute("class", "connectedSortable page-builder-preview ui-sortable");

                       scope.clonedPage = new Pages(angular.copy(scope.newPage));
                       _.each(scope.clonedPage.cards, function (card) {
                           emptyDefaultActions(card);
                           card.html = cardsHelper.cleanUpCardHtml(card.html);
                       });

                       var compiledContent = [];
                       var count = 0;
                       for ( var i = 0; i < scope.clonedPage.cards.length; i++) {
                            var content = '<div new-card="" card="clonedPage.cards[' + i + ']" index="' + i + '"></div>';
                            compiledContent.push(compileHtml(content, scope));

                            $timeout(safe(done, function() {
                                 var card_dom = document.createElement('div');
                                 var dom = jQuery(compiledContent[count]);
                                 var domHtml = cleanUpHtml(dom);
                                 $(card_dom).html(domHtml);
                                 html_dom.appendChild(card_dom);
                                 count++;
                                 if ( count == scope.clonedPage.cards.length) {
                                      jQuery(html_dom).find('[contenteditable="true"]').each(function() {
                                           $(this).attr('contenteditable', 'false');
                                      });

                                      jQuery(html_dom).each(function(index) {
                                           $(this).attr('value', $(this).val());
                                      });
                                      jQuery(html_dom).each(function(index) {
                                           $(this).val($(this).val());
                                      });
                                      //var exportCSS = '#export_sortable2{padding:0px;float:left;width:100%;margin:0px;}li{list-style: outside none none;border: 0px none;}';
                                      var exportCSS = '';

                                      var exportString = html_dom.innerHTML;

                                      $timeout(safe(done, function () {
                                           scope.savingPage = true;

                                           var eDom = document.createElement('body');
                                           eDom.innerHTML = exportString;

                                           jQuery(eDom).find("style").each(function(index) {
                                                exportCSS += jQuery(this).get(0).innerHTML;
                                           });
                                           jQuery(eDom).find("style").remove();
                                           scope.newPage.sourceCode = jQuery(eDom).get(0).outerHTML;
                                           scope.newPage.exportedCSS = exportCSS;
                                           if (!scope.newPage.updateHistory)scope.newPage.updateHistory = scope.page && scope.page.updateHistory || [];
                                           scope.newPage.updateHistory.push({date: new Date(), user: Authentication.user.displayName});

                                          var memento = resetActions(scope.newPage);
                                          done.promise.finally(memento.restore);

                                          stabilize(scope).then(function () {
                                              $timeout(safe(done, function() {
                                                  done.notify({progress: 70, status: 'Syncing files with your server...'});
                                                  savePage(scope.newPage, scope.page).then(safe(done, function (page) {

                                                      done.notify({progress: 90, status: 'Completing update...'});

                                                      publishPages(scope.newPage.client, [page]).then(function(res) {
                                                          $timeout(done.resolve);
                                                      }).catch(function (response) {
                                                          $timeout(done.resolve);
                                                          console.warn(response);
                                                      });
                                                  }));
                                              }), 1000);
                                          });
                                      }))
                                 }
                            }), 1000);

                       }
                       console.log(compiledContent);

                   })
              }));

              return done.promise;
          }

          function exportPageBuilder(scope) {
              var done = $q.defer();

              $timeout(safe(done, function () {

               var html_dom = document.createElement("div");
               html_dom.setAttribute("id", "export_sortable2");
               html_dom.setAttribute("class", "connectedSortable page-builder-preview ui-sortable");
               var count = 0;
               var compiledContent = [];
               scope.clonedPage = new Pages(angular.copy(scope.newPage));
               _.each(scope.clonedPage.cards, function (card) {
                   emptyDefaultActions(card);
                   card.html = cardsHelper.cleanUpCardHtml(card.html);
               });

               for ( var i = 0; i < scope.clonedPage.cards.length; i++) {
                    var content = '<div new-card="" card="clonedPage.cards[' + i + ']" index="' + i + '"></div>';
                    compiledContent.push(compileHtml(content, scope));

                    $timeout(safe(done, function(){
                         var card_dom = document.createElement('div');
                         var dom = jQuery(compiledContent[count][0]);
                         jQuery(dom).find('#masterslider').css('margin', '0px');
                         var domHtml = cleanUpHtml(dom);
                         $(card_dom).html(domHtml);
                         count++;
                         html_dom.appendChild(card_dom);
                         if ( count == scope.clonedPage.cards.length) {
                              jQuery(html_dom).find('[contenteditable="true"]').each(function() {
                                   $(this).attr('contenteditable', 'false');
                              });

                              jQuery(html_dom).each(function(index) {
                                   $(this).attr('value', $(this).val());
                              });
                              jQuery(html_dom).each(function(index) {
                                   $(this).val($(this).val());
                              });
                              //var exportCSS = '#export_sortable2{padding:0px;float:left;width:100%;margin:0px;}li{list-style: outside none none;border: 0px none;}';
                              var exportCSS = '';

                              var exportString = html_dom.innerHTML;

                              $timeout(safe(done, function () {
                                   scope.savingPage = true;
                                   scope.newPage.client = scope.selectedClient || scope.client;
                                   scope.newPage.name = scope.updatedName;
                                   scope.newPage.url = scope.updatedUrl;
                                   var eDom = document.createElement('body');
                                   eDom.innerHTML = exportString;

                                   jQuery(eDom).find("style").each(function(index) {
                                        exportCSS += jQuery(this).get(0).innerHTML;
                                   });
                                   jQuery(eDom).find("style").remove();
                                   scope.newPage.sourceCode = jQuery(eDom).get(0).outerHTML;
                                   scope.newPage.exportedCSS = exportCSS; 
                                   if (!scope.newPage.updateHistory)scope.newPage.updateHistory = scope.page && scope.page.updateHistory || [];
                                   scope.newPage.updateHistory.push({date: new Date(), user: scope.me.displayName});

                                  var memento = resetActions(scope.newPage);
                                  done.promise.finally(memento.restore);

                                  stabilize(scope).then(function () {
                                      $timeout(safe(done, function () {
                                          done.notify({ progress: 47, status: 'Saving page...' });
                                          var fakeProgress = $timeout(function () {
                                              done.notify({ progress: 60 });
                                          }, 5000);

                                          savePage(scope.newPage, scope.page).then(safe(done, function (page) {
                                               $timeout.cancel(fakeProgress);
                                               done.notify({ progress: 80, status: 'Completing update...' });

                                               publishPages(scope.newPage.client, [page]).then(function(res) {
                                                   $timeout(done.resolve);
                                               }).catch(function (response) {
                                                   $timeout(done.resolve);
                                                   console.warn(response);
                                               });
                                           })).catch(function (err) {
                                               done.reject('Error updating page' + prefix(': ', requestErrorMessage(err)));
                                           });
                                      }), 1000);
                                  });
                              }));
                         }
                    }), 1000);
                 }
              }));

              return done.promise;
          }

          function filterOnlyClientPages(allPages, clientName) {
               if (clientName instanceof Array) {
                   return _.flatten(_.map(clientName, function(client) { return filterOnlyClientPages(allPages, client); }));
               }

               var filteredPages = _.filter(allPages, function (n) {
                    return n.client && n.client.companyName === clientName;
               });
               return filteredPages || [];
          }

          function getActions(variables) {
               var actions = [];
               if (variables == undefined)
                    return;
               for (var i = 0; i < variables.length; i += 1) {
                    var temp = {};
                    if(variables[i].kind !== 'File' && variables[i].kind !== 'Video') {
                         if(variables[i].value)var valuesLength = variables[i].value.length;
                         valuesLength > 1 ? temp[variables[i].shortCode] = '{{' + variables[i].shortCode + '}}' : temp[variables[i].shortCode] = variables[i].value;
                    }
                    else {
                         //temp[variables[i].shortCode] = variables[i].value || 'https://placeholdit.imgix.net/~text?txtsize=30&txt=height%20%C3%97%20width%20&w=200&h=150';
                         temp[variables[i].shortCode] = variables[i].value || '';
                    }
                    actions.push(temp);
               }
               return actions;
          }

         function publishPages(client, pages) {
             var pendingPages = getPublishPendingPages(client, pages);
             var pendingStatuses = _.chain(pendingPages).pluck('status').compact().uniq().value();

             var pro_refreshUrl = client.production_refresh_url || '';
             var beta_refreshUrl = client.beta_refresh_url || '';

             var requests = pendingStatuses.map(function(status) {
                 var pages = _.where(pendingPages, { status: status });

                 var published;
                 if (status == 'Live' && pro_refreshUrl != '') {
                     published = $http.post(pro_refreshUrl);
                 } else if (status == 'Preview' && beta_refreshUrl != '') {
                     published = $http.post(beta_refreshUrl);
                 }

                 return $q.when(published).then(function () {
                     if (!published) return; // endpoint not configured - skip
                     return Pages.markAsPublished({ status: status }, _.pluck(pages, '_id')).$promise.then(function () {
                         pages.forEach(function (page) { page.publishPending = false; });
                     });
                 }).catch(function (err) {
                     console.error('Error while publishing pages in status ' + status, err);
                     return $q.reject(err);
                 });
             });

             return $q.all(requests);
         }

         function getPublishPendingPages(client, pages) {
             var pendingPages = _.where(pages, { publishPending: true });
             var pendingStatuses = _.chain(pendingPages).pluck('status').compact().uniq().value();

             var pro_refreshUrl = client.production_refresh_url || '';
             var beta_refreshUrl = client.beta_refresh_url || '';

             var pendingPages = _.chain(pendingStatuses).map(function (status) {
                 if (status != 'Live' && status != 'Preview') return [];
                 if (status == 'Live' && pro_refreshUrl == '') return [];
                 if (status == 'Preview' && beta_refreshUrl == '') return [];
                 return _.where(pendingPages, { status: status });
             }).flatten().compact().value();

             return pendingPages;
         }

         /*
         adopting data for saving pages, removing unnecessary things from card object, adding actions
          */
          function adoptPageDataStructure(card) {
               delete card.__v; delete card.activeImage; delete card.cardStatus; delete card.claimedBy;
               delete card.timelog; delete card.less; delete card.notes; delete card.user; delete card.cardsOrder;
               if (card.images.length){ var image = card.images[0].thumbUrl || card.images[0].url }
               card.displayImage = image || 'http://developer-agent.com/wp-content/uploads/2015/05/images_no_image_jpg3.jpg';
               card.actions = getActions(card.variables);
               return card;
          }

     function adoptPagesDataStructure(cards) {
          for (var i = 0; i < cards.length; i += 1) {
               cards[i] = adoptPageDataStructure(cards[i]);
          }
               return cards;
          }

          function getCardByName(cards, name) {
               for (var i in cards) {
                    if (cards[i] && cards[i].cardName === name) {
                         var result = [cards[i], i];
                         return result;
                    }
               }
               return false;
          }

          function setHeaderFooter(clients, admin) {
               var appended = false;
               if (clients) {
                    if (admin && appended) {
                         $('#clientFooter').empty();
                         $('#clientHeader').empty();
                         $('#clientFooter').append(handleConflicts(clients.footer));
                         $('#clientHeader').append(handleConflicts(clients.header));
                         logger.info('Setting ' + clients.companyName + ' header & footer');
                    }
                    if (!appended) {
                         $('#clientFooter').append(handleConflicts(clients.footer));
                         $('#clientHeader').append(handleConflicts(clients.header));
                         logger.info('Setting ' + clients.companyName + ' header & footer');
                         appended = true;
                    }
               } else {
                    $('#clientFooter').empty();
                    $('#clientHeader').empty();
                    logger.info('Removing header & footer');
               }
          }

         function resetActions(page) {
             page.cards.forEach(function (card) {
                 card._actions = angular.copy(card.actions);

                 card.html = cardsHelper.compileCardHtml(card.html, card);

                 cardData.resetScopeVariables(card);

                 // duplicates resetScopeVariables?
                 _.each(card.actions, function (action) {
                     if (action != undefined) {
                         var key = Object.keys(action)[0];
                         action[key] = '{{'+key+'}}';
                     }
                 });

                 $('[data-vide-bg]').each(function() {
                     var instance = $.data(this, 'vide');
                     if (instance) instance.destroy();
                 });
             });

             // #warning apply reset variables (like {{target_url}}) before saving the page html.
             // otherwise variables will become broken (not bindable) on page refresh.
             $rootScope.$emit('updateCardHtml');

             return {
                 restore: function () {
                     $timeout(function() {
                        $rootScope.$emit('updateCardHtml');
                     });
                     $timeout(function () {
                         $rootScope.$emit('updateCardHtml'); // restore vide plugins
                     }, 1500);

                     page.cards.forEach(function (card) {
                         _.each(card._actions || card.tempActions, function (value, key) {
                             card.actions[key] = value;
                         });
                     });

                     card.html = cardsHelper.assembleCardHtml(card.html);
                 }
             };
         }

         function safe(defer, fn) {
             return function() {
                 try {
                     return fn.apply(this, arguments);
                 }
                 catch (ex) {
                     defer.reject(ex);
                 }
             };
         }

         function cleanUpHtml(dom) {
             var $dom = jQuery(dom);
             $dom.find('.controls_wrapper').remove();
             $dom.find('.custom-modal').remove();
             $dom.find('#clientHeader').remove(); // don't copy client header, just reference it to avoid versioning problems.
             $dom.find('.modal').removeClass('in').css({ display: 'none' }); // hide bootstrap modals (if any)
             $dom.find('.repeat-variable>template').remove();
             $dom.find('.repeat-variable>item').contents().unwrap();
             $dom.find('.repeat-variable').contents().unwrap();
             $dom.html(editorService.cleanUpHtml($dom));

             // remove target hash synthetic query param (used for "Open in New Window" feature).
             $dom.find('a[href][target]').each(function () {
                 var url = $(this).attr('href');
                 var newUrl = url.replace(/#.*/, ''); // remove target hash
                 $(this).attr('href', newUrl);
             });

             var cleanIds = ['export_sortable', 'export_sortable2', 'sortable', 'sortable2'];
             cleanIds.forEach(function (id) {
                 $dom.find('#' + id).removeAttr(id);
             });

             var cleanClassRegex = /^ng-/i;
             $dom.find('*').add($dom).each(function () {
                 var foundClasses = _.filter(this.classList, function (cl) {
                     return cl.match(cleanClassRegex);
                 });
                 if (!foundClasses.length) return;
                 var $element = $(this);
                 foundClasses.forEach(function (cl) {
                     $element.removeClass(cl);
                 });
             });

             var cleanAttrRegex = /^(ng|md)-/i;
             $dom.find('*').add($dom).each(function () {
                 var foundAttrs = _.filter(this.attributes, function (attr) {
                     return attr.name.match(cleanAttrRegex);
                 });
                 if (!foundAttrs.length) return;
                 var $element = $(this);
                 foundAttrs.forEach(function (attr) {
                     $element.removeAttr(attr.name);
                 });
             });

             var html = $dom.html();
             html = html.replace(/<script class="">setTimeout\(function\(\) {  }, 1\)<\/script>/gi, '');
             //html = html.replace(/{{[^}]+}}\s*/gi, ''); // strip {{xxxxxxx}} bindings out

             // formatting
             html = html.replace(/(class|id)="\s*"\s*/gi, ''); // remove empty class
             html = html.replace(/class="([^"]*)"/gi, function(match, capture) {
                 return 'class="' + (capture || '').trim() + '"'; // trim class string
             });
             html = html.replace(/<([^ >]+)\s*>/gi, '<$1>'); // trim attributes
             html = html.replace(/"\s*>/gi, '">');

             return html.trim();
         }

         function emptyDefaultActions(card) {
             _.each(card.actions, function(action) {
                 var shortCode = _.keys(action)[0];
                 if (!action || !shortCode) return;

                 if (getActionKind(card, shortCode) == 'Pages List') {
                     var url = (action[shortCode] || '').split('#')[0];
                     if (!url || url == ('{{' + shortCode + '}}')) {
                         action[shortCode] = '';
                     }
                 }
                 else if (action[shortCode] == ('{{' + shortCode + '}}')) {
                     action[shortCode] = '';
                 }
             });
         }

         function getActionKind(card, shortCode) {
             var variable = _.findWhere(card.variables, { shortCode: shortCode });
             return variable && variable.kind;
         }

         /**
          * Stabilizes scope until chained digest cycles are finished
          * @param scope
          * @returns {*} $q.promise object with success bool param
          */
         function stabilize(scope) {
             try {
                 // already stable
                 if (!scope.$$phase) return $q.when(true);

                 var defer = $q.defer();
                 scope._stabilizing = !scope._stabilizing;
                 var stabilizingDispose = scope.$watch('_stabilizing', function (newValue, oldValue) {
                     if (newValue == oldValue) return;
                     stabilizingDispose();
                     delete scope._stabilizing;
                     defer.resolve(true);
                 });
                 return defer.promise;
             }
             catch (ex) {
                 console.error('scope stabilize failed', ex);
                 return $q.when(false); // graceful fallback, scope stabilized
             }
         }

         function savePage(newPage, oriPage) {
             var pageId = (oriPage || newPage)._id;
             var page = prepareSavingPage(newPage, oriPage && oriPage.saveWholePage);

             var updated = page.$update({ pageId: pageId });

             updated = updated.catch(function(err) {
                 console.warn(err.status, requestErrorMessage(err));
                 if (err.status != 400) return $q.reject(err);
                 page = prepareSavingPage(newPage, true);
                 return page.$update({ pageId: pageId });
             });

             return updated;
         }

         function prepareSavingPage(newPage, saveWholePage) {
             var page = new Pages(angular.copy(newPage));
             var partialUpdate = !saveWholePage && _.where(page.cards, { changed: true });

             for (var i = 0; i < page.cards.length; i++) {
                 if (partialUpdate && partialUpdate.length > 0 && !_.contains(partialUpdate, page.cards[i])) {
                     page.cards[i] = new Cards({ _id: page.cards[i]._id, reference: true });
                 }
                 else {
                     page.cards[i].actions = newPage.cards[i].tempActions;
                     page.cards[i].html = cardsHelper.cleanUpCardHtml(page.cards[i].html);
                 }

                 delete page.cards[i].changed;
             }

             page.publishPending = false;

             return page;
         }

         function requestErrorMessage(response) {
             return response && response.data && response.data.message;
         }

         function prefix(str, value) {
             if (value) return str + value;
             return '';
         }

         function compileHtml(content, scope) {
             var element = $compile(angular.element(content))(scope);
             $(document).width(); // triggers browser reflow event
             if (!scope.$$phase) scope.$digest();
             return element;
         }
     }
})();
