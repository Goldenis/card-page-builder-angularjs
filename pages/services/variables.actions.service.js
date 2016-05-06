(function () {
     "use strict";

     angular
          .module('pages')
          .factory('cardData', cardData);

     cardData.$inject = [ 'Cards', 'cardsHelper', 'Clients', 'Pages'];

     function cardData( Cards, cardsHelper, Clients, Pages) {
          var pageCards = [];
          var activeCard, clients, allCards;
          return {
               getPage: getPage,
               getClient: getClient,
               getClients: getClients,
               getAllCards: getAllCards,
               getClientCards: getClientCards,
               getPageCards:getPageCards,
               addCardToPage: addCardToPage,
               setActiveCard: setActiveCard,
               getActiveCard: getActiveCard,
               getCardActions: getCardActions,
               getCardVariables: getCardVariables,
               removeCard: removeCard,
               duplicateCard: duplicateCard,
               resetScopeVariables:resetScopeVariables
          };

          function resetScopeVariables(card) {
               card.tempActions = JSON.parse(JSON.stringify(card.actions || []));
               if (card.actions != undefined) {
                    card.actions.forEach(function (action) {
                         if (action != undefined) {
                              var key = Object.keys(action)[0];
                              action[key] = '{{'+key+'}}';
                         }
                    });
               }
          }

          function getPage(pageId) {
               return Pages.get({pageId: pageId});
          }

          function removeCard(recievedCards, card) {
               var index = recievedCards.indexOf(card);
               recievedCards.splice(index, 1);
          }

          function duplicateCard(recievedCards, card) {
              var cardClone = angular.copy(card);
              var index = recievedCards.indexOf(card);
              recievedCards.splice(index, 0, cardClone);
          }

          function getClients() {
               if (angular.isDefined( clients ) ) return $q.when( clients );
               return Clients.query().$promise.then(function(allClients) {
                    return allClients;
               });
          }

         function getClient(name) {
             if (angular.isDefined( clients ) ) return $q.when(_.where(clients, { companyName: name })[0]);
             return Clients.query({ name: name }).$promise.then(function(clients) {
                 return clients[0];
             });
         }

          function getAllCards() {
               //console.log('allCards', allCards);
               if (angular.isDefined( allCards ) ) return $q.when( allCards );
               return Cards.query().$promise.then(function(cards) {
                    //console.log('cards', cards);
                    return cards;
               });
          }

          function getClientCards(client, forceQuery) {
              if (forceQuery) {
                  return Cards.query({ clientName: client.companyName }).$promise.then(function (cards) {
                      //console.log('cards', cards);
                      return cards;
                  });
              }
              else {
                  return cardsHelper.clientCards(getAllCards(), client);
              }
          }

          function addCardToPage(card) {
               pageCards.push(card);
          }

          function getPageCards() {
               return pageCards;
          }

          function setActiveCard(card) {
               activeCard = card;
          }

          function getActiveCard() {
               return activeCard;
          }

          function getCardVariables(index) {
               return pageCards[index].variables;
          }

          function getCardActions(index) {
               return pageCards[index].actions;
          }



     }

}());

