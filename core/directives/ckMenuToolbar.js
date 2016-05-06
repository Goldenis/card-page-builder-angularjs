(function () {
    "use strict";

    angular
        .module('core')
        .directive('ckMenuToolbar', ['$interpolate', '$timeout', 'Authentication', 'Clients', 'clientHelper', 'Menus', '$q', function ($interpolate, $timeout, Authentication, Clients, clientHelper, Menus, $q) {
            return {
                scope: {
                    autoHide: '='
                },
                transclude: true,
                templateUrl: 'modules/core/views/header.client.view.html',
                link: function (scope, element, attrs, ctrl, transclude) {
                    scope.flexHeader = scope.autoHide;
                    scope.authentication = Authentication;
                    scope.menu = Menus.getMenu('topbar');

                    scope.$watch(function () { return Authentication.user; }, function (user) {
                        scope.me = user;
                        requestAdditionalLinks(Authentication.clients()).then(function (links) {
                            scope.additional_links = links;
                        });
                    });

                    transclude(function (content) {
                        $timeout(function () {
                            var $toolbar = $(element).find('.md-toolbar-tools');
                            $toolbar.find('.transcluded').remove();
                            $toolbar.prepend(content.addClass('transcluded'));
                        });
                    });
                }
            };

            function requestAdditionalLinks(userClients) {
                if (userClients && userClients.length) {
                    return Clients.query().$promise.then(function (clients) {
                        var clients = userClients.map(function(client) { return clientHelper.getClientByName(clients, client); });
                        var result = _.chain(clients).pluck('additional_links').flatten().uniq('url').value();
                        return result;
                    });
                }
                else {
                    return $q.when([]);
                }
            }
        }]);

}());
