'use strict';

// Authentication service for user variables
angular.module('users').factory('Authentication', [
	function() {
		var _this = this;

		_this._data = {
			user: window.user,
			clients: function() {
				var user = window.user;
				return user && _.unionItems(user.clients, user.client) || [];
			}
		};

		return _this._data;
	}
]);
