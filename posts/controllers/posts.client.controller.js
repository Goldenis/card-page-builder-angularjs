"use strict";

angular
    .module('posts')
    .controller('PostsController', PostsController);

PostsController.$Inject = ['$scope', 'Authentication', 'appConfig', 'logger', '$timeout', 'editorService', 's3Storage', 'Posts', '$mdDialog', 'Clients', '$q', '$cookieStore', '$sce'];

function PostsController($scope, Authentication, appConfig, logger, $timeout, editorService, s3Storage, Posts, $mdDialog, Clients, $q, $cookieStore, $sce) {
    var EXCERPT_SIZE = 140;
    $scope.PostForm = $scope.PostForm || {};

    var vm = this;
    vm.me = Authentication.user;
    vm.ui = {};
    vm.error = {};

    vm.statuses = appConfig.postStatuses;
    vm.statusActions = ['Draft', 'Schedule Post', 'Publish Now', 'Archive Post'];
    vm.categories = [];
    vm.posts = [];
    vm.clients = [];
    vm.selectedClient = '';

    vm.newPost = function (force) {
        var post = { status: 'Draft' };
        if (!force && confirmDiscardRequired(post, function () { vm.newPost(true); })) return;
        vm.edit(post, true);

        if (vm.editPost && !vm.editPost.client) {
            vm.editPost.client = _.findWhere(vm.clients, { companyName: vm.selectedClient }) || vm.client;
            if ((vm.editPost.client || {})._id) vm.editPost.client = vm.editPost.client._id;
            pristineForm();
        }

        // make sure content is reset
        $timeout(function () {
            vm.post.content = '';
            vm.editPost.content = '';
            rerenderEditor(vm.editPost);
        });
    };

    vm.savePost = function (post) {
        post.client = post.client && post.client._id || post.client;
        if (vm.clients.length == 1) post.client = vm.clients[0]._id;
        if (!post.client) return logger.error(vm.error.client = 'Client not specified');

        post.content = editorService.cleanUpHtml(post.content);
        post.excerpt = post.excerpt || excerptText(post.content);

        if (vm.postScheduleDate) {
            vm.postScheduleTime = vm.postScheduleTime || moment(vm.postScheduleDate).startOf('day').toDate();
            var timePart = moment(vm.postScheduleTime).diff(moment(vm.postScheduleTime).startOf('day'));
            post.scheduled = moment(vm.postScheduleDate).startOf('day').add(timePart).toDate();
        }

        vm.client = _.findWhere(vm.clients, { _id: post.client });
        if (vm.client) $cookieStore.put('post-client', vm.client.companyName);

        if (!post._id) { // create
            Posts.save(post).$promise.then(function (post) {
                post.author = vm.me;
                pristineForm();

                vm.posts.unshift(post);
                vm.cancel(vm.editPost, false, true);
                logger.success('Successfully created post ' + post.title);
            }).catch(function (respose) {
                var error = respose.data.message || 'Saving error';
                logger.error(error);
            });
        }
        else { // update
            var originalPost = vm.post;
            Posts.update({postId: post._id}, post).$promise.then(function (newPost) {
                angular.extend(originalPost, newPost);
                angular.extend(post, newPost);
                pristineForm();

                vm.cancel(vm.editPost, true, true);
                logger.success('Successfully updated post ' + post.title);
            }).catch(function (respose) {
                var error = respose.data.message || 'Saving error';
                logger.error(error);
            });
        }
    };

    vm.deletePost = function (post, force) {
        if (!force) {
            vm.selectedPost = post;
            $('#deletePostModal').modal2('show');
        }
        else {
            Posts.delete({postId: post._id}).$promise.then(function () {
                _.removeItem(vm.posts, post);

                if (vm.post && vm.post._id == post._id) {
                    vm.cancel(vm.post, false, true);
                }

                logger.info('Successfully deleted post ' + post.title);
            });

            $('#deletePostModal').modal2('hide');
        }
    };

    vm.updateStatus = function (post, statusAction) {
        var index = _.indexOf(vm.statusActions, statusAction);
        if (index == -1) index = _.indexOf(vm.statuses, statusAction);

        var status = vm.statuses[index];
        if (!status) return logger.error('Error changing post status');

        if (status == 'Schedule') {
            var defaultScheduled = moment().add(1, 'hour').startOf('minutes');
            vm.postScheduleDate = vm.postScheduleDate || defaultScheduled.toDate();
            vm.postScheduleTime = vm.postScheduleTime || defaultScheduled.toDate();
        }

        if (!vm.editPost && post._id && status != 'Schedule') {
            Posts.update({postId: post._id}, { status: status }).$promise.then(function (newPost) {
                angular.extend(post, newPost);
                logger.success('Changed Post status to ' + status);
            });
        }
        else {
            // update on save
            post.status = status;
            pristineForm(false);
        }
    };

    vm.updateCategories = function (post, categories) {
        categories = _.uniq(categories);

        if (angular.equals(categories, post.categories)) return;
        if (_.contains(categories, '')) return vm.assignNewCategory(post);

        if (!vm.editPost && post._id) {
            Posts.update({postId: post._id}, { categories: categories }).$promise.then(function (newPost) {
                angular.extend(post, newPost);
                vm.postCategories = newPost.categories;
                logger.success('Changed Post categories');
            });
        }
        else {
            // update on save
            vm.postCategories = post.categories = categories;
            pristineForm(false);
        }
    };

    vm.assignNewCategory = function (post, ev) {
        vm.postCategories = _.compact(vm.postCategories);

        vm.createCategory(ev).then(function (category) {
            vm.categories.unshift(category);
            vm.categories = _.uniq(vm.categories);

            vm.updateCategories(post, vm.postCategories.concat([category]));
        });
    };

    vm.createCategory = function (ev) {
        var dialogScope = $scope.$new();
        dialogScope.save = function () {
            $mdDialog.hide(dialogScope.categoryName);
        };
        dialogScope.hideDialog = function () {
            $mdDialog.cancel();
        };

        return $mdDialog.show({
            templateUrl: 'modules/posts/views/create-category.client.view.html',
            scope: dialogScope,
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: true,
            focusOnOpen: false
        });
    };

    vm.edit = function (post, force) {
        if (!force && confirmDiscardRequired(post, function () { vm.cancel(post, true); })) return;

        vm.post = post;
        vm.editPost = angular.copy(post);
        vm.editPost.client = vm.editPost.client && vm.editPost.client._id || vm.editPost.client;

        rerenderEditor(vm.editPost);
    };

    vm.cancel = function (post, editing, force) {
        var cancelEdit = typeof editing == 'boolean' ? editing : post && post == vm.editPost && !!post._id;
        if (!force && confirmDiscardRequired(post, function () { vm.cancel(post, cancelEdit, true); })) return;

        editorService.destroyEditor();
        if (cancelEdit) vm.editPost = null;
        else vm.openDetails(null, true);
    };

    vm.openDetails = function (post, force) {
        if (!force && confirmDiscardRequired(post, function () { vm.openDetails(post, true); })) return;

        editorService.destroyEditor();
        vm.post = null;
        vm.editPost = null;
        vm.postCategories = [];
        vm.postScheduleDate = null;
        vm.postScheduleTime = null;
        vm.error = {};

        // async for animation purposes
        $timeout(function() {
            vm.post = post;
            vm.postCategories = _.uniq(post && post.categories);

            var scheduled = post && post.scheduled && moment(post.scheduled).startOf('minutes');
            vm.postScheduleDate = scheduled && scheduled.toDate();
            vm.postScheduleTime = scheduled && scheduled.toDate();
        });
    };

    vm.discardChanges = function (force, callback) {
        if (!force) {
            $('#discardPostModal').modal2('show');
        }
        else {
            vm.edit(vm.post, true);

            $('#discardPostModal').modal2('hide');

            $timeout(callback || $scope.callback);
            $scope.callback = null;
        }
    };

    vm.uploadPostImage = function (file) {
        var post = vm.editPost;
        var key = s3Storage.resolveKey(file.name, vm.client);
        $scope.uploadProgress = 0;

        return s3Storage.uploadOptimized(key, file).then(function (url) {
            $timeout(function () { delete $scope.uploadProgress; }, 2000);

            post.featuredImage = post.featuredImage || {};
            post.featuredImage.url = url;
            post.featuredImage.timestamp = moment.utc();
            pristineForm(false);
        }, null, function (progress) {
            $scope.uploadProgress = progress;
        });
    };

    vm.deletePostImage = function (post, ev) {
        post.featuredImage = null;
        $scope.uploadProgress = null;
        $(ev.target).closest('.fileUploadForm')[0].reset();
        pristineForm(false);
    };

    vm.multiLabel = function (categories) {
        if (!categories) return '';
        categories = typeof categories == 'string' ? [categories] : categories;
        if (!categories.length) return '';
        return categories.length == 1 ? categories[0] : categories.length + ' items';
    };

    vm.archived = function (value, force) {
        return function (post) {
            if (!force && value && !vm.showArchived) return;
            return value ? post.status == 'Archive' : post.status != 'Archive';
        };
    };

    vm.byClient = function (client) {
        client = client && client.companyName || client;
        return function (post) {
            if (!client) return true;
            if (!post.client) return true;
            return client == post.client.companyName;
        };
    };

    vm.published = function (post) {
        if (!post) return false;
        if (post.status == 'Publish') return post.published;
        if (post.status == 'Schedule' && moment(post.scheduled) <= moment()) return post.scheduled;
        return false;
    };

    vm.decodeEditablde = function (content) {
        return $sce.trustAsHtml(content);
    };

    $scope.$watch('vm.editPost', pristineForm);

    $scope.$watchCollection('vm.posts', function (posts) {
        _.each(posts, function (post) {
            post.ui = post.ui || {};
        });
    });

    $scope.$watch('vm.selectedClient', function (clientName) {
        if (typeof clientName != 'string') return;
        $cookieStore.put('post-client', clientName || '');
    });

    $scope.$watch('vm.postScheduleTime', function () {
        $timeout(function () {
            $('input[type=time]').each(function () {
                var newTime = $(this).val().replace(/^(\d+:\d+).*$/, '$1');
                $(this).val(newTime);
            });
        });
    });

    //
    // PRIVATE FUNCTIONS
    //

    function init() {
        vm.loading = true;

        var clients = _.unionItems(vm.me.clients, vm.me.client);
        vm.selectedClient = vm.client = $cookieStore.get('post-client') || (clients.length == 1 ? clients[0] : null);

        if (vm.me.role != 'admin' && !_.contains(clients, vm.client)) {
            vm.client = null;
            vm.selectedClient = null;
        }

        if (!vm.selectedClient) vm.selectedClient = ''; // ALL

        var postsLoaded = Posts.query({ companyName: vm.client }).$promise;

        var clientsLoaded = Clients.query().$promise.then(function (clients) {
            clients = vm.me.role != 'client' ? clients : _.filter(clients, function(client) {
                return _.contains(_.unionItems(vm.me.clients, vm.me.client), client.companyName);
            });

            vm.client = (clients.length == 1 ? clients[0].companyName : null) || vm.client;
            vm.client = vm.client || $cookieStore.get('post-client') || null;
            vm.client = _.findWhere(clients, { companyName: vm.client });

            return _.sortBy(clients, 'companyName');
        });

        $q.all([postsLoaded, clientsLoaded]).then(function (responses) {
            vm.posts = responses[0];
            vm.clients = responses[1];
            vm.categories = _.chain(vm.posts).pluck('categories').flatten().compact().uniq().value();

            var companies = _.pluck(vm.clients, 'companyName');
            vm.posts = _.filter(vm.posts, function (post) {
                return !post.client || _.contains(companies, post.client.companyName);
            });
        }).finally(function () {
            vm.loading = false;
        });
    }

    var confirmed;
    function confirmDiscardRequired(post, callback) {
        if (!$scope.PostForm.$dirty || confirmed) return false;
        vm.discardChanges(false, $scope.callback = callback);
        $timeout(function () { confirmed = false; }, 200);
        return confirmed = true;
    }

    function pristineForm(value) {
        if (value === false) {
            var dirty;
            if (dirty = $scope.PostForm.$setDirty) dirty();
        }
        else {
            var pristine;
            if (pristine = $scope.PostForm.$setPristine) pristine();
        }

        if (!$scope.$$phase) $scope.$digest();
    }

    function excerptText(html) {
        var text = $('<div>').html(html).text();
        var result = text.substr(0, EXCERPT_SIZE);
        if (text.length > EXCERPT_SIZE) {
            result = result.replace(/.{3}$/, '...');
        }
        return result;
    }

    function rerenderEditor(post) {
        editorService.destroyEditor();
        $('.editable.content').html((post || {}).content || '');
        $timeout(function () {
            $('.editable.content').html((post || {}).content || '');
            editorService.renderEditor(vm.client, $scope, true);
            var unsub = $scope.$watch('PostForm.$pristine', function (value) {
                if (!value) pristineForm();
                $timeout(unsub, 500);
            });
        });
    }

    init();
}
