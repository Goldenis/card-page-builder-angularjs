(function () {
     "use strict";

     angular
          .module('cards')
          .controller('CardsViewController', CardsViewController);

     CardsViewController.$inject = ['$scope', '$window', '$timeout', '$location', '$stateParams', 'Authentication', 'Cards', 'logger', 'cardsHelper', 'getClients', 'clientHelper', '$compile', 'pagesHelper', '$rootScope'];

     function CardsViewController($scope, $window, $timeout, $location, $stateParams, Authentication, Cards, logger, cardsHelper, getClients, clientHelper, $compile, pagesHelper, $rootScope) {

     	$scope.clients = getClients;     	      
     	$scope.authentication = Authentication;
     	$scope.artboardWidth = 'calc(91vw - 28vw)';
     	$scope.artboardHeight = '768px';
     	$scope.loadingPage = true;
      $scope.shrink = 1;
      $scope.timeloggedUsers = [];
  	    $scope.findOne = function() {
  	        Cards.get({cardId: $stateParams.cardId})
              .$promise
              .then(function(data) {
                $scope.card = data;
                $rootScope.title = "Cardkit | " + $scope.card.name;
                $scope.client = clientHelper.getClientByName($scope.clients, $scope.card.client);
                var copy_card = jQuery.extend(true, {}, $scope.card);
                $scope.adoptedCard = pagesHelper.adoptPageDataStructure(copy_card);
                $scope.getTimeLoggedUsers();
                $scope.loadedIframe(); 
              });               
  	    };
        $scope.getTimeLoggedUsers = function() {
          $scope.card.timelog.forEach(function(item) {
            if ($scope.timeloggedUsers.indexOf(item.user.displayName) == -1) $scope.timeloggedUsers.push(item.user.displayName);
          });
        }
        $scope.setIframeSize = function(size) {
            $scope.shrink = size;
            cardsHelper.setIframeSize($scope);
        }
  	    $scope.openPreviewiframe = function() {
           $window.open($location.absUrl() + '/preview',"","width=1024, height=768");
      	};
      	$scope.openApproveModal = function () {
           $('#approveModal').modal('show');
        };
        $scope.openBackToEditModal = function () {
           $('#backToEditModal').modal('show');
      	};
      	$scope.loadedIframe = function() {  
            var iframe = document.getElementById("card_iframe");             
           $scope.isIframeLoaded = true;
           cardsHelper.updateIframeData('html', $scope.card.html, iframe);  
           cardsHelper.updateIframeData('css', $scope.card.css, iframe);
           if ($scope.client) {
                cardsHelper.updateIframeData('header', $scope.client.header, iframe);
                cardsHelper.updateIframeData('footer', $scope.client.footer, iframe);
                if ($scope.card.js != '') {
                  $timeout(function() {
                       cardsHelper.updateIframeData('js', $scope.card.js, iframe);
                  }, 4000);//4000
                }
                cardsHelper.updateIframeData('actions', $scope.adoptedCard.actions, iframe); 
           } 
           
           $timeout(function() {
                logger.success('Preview has been loaded Successfully');
                $scope.isShowiFrame = true;
           }, 0);//2000
        }
        $scope.openDeleteConfirmationModal = function() {
           $('#deleteConfirmationModal').modal('show');
      	};
      	$scope.removeCommentAtIndex = function (index) {
           $scope.card.comments.splice(index, 1);

           var card = $scope.card;

           card.$update(function() {
           		logger.success('Comments removed Successfully');
                //$location.path('cards/' + card._id);
           }, function(errorResponse) {
                $scope.error = errorResponse.data.message;
           });
      	};
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
      	$scope.updateStatus = function (card, status) {
           card.cardStatus = status || card.cardStatus;
           status==='Approved'?$('#approveModal').modal('hide'):$('#backToEditModal').modal('hide');
           Cards.update({cardId:card._id, trigger:'updateStatus'}, card)
                .$promise
                .then(function (updatedCard) {
                     logger.info('Status set to: ' + updatedCard.cardStatus);
                })
                .catch(function () {
                     logger.info('Error updating card status');
                })
      	};
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
      	$scope.getDifferMin = function(start, end) {
           var diff = Math.abs(new Date(end) - new Date(start));
           var minutes = Math.ceil((diff/1000)/60);
           return minutes;
      	}
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
           return Math.floor(totalTime/24) + " hrs " + totalTime%24 + " min";
      	}
     }

}());
