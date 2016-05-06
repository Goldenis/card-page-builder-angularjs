'use strict';

angular.module('core').service('IntercomSvc', function($window) {
	this.trackEvent = function (eventName, metadata) {
		if (!$window.Intercom) return;

		if (!eventName) {
			console.error('unable to track unnamed Intercom event');
			return;
		}

		$window.Intercom('trackEvent', eventName, metadata);
	};
});
