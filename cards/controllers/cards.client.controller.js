'use strict';



// Cards controller
var cardapp = angular.module('cards').controller('CardsController', ['$http','appConfig', '$state', '$scope', '$sce', '$stateParams', '$location', '$timeout', 'Authentication', 'Cards', 'Clients', 'Users','assign', 'logger','clientHelper', 'cardsHelper', '$window', '$q', 'Idle', 'Title', 'hotkeys', 'Orders', 'cardData', 's3Storage', '$filter',
     function($http,appConfig, $state, $scope, $sce, $stateParams, $location, $timeout, Authentication, Cards, Clients, Users, assign, logger, clientHelper, cardsHelper, $window, $q, Idle, Title, hotkeys, Orders, cardData, s3Storage, $filter) {
          
          $scope.authentication = Authentication;
          $scope.me = Authentication.user;
          $scope.selected = {};
          $scope.canClaimCards = $scope.me.role === 'admin' || _.contains($scope.me.permissions, 'ClaimCards');
          $scope.canEditCards = $scope.me.role === 'admin' || _.contains($scope.me.permissions, 'EditAnyCard');
          $scope.artboardWidth = 'calc(91vw - 28vw)';
          $scope.allStatuses = appConfig.cardStatuses;
          $scope.artboardHeight = '768px';
          $scope.card = {};
          $scope.enabledJSEditor = false;
          $scope.idleCountDown = 60;
          var isloaded = false;

          var auto_card_vars = [];
          var auto_client_vars = [];

          $scope.searchFilter = {
               name : '',
               clients: [],
               orders: [],
               devs: []
          };

          ace.require("ace/ext/language_tools");
          
          var _IdleTimeout = 5*60;
          var _IdleCountDown = 60; 

          Idle.setIdle(_IdleTimeout);
          Idle.setTimeout(_IdleCountDown);   

                

          var startEditDate = '';
          var timeLogUpdated = false;

          $scope.$on('IdleStart', function() {
               Title.restore();
               $('#idleModal').modal('show');
          });

          $scope.$on('IdleEnd', function() {
               Title.restore();
               Idle.setIdle(1);
               Idle.setTimeout($scope.countdown);
          });

          $scope.$on('IdleWarn', function(e, countdown) {
               Title.restore();
               $scope.countdown = countdown;
          });

          $scope.$on('IdleTimeout', function() {
               Title.restore();
               $('#idleModal').modal('hide');
               Idle.setIdle(_IdleTimeout);
               Idle.setTimeout(_IdleCountDown);
               $scope.update().then(function() {
                    $location.path('cards');

               });
          });

          window.onload = function() {
               isloaded = true;
               $scope.$watch(function() {
                    return $scope.card.actions
               }, function () {
                    if (isloaded) {
                         console.log("changed");
                              $timeout(function() {
                                   try {
                                        var iframe = document.getElementById("card_iframe");
                                        cardsHelper.updateIframeData('actions', $scope.card.actions, iframe); 
                                   } catch (err) {
                                        console.log(err);
                                   }

                              }, 1000);
                    }
               }, true);
          }

      
          Users.getAllUsers().$promise.then(function (users) {
               $scope.allUsers = assign.excludeByRole(users,'client');
          });

          Users.getAllUsers().$promise.then(function (users) {
               $scope.allDevs = assign.returnByRole(users,'developer');
          });

          Orders.query().$promise.then(function(orders) {
               $scope.allOrders = orders;
          });


          $scope.idleModalAction = function() {
               Title.restore();
               $('#idleModal').modal('hide');
               Idle.setIdle(_IdleTimeout);
               Idle.setTimeout(_IdleCountDown);
          }

          $scope.checkJSEditor = function() {
               cardsHelper.enableJSEditor(!$scope.enabledJSEditor);
          }

          $scope.initPreview = function() {
               $scope.isShowiFrame=false;
               logger.success('Preview is loading...');
          };

          $scope.openCustomModal = function () {
               $('#customModal').modal2('show');
          }

          $scope.customAction = function () {
               $('#customModal').modal2('hide');
               console.log('kastom akcija izvrsena');
          }

          $scope.openClaimModal = function (card) {
               $('#claimModal').modal2('show');
               if (!$scope.selected.user) {
                    $scope.selected.user = Authentication.user;
               }
               $scope.selectedCard = card;
          };
//view page
          $scope.openApproveModal = function () {
               $('#approveModal').modal('show');
          };

          $scope.openReadyForTeamReviewModal = function () {
               $('#ReadyForTeamReviewModal').modal2('show');
          };
//view page
          $scope.openBackToEditModal = function () {
               $('#backToEditModal').modal('show');
          };
//view page
          $scope.openDeleteConfirmationModal = function() {
               $('#deleteConfirmationModal').modal('show');
          };
//view page
          $scope.openPreviewiframe = function() {
               $window.open($location.absUrl() + '/preview',"","width=1024, height=768");
          };

          $scope.assignCard = function (card, user) {
               Cards.claim({cardId:card._id}, {card: card, user: user})
                    .$promise
                    .then(function (data) {
                         card.claimedBy[0] = user;
                         logger.success('Card assigned to : ' + user.firstName + ' ' + user.lastName);
                    })
                    .catch(function () {
                         logger.error('Error assigning card');
                    })
          };

          $scope.claimCard = function () {
               $('#claimModal').modal2('hide');
               Cards.claim({cardId:$scope.selectedCard._id}, {card: $scope.selectedCard, user:$scope.selected.user})
                    .$promise
                    .then(function (data) {
                         $scope.selectedCard.claimedBy[0] = Authentication.user;
                         logger.success('Card successfully claimed');
                    })
                    .catch(function () {
                         logger.error('Error claiming card');
                    })
          };
//create page
          $scope.findClients = function() {
               Clients.query().$promise.then(function (clients) {
                    $scope.clients = clients;
                    $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);
                    if(!$scope.$$phase) {
                         $scope.$apply();
                    }
               });
          };
//view : reference to list controller
          $scope.updateStatus = function (card, status) {
               card.cardStatus = status || card.cardStatus;
               if(status==='Ready for Team Review'){$('#ReadyForTeamReviewModal').modal2('hide');}
               status==='Approved'?$('#approveModal').modal('hide'):$('#backToEditModal').modal('hide');
               Cards.update({cardId:card._id, trigger:'updateStatus'}, card)
                    .$promise
                    .then(function (updatedCard) {
                         logger.info('Status set to: ' + updatedCard.cardStatus);
                         if (card.cardStatus === "Ready for Team Review") {
                              cardsHelper.disableAllEditorsAndButtons();
                         } else {
                              cardsHelper.enableAllEditorsAndButtons();
                              cardsHelper.enableJSEditor(!$scope.enabledJSEditor);
                         }
                    })
                    .catch(function (err) {
                         console.log('err', err);
                         logger.info('Error updating card status');
                    })
          };

          $scope.findClient = function() {
               $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);               
          };

          var uid = 1;

          $scope.kinds = ['Dropdown', 'Text Input', 'Text Area', 'File', 'Video', 'Checkbox', 'Pages List', 'Repeat'];

          $scope.saveContact = function(variable) {
              if($scope.editableVar) {
                   var index = $scope.card.variables.indexOf($scope.editableVar);
                   $scope.newcontact._id = $scope.editableVar._id;
                   $scope.card.variables[index] = _.extend($scope.card.variables[index], $scope.newcontact);
                   $scope.editableVar = undefined;
              }
               else {
                    if (typeof $scope.card.variables == "undefined") {
                         $scope.card.variables = [];
                    }
                    $scope.card.variables.push($scope.newcontact)
              }
               if($scope.newcontact.kind==='Dropdown')
                    $scope.newcontact.value = $scope.newcontact.value && $scope.newcontact.value.replace(/\s+/g, '').split(',');
                    $scope.newcontact = {};
          };


          $scope.delete = function(variable) {
               var index = $scope.card.variables.indexOf(variable);
               $scope.card.variables.splice(index,1);
               $scope.newcontact = {};
          };


          $scope.edit = function(variable) {
               $scope.newcontact = Object.create(variable);
               $scope.editableVar = variable;
          };
//create page
          // Create new Card
          $scope.create = function() {
               // Create new Card object
               var timelog = [];

               var card = new Cards ({
                    name: this.name,
                    client: this.client,
                    notes: this.notes,
                    images: $scope.card.images,
                    timelog: timelog
               });

               
               // Redirect after save
               card.$save(function(response) {
                    //$location.path('cards/' + response._id);
                    $location.path('cards');

                    // Clear form fields
                    $scope.name = '';
                    $scope.client = '';
                    $scope.css = '';
               }, function(errorResponse) {
                    $scope.error = errorResponse.data.message;
               });
          };
//view page
          // Remove existing Card
          $scope.remove = function(card) {
               $('#deleteConfirmationModal').modal('hide');
               if ( card ) {
                    card.$remove();

                    for (var i in $scope.cards) {
                         if ($scope.cards [i] === card) {
                              $scope.cards.splice(i, 1);
                         }
                    }
               } else {
                    $scope.card.$remove(function() {
                         $location.path('cards');
                    });
               }
          };

          // Update existing Card
          $scope.update = function() {
               var defer = $q.defer();

               var card = $scope.card;

               var timelog = {
                    start: startEditDate,
                    end: new Date(),
                    user: Authentication.user
               };

               if (timeLogUpdated) {
                   card.timelog[card.timelog.length - 1].end = new Date();
               } else {
                    timeLogUpdated = true;
                    if (!card['timelog']) { card['timelog'] = []; } //TODO: need to be removed on production. it only needs for old model since they don't have a timelog entity. or keep it.
                    
                    card['timelog'].push(timelog);
               }               
               
               card.html = $scope.card.html.toString();               
               card.updatedAt = new Date();
               card.$update(function() {
                    logger.success('Timelog updated');
                    logger.success('Card updated successfully');
                    defer.resolve();
               }, function(errorResponse) {
                    $scope.error = errorResponse.data.message;
                    defer.reject();
               });

               return defer.promise;
          };

          // Find a list of Cards if user is admin or has ViewAllCards permission
          if($scope.me.role === 'admin' || $scope.me.role === 'client' || _.contains($scope.me.permissions,'ViewAllCards')) {
               $scope.find = function () {
                    Cards.query().$promise.then(function (cards) {
                         cards = $filter('orderBy')(cards, ['client.companyName', 'name']);

                         if ($scope.me.role === 'client') {
                              var filtered = cardsHelper.clientCardFilter(cards, $scope.me);
                              $scope.ready = filtered.ready;
                              $scope.edits = filtered.edits;
                         } else {
                              $scope.cards = cards;
                         }
                    }).catch(function () {
                         logger.error('Error while fetching cards');
                    });
               };
          }


          // Find existing Card
          $scope.findOne = function() {
               $scope.card = Cards.get({cardId: $stateParams.cardId});               
          };

          $scope.isReadyForTeamReview = function() {
               $scope.card.$promise.then(function(data){
                    if (data.cardStatus === "Ready for Team Review") {
                         cardsHelper.disableAllEditorsAndButtons();
                    }
                    cardsHelper.enableJSEditor(!$scope.enabledJSEditor);
               });
               
          };

          $scope.setAceForEditCard = function() {

               /*var card = $scope.card;
               var timelog = {
                    start: new Date()
               };
               card.$promise.then(function(data){
                    if (card['timelog']) {
                         card['timelog'].push(timel;
                    } else {
                         card['timelog'] = timelog;
                    }
                    
                    
                    card.$update(function() {
                         logger.success('Timelog Start updated successfully');
                    }, function(errorResponse) {
                         $scope.error = errorResponse.data.message;
                    });
               });*/

               startEditDate = new Date();

               logger.success('Timelog Started');

               $scope.aceHtmlInit=false;

               

               var htmleditor = ace.edit("html");
               htmleditor.setOptions({
                    enableBasicAutocompletion: true,
                  enableLiveAutocompletion: true,});

               htmleditor.completers.push({
                   getCompletions: function(editor, session, pos, prefix, callback) {
                   callback(null, auto_card_vars);
                   }
                 });
               htmleditor.setTheme("ace/theme/monokai");
               htmleditor.getSession().setMode("ace/mode/html");
               htmleditor.getSession().setUseWrapMode(true);
               htmleditor.getSession().on('change', function(e){
                    $scope.card.html = htmleditor.getValue();
                    if(!$scope.$$phase) {
                         $scope.$apply();
                    }                    
                    
                    if ($scope.isIframeLoaded && !$scope.enabledJSEditor){
                         var iframe = document.getElementById("card_iframe");
                         cardsHelper.updateIframeData('html', $scope.card.html, iframe);
                    }
                                       
               });

               $scope.$watch(function(scope){return scope.card.html},
                    function(){
                         if($scope.card.html && $scope.aceHtmlInit==false){
                              $scope.aceHtmlInit=true;
                              htmleditor.setValue($scope.card.html);
                              htmleditor.gotoLine(1);
                         }
                    });

               

               $scope.aceLessInit=false;
               var lesseditor = ace.edit("less");

               lesseditor.setOptions({
                    enableBasicAutocompletion: true,
                  enableLiveAutocompletion: true,});

               lesseditor.completers.push({
                   getCompletions: function(editor, session, pos, prefix, callback) {
                    var auto_arr1 = [];

                    
                         
                         callback(null, auto_arr1);
                   }
                 });

               lesseditor.setTheme("ace/theme/monokai");
               lesseditor.getSession().setMode("ace/mode/less");
               lesseditor.getSession().setUseWrapMode(true);
               lesseditor.getSession().on('change', function(e){
                    $scope.card.less=lesseditor.getValue();   
                    if(!$scope.$$phase) {
                         $scope.$apply();
                    }                 
               });

               $scope.$watch(function(scope){return scope.card.less},
                    function(){
                         var less_scope;
                         if ($scope.client) {
                              less_scope = clientHelper.addClietVariesToLess($scope.client.variables) + $scope.card.less;
                              less.render(less_scope).then(function(output) {
                                   $scope.card.css = output.css;
                                   csseditor.setValue($scope.card.css);
                              }).catch(function(err){
                                   console.log(err);
                                   logger.error('Error with LESS');
                                   logger.error(err.message);
                              });
                         } else {
                              Clients.query().$promise.then(function (clients) {
                                   $scope.clients = clients;
                                   $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);

                                   if(!$scope.$$phase) {
                                        $scope.$apply();
                                   }

                                   less_scope = clientHelper.addClietVariesToLess($scope.client.variables) + $scope.card.less;
                                   less.render(less_scope).then(function(output) {
                                        $scope.card.css = output.css;
                                        csseditor.setValue($scope.card.css);
                                   }).catch(function(err){
                                        console.log(err.data);
                                   });
                                   
                              });
                         }

                         if($scope.card.less && $scope.aceLessInit==false){
                              $scope.aceLessInit=true;
                              lesseditor.setValue($scope.card.less);
                              lesseditor.gotoLine(1);
                         }
                    });



               $scope.aceCSSInit=false;
               var csseditor = ace.edit("css");
               csseditor.setTheme("ace/theme/monokai");
               csseditor.getSession().setMode("ace/mode/css");
               csseditor.getSession().setUseWrapMode(true);

               csseditor.getSession().on('change', function(e){
                    $scope.card.css=csseditor.getValue();
/*
                    if ($scope.isIframeLoaded){
                         cardsHelper.updateIframeData('css', $scope.card.css);
                    }*/

                    if ($scope.isIframeLoaded && !$scope.enabledJSEditor){
                         var iframe = document.getElementById("card_iframe");
                         cardsHelper.updateIframeData('css', $scope.card.css, iframe);
                    }

                    if(!$scope.$$phase) {
                         $scope.$apply();
                    }
               });

               $scope.$watch(function(scope){return scope.card.css},
                    function(){
                         if ($scope.card.css && $scope.aceCSSInit==false) {
                              $scope.aceCSSInit=true;
                              csseditor.setValue($scope.card.css);
                              if ($scope.card.less == '') {
                                   $scope.card.less = $scope.card.css;
                              }
                              csseditor.gotoLine(1);
                         }
                    });


               $scope.aceJSInit=false;
               var jseditor = ace.edit("js");
               jseditor.setTheme("ace/theme/monokai");
               jseditor.getSession().setUseWrapMode(true);
               jseditor.getSession().setMode("ace/mode/javascript");
               jseditor.getSession().on('change', function(e){
                    $scope.card.js=jseditor.getValue();
                    /*if(!$scope.$$phase) {
                         $scope.$apply();
                    }*/
               });

               $scope.$watch(function(scope){return scope.card.js},
                    function(){
                         if($scope.card.js && $scope.aceJSInit==false){
                              $scope.aceJSInit=true;
                              jseditor.setValue($scope.card.js);
                              jseditor.gotoLine(1);
                         }
                    });



               jQuery("input[type=text]").addClass('mousetrap');
               jQuery("textarea").addClass('mousetrap');

          };

          $scope.testVariables = function() {
               cardData.setActiveCard($scope.card);
               /*$('.sidebar .tab-content').addClass('hidden');
               $('.sidebar .editCard').removeClass('hidden');*/
          };

          $scope.runJS = function() {
               var iframe = document.getElementById("card_iframe");
               cardsHelper.updateIframeData('html', $scope.card.html, iframe);  
               cardsHelper.updateIframeData('css', $scope.card.css, iframe);
               if ($scope.enabledJSEditor)
                    cardsHelper.updateIframeData('js', $scope.card.js, iframe);

               //iframe.src = iframe.src; // MUST TODO: re-rendering the page

               /*var js = $sce.trustAsHtml($scope.card.js);
               cardsHelper.runIframeJS($scope.card.js);*/
                 
          };

          $scope.removeImage = function() {
               $scope.card.image='';
               if(!$scope.$$phase) {
                    $scope.$apply();
               }
          };
