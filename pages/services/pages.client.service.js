(function () {
     "use strict";

     angular
          .module('pages')
          .factory('Pages', Pages);

     Pages.$inject = ['$resource'];

     function Pages($resource) {
          return $resource('pages/:pageId', {
               pageId: '@pageId',
               client: '@clientName'
          }, {
               update: {
                    method: 'PUT'
               },
               queryTags: {
                   method: 'GET',
                   url: 'pages/tags/:client',
                   isArray: true
               },
               editing: {
                    method: 'PUT',
                    url: 'pages/:pageId/editing',
                    isArray: true
               },
               editingDetails: {
                    method: 'GET',
                    url: 'pages/:pageId/editing',
                    isArray: true
               },
               markAsPublished: {
                    method: 'POST',
                    url: 'pages/published/:status'
               }
          });
     }

}());

