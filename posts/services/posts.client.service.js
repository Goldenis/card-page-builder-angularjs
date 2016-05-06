"use strict";

angular
     .module('posts')
     .factory('Posts', Posts);

Posts.$inject = ['$resource'];

function Posts($resource) {
     return $resource('posts/:postId', {
          postId: '@postId',
          client: '@clientName'
     }, {
          update: {
               method: 'PUT'
          }
     });
}
