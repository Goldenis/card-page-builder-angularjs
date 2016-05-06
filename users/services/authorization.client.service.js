'use strict';

// Authorization service for user variables
angular.module('users').service('Authorization', ['Authentication',
	function(Authentication) {
		var self = this;

        self.isAuthorized = function (state, user) {
            user = user || Authentication.user;
            var authRules = state.authorize;

            // allow by default if no rules specified
            if (authRules === undefined || authRules === null) return true;

            var authorized = typeof authRules == 'boolean' ? authRules : true;
            if (!authorized || !user || !user.role) return authorized;

            authRules = _.compact(authRules instanceof Array ? authRules : [authRules]);
            if (!authRules.length) return authorized;

            var denyRules = _.filter(authRules, function (rule) { return rule[0] === '!'; });
            var allowRules = _.difference(authRules, denyRules);

            // evaluate deny rules
            authorized = authorized && !_.contains(resolveRoles(denyRules), user.role);

            // evaluate allow rules
            authorized = authorized && (!allowRules.length || _.contains(resolveRoles(allowRules), user.role));

            return authorized;
        };

        function resolveRoles(rules) {
            return _.map(rules, function (rule) {
                return rule[0] === '!' ? rule.substr(1) : rule;
            });
        }
	}
]);
