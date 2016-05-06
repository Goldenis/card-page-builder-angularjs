(function () {
    "use strict";

    angular
          .module('cards')
          .controller('CardsEditController', CardsEditController);

    CardsEditController.$inject = ['$http','appConfig', '$state', '$scope', '$sce', '$stateParams', '$location', '$timeout', 'Authentication', 'Cards', 'Clients', 'Users','assign', 'logger','clientHelper', 'cardsHelper', '$window', '$q', 'Idle', 'Title', 'hotkeys', 'Orders', 'cardData', 'getClients', '$compile', 'setIdleTimeout', 'pagesHelper', '$rootScope'];

    function CardsEditController($http,appConfig, $state, $scope, $sce, $stateParams, $location, $timeout, Authentication, Cards, Clients, Users, assign, logger, clientHelper, cardsHelper, $window, $q, Idle, Title, hotkeys, Orders, cardData, getClients, $compile, setIdleTimeout, pagesHelper, $rootScope) {
          $scope.clients = getClients;
          $scope.isIframe = { loaded: false };
          
          $scope.authentication = Authentication;
          $scope.me = Authentication.user;
          $scope.artboardWidth = 'calc(91vw - 28vw)';
          $scope.shrink = 1;
          $scope.artboardHeight = '768px';
          $scope.enabledJSEditor = false;
          $scope.idleCountDown = 60;
          var isloaded = false;
          var auto_card_vars = [];
          var auto_client_vars = [];    
          
          var _IdleTimeout = 5*60;
          var _IdleCountDown = 60; 

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
          $scope.$on('$stateChangeStart', function(event, newUrl, oldUrl) {
               Idle.unwatch();
          });
          $scope.init = function() {
               cardsHelper.setAceStyles();
          }
          $scope.idleModalAction = function() {
               Title.restore();
               $('#idleModal').modal('hide');
               Idle.setIdle(_IdleTimeout);
               Idle.setTimeout(_IdleCountDown);
          }
          $scope.setIframeSize = function(size) {
               $scope.shrink = size;
               cardsHelper.setIframeSize($scope);
          }
          $scope.checkJSEditor = function() {
               cardsHelper.enableJSEditor(!$scope.enabledJSEditor);
          }
 
          $scope.openReadyForTeamReviewModal = function () {
               $('#ReadyForTeamReviewModal').modal2('show');
          };
          function openValidShortCode() {
               $('#validshortcode').modal2('show');
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
                    .catch(function () {
                         logger.info('Error updating card status');
                    })
          };

          $scope.findClient = function() {
               $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);               
          };

          // Find existing Card
          $scope.findOne = function() {
               Cards.get({cardId: $stateParams.cardId})  
                    .$promise
                    .then(function(card){
                         $scope.card = card;
                         $rootScope.title = "Cardkit | " + card.name;
                         var copy_card = jQuery.extend(true, {}, card);
                         $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);
                         $scope.adoptedCard = pagesHelper.adoptPageDataStructure(copy_card);
                         $scope.card.actions = $scope.adoptedCard.actions;
                         $scope.setAceForEditCard();
                         $scope.isReadyForTeamReview(card);
                         $scope.loadedIframe();
                    });               
          };

          var uid = 1;

          $scope.kinds = ['Dropdown', 'Text Input', 'Text Area', 'File', 'Video', 'Checkbox', 'Pages List', 'Repeat'];

          $scope.saveContact = function(variable) {
              /* check if shorcode variable name is valide or not */
              if (/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test($scope.newcontact.shortCode) === false) {
                openValidShortCode();
                return;
              }

              if($scope.newcontact.kind==='Dropdown') {
                  $scope.newcontact.value = $scope.newcontact.value && $scope.newcontact.value.replace(/\s+/g, '').split(',');
              }

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
               card.url = $scope.card.url.toLowerCase().split(' ').join(''); // remove space in Card URL and convert to lowercase;;;     
               card.updatedAt = new Date();
               console.log(card);
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

        window.updateCard = function() {
            $scope.update();
        };

        $scope.isReadyForTeamReview = function(card) {
                  if (card.cardStatus === "Ready for Team Review") {
                       cardsHelper.disableAllEditorsAndButtons();
                  } else
                    cardsHelper.enableJSEditor(!$scope.enabledJSEditor);
               
          };
          $scope.setAceForEditCard = function() {
               startEditDate = new Date();
               logger.success('Timelog Started');
               cardsHelper.setAceForEditCard($scope);
               jQuery("input[type=text]").addClass('mousetrap');
               jQuery("textarea").addClass('mousetrap');

          };
          $scope.testVariables = function() {
               cardData.setActiveCard($scope.card);
               jQuery('#cardOptions').empty();
               jQuery('#cardOptions').append($compile('<div testbar=""></div>')($scope));
          };
          $scope.runJS = function() {
               var iframe = document.getElementById("card_iframe");
               cardsHelper.updateIframeData('html', $scope.card.html, iframe);  
               cardsHelper.updateIframeData('css', $scope.card.css, iframe);
               if ($scope.enabledJSEditor)
                    cardsHelper.updateIframeData('js', $scope.card.js, iframe);
          };
          $scope.addNewImage = function() {
               $scope.card.images.push({
                    url: '',
                    note: ''
               });
          };
          $scope.removeImageAtIndex = function(index) {
               $scope.card.images.splice(index, 1);
          };
          $scope.upload = function(index) {
               cardsHelper.upload($scope, index);
          };
          $scope.uploadTutorial = function() {
               cardsHelper.uploadTutorial($scope);
          }
          $scope.addComment = function() {
               $scope.newComment.user = $scope.authentication.user.username;
               $scope.newComment.displayName = $scope.authentication.user.displayName;
               $scope.card.comments.push($scope.newComment);
               var card = $scope.card;
               card.$update({trigger:'commentAdd'},function() {
                    logger.success('Comments updated Successfully');
               }, function(errorResponse) {
                    $scope.error = errorResponse.data.message;
                    console.log($scope.error);
               });
          };
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
               cardsHelper.updateIframeData('image', $scope.card.images[$scope.card.activeImage].url);
          };
          $scope.getFileName = function(file_url) {
               var pieces = (file_url || '').split('/');
               return pieces[pieces.length - 1];
          };
          $scope.loadedIframe = function() { 
               $scope.isIframe.loaded = true;
               var iframe = document.getElementById("card_iframe");
               cardsHelper.updateIframeData('footer', $scope.client.footer, iframe);
               cardsHelper.updateIframeData('header', $scope.client.header, iframe);
               cardsHelper.updateIframeData('html', $scope.card.html, iframe);  
               cardsHelper.updateIframeData('css', $scope.card.css, iframe);
               if ($scope.client) {                    
                    if ($scope.card.js != '') {
                      $timeout(function() {
                           cardsHelper.updateIframeData('js', $scope.card.js, iframe);
                      }, 5000);//4000
                    }
                    cardsHelper.updateIframeData('actions', $scope.adoptedCard.actions, iframe); 
               }               
               cardsHelper.watchCardVariables($scope);
               logger.success('Preview has been loaded Successfully');               
          };

          $scope.getClientURL = function() {            
            if ($scope.card == undefined) return; 
            var client = $scope.card.client;
            return client.toLowerCase().split(' ').join('_') + "/" + $scope.card.url; 
          };
     }

}());
