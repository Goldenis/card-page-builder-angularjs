(function () {
     'use strict';

     angular
          .module('users')
          .factory('assign', assign);

     assign.$inject = ['appConfig'];

     function assign(appConfig) {
          var service = {
               permissions: assignPermissions,
               validCards: returnValidCards,
               excludeByRole: excludeByRole,
               recalculateElementsAndPrices:recalculateElementsAndPrices,
               returnByRole: returnByRole
          };
          return service;

          function assignPermissions(users, user, role) {
               var index = users.indexOf(user);
               users[index].changed = true;
               switch (role) {
                    case 'developer':
                         users[index].permissions = appConfig.devPermissions;
                         break;
                    case 'client':
                         users[index].permissions = appConfig.clientPermissions;
                         break;
                    case 'team':
                         users[index].permissions = appConfig.teamPermissions;
                         break;
                    case 'admin':
                         users[index].permissions = appConfig.allPermissions;
                         break;
               }
               users[index].role = users[index].role || role;
          }

          function returnValidCards(arrayOfCards) {
               var result = [], now = new Date();
               for (var i = 0; i < arrayOfCards.length; i += 1) {
                    if ((new Date(arrayOfCards[i].expireAt)).getTime() > (new Date(now)).getTime()){
                         result.push(arrayOfCards[i].claimedId);
                    }
               }
               return result;
          }

          function excludeByRole(array, role) {
               var results = [];
               for (var i = 0; i < array.length; i += 1) {
                    if (array[i].role != role){
                         results.push(array[i]);
                    }
               }
               return results;
          }

          function returnByRole(array, role) {
               var results = [];
               for (var i = 0; i < array.length; i += 1) {
                    if (array[i].role == role){
                         results.push(array[i]);
                    }
               }
               return results;
          }

          function recalculateElementsAndPrices (order) {
               var subtotal = 0;
               var totalElements = 0;
               var totalPriceOfAllCards = 0;
               for (var c = 0; c < order.cards.length; c += 1) {
                    var numElements = 0;
                    for (var e = 0; e < order.cards[c].elements.length; e += 1) {
                         numElements += order.cards[c].elements[e]['number'];
                         totalElements += order.cards[c].elements[e]['number'];
                    }
                    //handling edge cases//
                    if(numElements>20){
                         order.cards[c]['totalPrice'] = appConfig.pricing[19][0];
                         order.cards[c]['devCost'] = appConfig.pricing[19][1];
                         order.cards[c]['estTime'] = appConfig.pricing[19][2];
                         order.cards[c]['numElements'] = numElements;
                    }
                    else if(numElements==0){
                         order.cards[c]['totalPrice'] = undefined;
                         order.cards[c]['numElements'] = undefined;
                         order.cards[c]['devCost'] = undefined;
                         order.cards[c]['estTime'] = undefined;
                    } else {
                         order.cards[c]['totalPrice'] = appConfig.pricing[numElements-1][0];
                         order.cards[c]['devCost'] = appConfig.pricing[numElements-1][1];
                         order.cards[c]['estTime'] = appConfig.pricing[numElements-1][2];
                         order.cards[c]['numElements'] = numElements;
                    }
                    totalPriceOfAllCards += order.cards[c].totalPrice;
               }
               if(totalElements>20){
                    subtotal = appConfig.pricing[19][0];
                    order.subtotal = {numberOfElements: totalElements, price: subtotal, sumPriceOfCards: totalPriceOfAllCards};
               }
               else if(totalElements==0){
                    order.subtotal = {};
               } else {
                    subtotal = appConfig.pricing[totalElements - 1][0];
                    order.subtotal = {numberOfElements: totalElements, price: subtotal, sumPriceOfCards: totalPriceOfAllCards};
               }
          }

     }
})();
