(function () {
    'use strict';

    angular
        .module('pages')
        .factory('pagesHtmlHelper', pagesHtmlHelper);

    pagesHtmlHelper.$inject = [];

    function pagesHtmlHelper() {
        var service = {
            handleConflicts: handleConflicts
        };

        return service;

        function handleConflicts(html) {
            var $dom = $('<div>').append(html);
            var excludes = [
                /\/jquery(.min)?\.js/i,
                /\/bootstrap(.min)?\.js/i
            ];
            var $excludes = $dom.find('script').filter(function (i, script) {
                return _.some(excludes, function (ex) {
                    return script.src.match(ex);
                });
            });
            $excludes.remove();
            var result = $dom.html();
            return result;
        }
    }
})();
