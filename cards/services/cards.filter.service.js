(function () {
     'use strict';
     angular
          .module('cards')
          .filter('myCardsFilter', myCardsFilter)
          .filter('cardsFilter', cardsFilter);

      cardsFilter.$inject = [];

      function cardsFilter(cards, searchFilter) {
        return function (cards, searchFilter) {
            var out = [];
            if (cards == undefined) return out;
            for (var i = 0; i< cards.length; i++) {
              
              if (cards[i].name.toLowerCase().indexOf(searchFilter.name.toLowerCase()) > -1) {
                var hasClient = false, hasUsers = false;
                if (searchFilter.clients.length == 0) {
                  hasClient = true;
                }
                for (var j = 0; j < searchFilter.clients.length; j++ ) {
                  if (searchFilter.clients[j].companyName ==cards[i].client){
                    hasClient = true;
                  }
                }
                if (searchFilter.users.length === 0) hasUsers = true;
                //if (searchFilter.users.indexOf(cards[i].claimedBy[0]) > -1) hasUsers = true;
                for (var j = 0; j < searchFilter.users.length; j++ ) {
                  if (cards[i].claimedBy[0] != undefined) {
                    console.log(searchFilter.users[j].displayName);
                    console.log(cards[i].claimedBy[0].displayName);
                  }
                  if (cards[i].claimedBy[0] != undefined && searchFilter.users[j].displayName == cards[i].claimedBy[0].displayName){
                    hasUsers = true;
                  }
                }
                if (hasUsers && hasClient) out.push(cards[i]);                
              }
              
            }

            return out;
        };  
      }

        myCardsFilter.$inject = [];

        function hasStatus(status_obj, status) {
          if (status_obj.length == 0 ) return true;
          return (status_obj.indexOf(status) > -1);
        }

        function myCardsFilter(cards, searchFilter) {
          return function (cards, searchFilter) {
              var out = [];
              if (cards == undefined) return out;
              for (var i = 0; i< cards.length; i++) {
                var checked = false;              
                if (cards[i].name.toLowerCase().indexOf(searchFilter.name.toLowerCase()) > -1) {
                  if (searchFilter.clients.length == 0) {
                    if (hasStatus(searchFilter.status, cards[i].cardStatus)) 
                      out.push(cards[i]);
                  }
                  for (var j = 0; j < searchFilter.clients.length; j++ ) {
                    if (searchFilter.clients[j].companyName ==cards[i].client){
                      if (hasStatus(searchFilter.status, cards[i].cardStatus)) 
                        out.push(cards[i]);
                    }
                  }
                  
                }
                
              }

              return out;
          };     
        }     	
      
})();