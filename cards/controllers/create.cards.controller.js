(function () {
    "use strict";

    angular
          .module('cards')
          .controller('CardsCreateController', CardsCreateController);

    CardsCreateController.$inject = ['$scope', '$window', '$timeout', '$location', '$stateParams', 'Authentication', 'Cards', 'logger', 'cardsHelper', 'clientHelper'];

    function CardsCreateController($scope, $window, $timeout, $location, $stateParams, Authentication, Cards, logger, cardsHelper, clientHelper) {
    	$scope.card = {};
    	$scope.findClients = function() {
    		cardsHelper.getClients().then(function(clients) {$scope.clients = clients});
    	};
      // update card URL
      $scope.updateCardURL = function() {
        if ($scope.name != undefined) {
          var url = $scope.name.toLowerCase().split(' ').join('-');
          $scope.url = url;
        } else {
          $scope.url = "";
        }
      }
    	// Create new Card
      	$scope.create = function() {
           // Create new Card object
           var timelog = [];

           var url = this.url.toLowerCase().split(' ').join('');

           var card = new Cards ({
                name: this.name,
                url: url, // remove space in Card URL and convert to lowercase;;;
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
                $scope.url = '';
                logger.success("New card created successfully.");
           }, function(errorResponse) {
                $scope.error = errorResponse.data.message;
           });
      	};

        window.updateCard = function() {
            $scope.create();
        };

      	$scope.removeImageAtIndex = function(index) {
           $scope.card.images.splice(index, 1);
      	};
      	$scope.addNewImage = function() {
           $scope.card.images.push({
                url: '',
                note: ''
           });
      	};
      	$scope.upload = function(index) {
      		cardsHelper.upload($scope, index);
      	};
 	}

}());   	