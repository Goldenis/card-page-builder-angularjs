(function() {
     'use strict';

     angular
          .module('cards')
          .directive('directiveLoad', directiveLoad);

     directiveLoad.$inject = ['$parse', '$timeout'];

     function directiveLoad ($parse, $timeout) {
     	return {
     		restrict: 'A',
     		link: function(scope, element, attr) {
     			var loadHandler = $parse(attr.directiveLoad);
     			$timeout(function(){
	     			$(element).on('load', function(event) {
                        scope.event = event;
                        scope.$apply(function () {
	     				    loadHandler(scope);
                        });
	     			}).each(function () {
                        if (this.complete) {
                            $(this).load();
                        }
                    });
     			});
     		}
     	};
     }
}());