//create page
          $scope.addNewImage = function() {
               $scope.card.images.push({
                    url: '',
                    note: ''
               });
          };
//create page
          $scope.removeImageAtIndex = function(index) {
               $scope.card.images.splice(index, 1);
          };



          $scope.upload = function(index) {
               var x = document.getElementById("imageFiles-"+index);
               var file = x.files[0];
               if (!file) return;

               var uniqueFileName = _.safeUrl('app/' + $scope.uniqueString() + '-' + file.name);
               s3Storage.uploadOptimized(uniqueFileName, file).then(function (url) {
                    // Reset The Progress Bar
                    $timeout(function() {
                         $scope.uploadProgress = 0;
                    }, 4000);
                    $scope.card.images[index].url = url;
               }, null, function (progress) {
                    $scope.card.images[index].uploadProgress = $scope.uploadProgress = progress;
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
//view page
          $scope.addComment = function() {
               $scope.newComment.user = $scope.authentication.user.username;
               $scope.newComment.displayName = $scope.authentication.user.displayName;
               $scope.card.comments.push($scope.newComment);
               var card = $scope.card;

               card.$update({trigger:'commentAdd'},function() {
                    logger.success('Comments updated Successfully');
                   //$location.path('cards/' + card._id);
               }, function(errorResponse) {
                    $scope.error = errorResponse.data.message;
                    console.log($scope.error);
               });
          };
//view page
          $scope.removeCommentAtIndex = function (index) {
               $scope.card.comments.splice(index, 1);

               var card = $scope.card;

               card.$update(function() {
                    $location.path('cards/' + card._id);
               }, function(errorResponse) {
                    $scope.error = errorResponse.data.message;
               });
          };

          $scope.setActiveImage = function(index) {
               $scope.card.activeImage = index;
               if ($scope.isIframeLoaded){
                    cardsHelper.updateIframeData('image', $scope.card.images[$scope.card.activeImage].url);
               }
          };

          $scope.getFileName = function(file_url) {
               var pieces = file_url.split('/');
               return pieces[pieces.length - 1];
          };
//view page
          $scope.getDifferMin = function(start, end) {
               var diff = Math.abs(new Date(end) - new Date(start));
               var minutes = Math.ceil((diff/1000)/60);
               $scope.totalTime += minutes;
               return minutes;
          }
//view page
          $scope.getTotalTime = function() {
               var totalTime = 0;
               try {
                    for (var i = 0; i < $scope.card.timelog.length; i++) {
                         var diff = Math.abs(new Date($scope.card.timelog[i].end) - new Date($scope.card.timelog[i].start));
                         var minutes = Math.ceil((diff/1000)/60);
                         totalTime += minutes;
                    }
               } catch(err) {
                    console.log(err.message);                    
               }
               return totalTime;
          }

          window.updateCard = function() {
               $scope.update();
          }


          window.loadedIframe = function(iframe) {               
               $scope.isIframeLoaded = true;
               cardsHelper.updateIframeData('html', $scope.card.html, iframe);  
               cardsHelper.updateIframeData('css', $scope.card.css, iframe);
               if ($scope.client) {
                    cardsHelper.updateIframeData('header', $scope.client.header, iframe);
                    cardsHelper.updateIframeData('footer', $scope.client.footer, iframe);
                    if (!$scope.enabledJSEditor)
                         return;
                    $timeout(function() {
                         cardsHelper.updateIframeData('js', $scope.card.js, iframe);
                         //cardsHelper.runIframeJS($scope.card.js);
                    }, 4000);
                    //cardsHelper.updateIframeData('js', $scope.card.js, iframe);
               } else {
                    Clients.query().$promise.then(function (clients) {
                         $scope.clients = clients;
                         $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);

                         if(!$scope.$$phase) {
                              $scope.$apply();
                         }
                         cardsHelper.updateIframeData('header', $scope.client.header, iframe);
                         cardsHelper.updateIframeData('footer', $scope.client.footer, iframe);
                         if (!$scope.enabledJSEditor)
                              return;  
                         $timeout(function() {
                              cardsHelper.updateIframeData('js', $scope.card.js, iframe);
                         }, 4000);
                         
                    });                    
               }
               
               $timeout(function() {
                    logger.success('Preview has been loaded Successfully');
                    $scope.isShowiFrame = true;
               }, 2000);

               /*
               if ($scope.card.images[$scope.card.activeImage])
                    cardsHelper.updateIframeData('image', $scope.card.images[$scope.card.activeImage].url, id);
*/

          }


     }
]);
