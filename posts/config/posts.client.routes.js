'use strict';

//Setting up route
angular.module('posts').config(['$stateProvider',
    function ($stateProvider) {
        // Posts state routing
        $stateProvider.
        state('listPosts', {
            title: 'Posts',
            url: '/posts',
            templateUrl: 'modules/posts/views/list-posts.client.view.html',
            controller: 'PostsController',
            controllerAs: 'vm'
        }).
        state('createPost', {
            title: 'New Post',
            url: '/posts/create',
            templateUrl: 'modules/posts/views/create-post.client.view.html'
        }).
        state('viewPost', {
            title: "View Post",
            url: '/posts/:postId',
            templateUrl: 'modules/posts/views/view-post.client.view.html'
        }).
        state('editPost', {
            title: "Edit Post",
            url: '/posts/:postId/edit',
            templateUrl: 'modules/posts/views/edit-post.client.view.html'
        });
    }
]);
