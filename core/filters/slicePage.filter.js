'use strict';

angular.module('core').filter('slicePage', function() {
     return function (collection, page, size) {
          if (!collection || !collection.slice) return collection;

          page = parseInt(page || 0, 10);
          size = parseInt(size || 1000000, 10);

          var pageItems = collection.slice(page * size, (page+1) * size);
          return pageItems;
     };
});
