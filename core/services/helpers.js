(function(_) {
    'use strict';

    _.mixin({
        buildUrl: function(str) {
            return _.safeUrl((str || '').replace(/\/./g, '')).toLowerCase();
        },
        safeUrl: function (str) {
            if (typeof str != 'string') return str;
            return str
                .replace(/[-\s]+/g, '-') // replace whitespaces with dashes
                .replace(/[,\\!@#$%\^&\*;:()<>[\]{}=+`~?'"]/g, ''); // remove punctuation
        },
        absPageUrl: function (page, client) {
            client = client || page.client;
            var result = ('~/' + (page.path || page.url || _.buildUrl(page.name) || ''))
                .replace(/\/+/g, '/') // no double slashes
                .replace('~/', page.status == 'Live' ? client.production_url : client.beta_url);
            return result;
        },
        unionItems: function (arr1, arr2) {
            var arrs = _.toArray(arguments).map(function (arr) { return arr instanceof Array ? arr : [arr]; });
            var result = _.compact(_.union.apply(_, arrs));
            return result;
        },
        findItemByKey: function(arr, key) {
            var item = _.find(arr, function(item) { return key in (item || {}); }) || null;
            return item;
        },
        replicate: function(count, item) {
            if (typeof item == 'string') {
                return new Array(Math.max(0, count + 1)).join(item) || '';
            }
            else if (item instanceof Array) {
                return _.flatten(_.range(count).map(function() { return item; }));
            }
            else {
                throw Error('unsupported type', item);
            }
        },
        removeItem: function(arr, item) {
            if (!arr) return false;
            var index = arr.indexOf(item);
            if (index === -1) return false;
            arr.splice(index, 1);
            return true;
        }
    });

})(_);
