'use strict';

// Configuring the Articles module (ui.sortable is angular module for drag drop)
angular.module('pages',['vAccordion', 'ui.sortable'])
     .run(['Menus','$rootScope',
	function(Menus, $rootScope) {
          $rootScope.$on('$stateChangeStart', function (event, next) {
          });

		Menus.addMenuItem('topbar', 'Pages', 'pages', 'dropdown', '/pages(/create)?', false, ['SetUsersPermissions','ViewClientPrice'], 20);
		Menus.addSubMenuItem('topbar', 'pages', 'List Pages', 'pages', false, false/*, ['SetUsersPermissions']*/);
		Menus.addSubMenuItem('topbar', 'pages', 'New Page', 'pages/create', false, false/*, ['SetUsersPermissions']*/);
	}]
);
