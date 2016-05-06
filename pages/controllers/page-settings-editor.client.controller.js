(function () {
     "use strict";

     angular
          .module('pages')
          .controller('PageSettingsEditorController', PageSettingsEditorController);

    PageSettingsEditorController.$Inject = ['$scope', '$mdDialog', 'Pages', '$timeout', 'logger', 's3Storage', '$q'];

    function PageSettingsEditorController($scope, $mdDialog, Pages, $timeout, logger, s3Storage, $q) {
        $scope.uploadProgress = null;

        $scope.loadClientTags = loadClientTags;
        $scope.saveDetails = saveDetails;
        $scope.hideDialog = hideDialog;
        $scope.validateDetails = validateDetails;
        $scope.uploadSocialImage = uploadSocialImage;
        $scope.deleteSocialImage = deleteSocialImage;

        $scope.$watch('page', loadPageDetails);
        $scope.$watch('pageName', function (pageName) {
            if (!$scope.pageUrlOriginal) {
                $scope.pageUrl = _.buildUrl(pageName);
            }
            if (!$scope.pageTitleOriginal) {
                $scope.pageTitle = pageName;
            }
        });

        function loadPageDetails(page) {
            $scope.pageNew = page && !page._id;
            $scope.pageName = page && page.name;
            $scope.pageUrl = page && (page.url || _.buildUrl(page.name));
            $scope.pageUrlOriginal = page && page.url;
            $scope.pageBasePath = (page && page.path || '').split('/').slice(0, -1).join('/'); // remove last pageUrl section
            $scope.pageTags = angular.copy(page && page.tags || []).map(function (tag) {
                delete tag.checked;
                return tag;
            });
            $scope.pageDescription = page && page.description;
            $scope.pageSocialImageUrl = page && page.socialImageUrl;
            $scope.pageTitle = page && (page.SEO_title || $scope.pageName);
            $scope.pageTitleOriginal = page && page.SEO_title;
            $scope.pageKeywords = page && page.SEO_keywords;
            $scope.pageClient = page && page.client && _.findWhere($scope.clients, { _id: page.client._id }) || $scope.pageClient;
            $scope.pageStatus = page && page.status;
        }

        function loadClientTags(client, query) {
            if (!client) return $q.when([]);
            return Pages.queryTags({ query: query }, { clientName: client.companyName }).$promise;
        }

        function saveDetails(edit) {
            var error = $scope.validateDetails();
            if (error) { return logger.error(error); }

            var details = {
                autoedit: edit,
                client: $scope.pageClient,
                description: $scope.pageDescription,
                name: $scope.pageName,
                SEO_title: $scope.pageTitle,
                SEO_keywords: $scope.pageKeywords,
                socialImageUrl: $scope.pageSocialImageUrl,
                tags: $scope.pageTags,
                url: $scope.pageUrl,
                path: combinePath($scope.pageBasePath, $scope.pageUrl),
                publishPending: $scope.pageStatus == 'Live' || $scope.pageStatus == 'Preview'
            };

            $mdDialog.hide(details);
        }

        function combinePath(path1, path2/*, ...*/) {
            var paths = _.compact(_.toArray(arguments));
            var result = paths.join('/').replace(/\/+/g, '/');
            return result;
        }

        function hideDialog() {
            $mdDialog.cancel();
        }

        function validateDetails() {
            if (($scope.pageName || '').trim() == '') return 'Error: Enter page name';
            if (($scope.pageUrl || '').trim() == '') return 'Error: Enter page url';
            if (($scope.pageUrl || '').indexOf('/') >= 0) return 'Error: page url can\'t contain slashes';
            if ($scope.selectClient && !$scope.pageClient) return 'Error: Select client';
            if (!isClientPageUrlUnique($scope.pagePath || $scope.pageUrl, $scope.pageClient, $scope.page)) {
                return 'Error: It looks like the page url ' + $scope.pageUrl + ' is currently being used by another page. Please change the url title in the "page settings" dialog.';
            }
        }

        function uploadSocialImage(file) {
            var key = s3Storage.resolveKey(file.name, $scope.pageClient && $scope.pageClient.companyName);
            $scope.uploadProgress = 0;

            return s3Storage.uploadOptimized(key, file).then(function (url) {
                $scope.pageSocialImageUrl = url;
            }, null, function (progress) {
                $scope.uploadProgress = progress;
            });
        }

        function deleteSocialImage(event) {
            $scope.pageSocialImageUrl = null;
            $scope.uploadProgress = null;
            $(event.target).closest('.fileUploadForm')[0].reset();
        }

        function isClientPageUrlUnique(pageUrl, client, excludePage) {
            if (!client) return true;

            var otherClientPages = _.filter($scope.pagesList.$$state.value, function (page) {
                if (excludePage && excludePage._id == page._id) return false;
                return page.client._id == client._id;
            });

            var urls = _.chain(otherClientPages).map(function(p) { return p.path || p.url; }).map(normalizeUrl).compact().value();
            return !_.contains(urls, normalizeUrl(pageUrl));
        }

        function normalizeUrl(str) {
            return (str || '').toLowerCase().replace(/^\/*|\/*$/g, '');
        }
    }

}());

