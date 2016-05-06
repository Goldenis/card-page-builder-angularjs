(function () {
     "use strict";

     angular
          .module('pages')
          .filter('escapeHtml', function () {

               var entityMap = {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': '&quot;',
                    "'": '&#39;',
                    "/": '&#x2F;',
                    "{": '&lbrace;',
                    "}": '&rbrace;'
               };

               return function(str) {
                    console.log('radin escape');
                    return String(str).replace(/[&<>"'\{}/]/g, function (s) {
                         return entityMap[s];
                    });
               }
          });

}());



