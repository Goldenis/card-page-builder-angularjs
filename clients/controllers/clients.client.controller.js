'use strict';


// Clients controller
angular.module('clients').controller('ClientsController', ['$scope', '$state', '$stateParams', '$location', 'Authentication', 'Clients', 'clientHelper', 'logger', '$rootScope', 'Pages', 'Cards', '$q', '$http', '$cookieStore', 's3Storage',
	function($scope, $state, $stateParams, $location, Authentication, Clients, clientHelper, logger, $rootScope, Pages, Cards, $q, $http, $cookieStore, s3Storage) {
		$scope.authentication = Authentication;
        $scope.me = Authentication.user;
        $scope.siteSettings = $state.is('siteSettings');
		$scope.setting = {isUpdate:false, isLinkUpdate:false, isPageUpdate: false};

		// Create new Client
		$scope.create = function() {
			// Create new Client object
			var client = new Clients ({
				companyName: this.companyName,
				fwUrl: this.fwUrl,
				production_refresh_url: this.production_refresh_url,
				beta_refresh_url: this.beta_refresh_url

			});
			// Redirect after save
			client.$save(function(response) {
				$location.path('clients/' + response._id + '/edit');

				// Clear form fields
				$scope.companyName = '';
				$scope.fwUrl = '';
				$scope.production_refresh_url = '';
				$scope.beta_refresh_url = '';
                $scope.production_url = '';
                $scope.beta_url = '';
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
			});
		};

		// Remove existing Client
		$scope.remove = function(client) {
			if ( client ) { 
				client.$remove();

				for (var i in $scope.clients) {
					if ($scope.clients [i] === client) {
						$scope.clients.splice(i, 1);
					}
				}
			} else {
				$scope.client.$remove(function() {
					$location.path('clients');
				});
			}
		};

		// Update existing Client
		$scope.update = function() {
			var client = $scope.client;
            client.navigation_card = client.navigation_card || null;
			client.$update(function() {
				logger.success('Client updated Successfully');
				$state.reload();
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
				logger.error($scope.error);
			});
		};

		$scope.duplicateClient = function(c) {
			var client = new Clients(c);
			
			client.companyName = "COPY - " + client.companyName;
			delete client._id;
			delete client.user;
			client.$save(function() {
				logger.success('Client duplicated Successfully');
				$state.reload();
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
				logger.error($scope.error);
			});
		}

        $scope.openDeleteModal = function (client) {
            $scope.selectedClient = client;
            $('#deleteClientModal').modal2('show');
        };
        
        $scope.deleteClient = function (client) {
            var index = $scope.clients.indexOf(client);
            client.$remove({ clientId: client._id });
            $scope.clients.splice(index, 1);
            $('#deleteClientModal').modal2('hide');
            logger.success('Client deleted');
        };

		// Find a list of Clients
		$scope.find = function() {
			$scope.clients = Clients.query();
		};

        var userClientsDefer;

		// Find existing Client
		$scope.findOne = function(client) {
            var userClientNames = _.unionItems($scope.me.clients, $scope.me.client);

            // lazy init
            if ($scope.siteSettings && !userClientsDefer) {
                userClientsDefer = Clients.query(userClientNames.length > 1 ? {} : { name: client }).$promise.then(function (clients) {
                    return _.sortBy(_.filter(clients, function(client) { return _.contains(userClientNames, client && client.companyName); }), 'companyName');
                });

                userClientsDefer.then(function (clients) { $scope.clients = clients; });
            }

            var clientRequest = $scope.siteSettings
                ? userClientsDefer.then(function (clients) {
                    return _.findWhere(clients, { companyName: client ? client.companyName : $cookieStore.get('list-pages-client') }) || clients[0];
                })
                : Clients.get({clientId: $stateParams.clientId}).$promise;

			clientRequest.then(function(client) {
                if (!client) {
                    return logger.error('Client details not found');
                }

                $cookieStore.put('list-pages-client', client.companyName);

				$scope.client = client;
				console.log($scope.client);

                $scope.client.variables = $scope.client.variables || [];
                $scope.client.additional_links = $scope.client.additional_links || [];
                $scope.client.site_navigation = $scope.client.site_navigation || [];

                prepareNavigationTree($scope.client.site_navigation);

                var loadCards = Cards.query({ clientName: $scope.client.companyName, exclude: ['html', 'less', 'css'] }).$promise;

                var selectCardConfig = {
                    maxItems: 1,
                    allowEmptyOption: true,
                    preload: true,
                    valueField: '_id',
                    labelField: 'name',
                    sortField: 'name',
                    searchField: ['name'],
                    load: function (query, callback) {
                        loadCards.then(function (cards) {
                            cards.unshift({ _id: '', name: 'No card' });
                            callback(cards || []);
                        });
                    }
                };

                $scope.selectNavigationCardConfig = angular.copy(selectCardConfig);
                $scope.selectNavigationCardConfig.onChange = function (value) {
                    if (!$scope.client._id) return;

                    var client = new Clients({ _id: $scope.client._id });
                    client.navigation_card = $scope.client.navigation_card || null;
                    client.$update(function() {
                        logger.success('Navigation card changed');
                        reexportPages($scope.client);
                    }, function(errorResponse) {
                        $scope.error = errorResponse.data.message;
                        logger.error($scope.error);
                    });
                };

                $scope.selectFooterCardConfig = angular.copy(selectCardConfig);
                $scope.selectFooterCardConfig.onChange = function (value) {
                    if (!$scope.client._id) return;

                    var client = new Clients({ _id: $scope.client._id });
                    client.footer_card = $scope.client.footer_card || null;
                    client.$update(function() {
                        logger.success('Footer card changed');
                        reexportPages($scope.client);
                    }, function(errorResponse) {
                        $scope.error = errorResponse.data.message;
                        logger.error($scope.error);
                    });
                };

                $scope.selectUrlConfig = {
                    create: true,
                    createOnBlur: true,
                    maxItems: 1,
                    preload: true,
                    valueField: 'url',
                    labelField: 'name',
                    sortField: 'name',
                    searchField: ['name', 'url'],
                    load: function (query, callback) {
                        Pages.query({ clientName: $scope.client.companyName, exclude: ['cards', 'sourceCode', 'exportedCSS'] }).$promise.then(function (pages) {
                            _.each(pages, function (page) { page.url = page.url || _.buildUrl(page.name); });
                            callback(pages || []);
                        });
                    },
                    onLoad: function (data) {
                        var pagesUrls = _.pluck(data, this.settings.valueField);
                        _.each($scope.client.site_navigation, function (navPage) {
                            if (!_.contains(pagesUrls, navPage.url)) {
                                this.addOption({ name: navPage.url, url: navPage.url });
                                console.log('added', navPage.url);
                            }
                        }.bind(this));
                    }
                };

				$rootScope.title = "Cardkit | " + client.companyName;

                if (!$scope.siteSettings) {
                    $scope.setAceForEditClient();
                }
			});
		};

		$scope.addVariable = function() {
			$scope.client.variables.push({
	            kind: $scope.variable_form.kind,
	            variable: $scope.variable_form.variable,
	            value: $scope.variable_form.value
        	});
        	$scope.variable_form = '';
			clientHelper.editClientUpdate($scope.client, 'add', 'variable');

		}
		$scope.removeVariableAtIndex = function(index) {
			$scope.client.variables.splice(index, 1);
			clientHelper.editClientUpdate($scope.client, 'remove', 'variable');
		}
		$scope.isValid = function() {
			if (!$scope.variable_form)
				return false;
			if (!$scope.variable_form.kind)
				return false;
			if (!$scope.variable_form.variable)
				return false;
			if (!$scope.variable_form.value)
				return false;
			return true;
		}

		  $scope.upload = function() {
			var x = document.getElementById("imageFiles");
			var file = x.files[0];
            if (!file) return;

              var uniqueFileName = _.safeUrl('app/' + $scope.uniqueString() + '-' + file.name);
              s3Storage.uploadOptimized(uniqueFileName, file).then(function (url) {
                  // Reset The Progress Bar
                  $timeout(function() {
                      $scope.uploadProgress = 0;
                  }, 4000);

                  $scope.variable_form.value = url;
              }, null, function (progress) {
                  $scope.variable_form.uploadProgress = $scope.uploadProgress = progress;
              });
        };

		$scope.uniqueString = function() {
		    var text     = "";
		    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		    for( var i=0; i < 8; i++ ) {
		      text += possible.charAt(Math.floor(Math.random() * possible.length));
		    }
		    return text;
		  };

		$scope.getFileName = function(file_url) {
			var pieces = (file_url || '').split('/');
			return pieces[pieces.length - 1];
		};

		$scope.editClientVariable = function(index) {
			$scope.variable_form = {
				kind: $scope.client.variables[index].kind,
				variable: $scope.client.variables[index].variable,
				value: $scope.client.variables[index].value
			};
			
			$scope.update_index = index;
			if(!$scope.$$phase) {
                 $scope.$apply();
            }
		};

		$scope.updateVariable = function(index) {
			$scope.client.variables[index] = {
				kind: $scope.variable_form.kind,
				variable: $scope.variable_form.variable,
				value: $scope.variable_form.value
			};

			$scope.variable_form = {};

			clientHelper.editClientUpdate($scope.client, 'update', 'variable');
		};

        // <editor-fold desc="Additional Links">

        $scope.addLink = function() {
            $scope.client.additional_links.push({
                label: $scope.links_form.label,
                url: $scope.links_form.url,
                newWindow: $scope.links_form.newWindow
            });
            $scope.links_form = '';
            clientHelper.editClientUpdate($scope.client, 'add', 'additional link');
        };

        $scope.removeLinkAtIndex = function(index) {
            $scope.client.additional_links.splice(index, 1);
            clientHelper.editClientUpdate($scope.client, 'remove', 'additional link');
        };
        
        $scope.editAdditionalLink = function(index) {
            var link = $scope.client.additional_links[index];

            $scope.links_form = {
                label: link.label,
                url: link.url,
                newWindow: link.newWindow
            };

            $scope.update_link_index = index;
            if(!$scope.$$phase) {
                $scope.$apply();
            }
        };
        
        $scope.updateAdditionalLink = function (index) {
            $scope.client.additional_links[index] = {
                label: $scope.links_form.label,
                url: $scope.links_form.url,
                newWindow: $scope.links_form.newWindow
            };

            $scope.links_form = {};

            clientHelper.editClientUpdate($scope.client, 'update', 'additional link');
        };

        $scope.updateLinkOrder = function (oldIndex, newIndex) {
            var links = $scope.client.additional_links;
            if (!links[oldIndex]) return;

            newIndex = Math.max(0, Math.min(links.length - 1, newIndex)); // safe index

            var link = links.splice(oldIndex, 1)[0];
            links.splice(newIndex, 0, link);

            clientHelper.editClientUpdate($scope.client, 'update', 'additional link');
        };

        $scope.isLinkFormValid = function() {
            if (!$scope.links_form)
                return false;
            if (!$scope.links_form.url)
                return false;
            if (!$scope.links_form.label)
                return false;
            return true;
        };

        // </editor-fold>

        // <editor-fold desc="Site Navigation">

        $scope.addSiteNavigationPage = function() {
            var nodes = sliceNodes($scope.client.site_navigation);
            var nextId = generateNextId(nodes);

            $scope.client.site_navigation.push({
                id: nextId,
                label: $scope.site_navigation_form.label,
                url: $scope.site_navigation_form.url
            });

            $scope.site_navigation_form = '';
        };

        $scope.editSiteNavigationPage = function(id) {
            if (!id) return;

            var nodes = sliceNodes($scope.client.site_navigation);
            var node = _.findWhere(nodes, { id: id });

            $scope.site_navigation_form = {
                id: node.id,
                label: node.label,
                url: node.url
            };

            $scope.update_site_navigation_index = id;
            if(!$scope.$$phase) {
                $scope.$apply();
            }
        };

        $scope.updateSiteNavigationPage = function (id) {
            var nodes = sliceNodes($scope.client.site_navigation);
            var node = _.findWhere(nodes, {id: id});

            node.label = $scope.site_navigation_form.label;
            node.url = $scope.site_navigation_form.url;

            $scope.site_navigation_form = {};
        };

        $scope.isSiteNavigationFormValid = function() {
            if (!$scope.site_navigation_form)
                return false;
            if (!$scope.site_navigation_form.url)
                return false;
            if (!$scope.site_navigation_form.label)
                return false;
            return true;
        };

        $scope.saveSiteNavigation = function (client) {
            var savingClient = new Clients({ _id: client._id });
            savingClient.site_navigation = client.site_navigation;
            clientHelper.editClientUpdate(savingClient, 'update', 'site navigation').then(function () {
                reexportPages(client);
                $scope.isSiteNavigationDirty = false;
            });
        };

        $scope.isEmpty = _.isEmpty;
        $scope.removeItem = _.removeItem;

        $scope.$watch('client', function (client) {
            if (!client) return;
            var rss = client.rss_settings = client.rss_settings || {};
            rss.categories = rss.categories || [];
        });

        $scope.$watchCollection('client.rss_settings.categories', function (categories) {
            if (categories && categories.length == 0) categories.push({});
        });

        $scope.$watch('client.site_navigation', function (value, oldValue) {
            if (!oldValue || value === oldValue) return;
            $scope.isSiteNavigationDirty = true;
        }, true);

        // </editor-fold>

        $scope.setAceForEditClient = function() {
		   $scope.aceHeaderInit=false;
           var headereditor = ace.edit("global_header");
           headereditor.setTheme("ace/theme/monokai");
           headereditor.getSession().setMode("ace/mode/html");
           headereditor.getSession().setUseWrapMode(true);
           headereditor.getSession().on('change', function(e){
                //$scope.card.html= $sce.trustAsHtml(headereditor.getValue());
                $scope.client.header = headereditor.getValue();

                if(!$scope.$$phase) {
                     $scope.$apply();
                }
           });

           $scope.$watch(function(scope){return scope.client.header},
                function(){
                     if($scope.client.header && $scope.aceHeaderInit==false){
                          $scope.aceHeaderInit=true;
                          headereditor.setValue($scope.client.header);
                          headereditor.gotoLine(1);
                     }
                });

           $scope.aceFooterInit=false;
           var footereditor = ace.edit("global_footer");
           footereditor.setTheme("ace/theme/monokai");
           footereditor.getSession().setMode("ace/mode/html");
           footereditor.getSession().setUseWrapMode(true);
           footereditor.getSession().on('change', function(e){
                //$scope.card.html= $sce.trustAsHtml(footereditor.getValue());
                $scope.client.footer = footereditor.getValue();

                if(!$scope.$$phase) {
                     $scope.$apply();
                }
           });

      

           $scope.$watch(function(scope){return scope.client.footer},
                function(){
                     if($scope.client.footer && $scope.aceFooterInit==false){
                          $scope.aceFooterInit=true;
                          footereditor.setValue($scope.client.footer);
                          footereditor.gotoLine(1);
                     }
                });
		}

        function reexportPages(client) {
            var pro_refreshUrl = client.production_refresh_url || '';
            var beta_refreshUrl = client.beta_refresh_url || '';

            if (pro_refreshUrl || beta_refreshUrl) {
                return $q.all([$http.post(pro_refreshUrl), $http.post(beta_refreshUrl)]).then(function () {
                    logger.info('Published site navigation');
                });
            }
        }

        function sliceNodes(node) {
            if (!node) return [];
            if (node instanceof Array) return _.flatten(_.map(node, sliceNodes));
            var descendents = _.map(node.nodes, sliceNodes);
            return [node].concat(descendents);
        }

        function prepareNavigationTree(siteNav) {
            var nodes = sliceNodes(siteNav);
            nodes.forEach(function (node) {
                node.id = node.id || generateNextId(nodes);
                node.nodes = node.nodes || [];
            });
        }

        function generateNextId(nodes) {
            var maxId = _.max(_.pluck(nodes, 'id'));
            if (!isFinite(maxId)) maxId = 0;
            return maxId + 1;
        }
    }
]);
