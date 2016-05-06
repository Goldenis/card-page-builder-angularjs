'use strict';

// Configuring the Articles module
angular.module('clients').run(['Menus',
	function(Menus) {
		// Set top bar menu items
		Menus.addMenuItem('topbar', 'Clients', 'clients', 'dropdown', '/clients(/create)?', false, ['ViewClientPrice'], 15);
		Menus.addSubMenuItem('topbar', 'clients', 'List Clients', 'clients');
		Menus.addSubMenuItem('topbar', 'clients', 'New Client', 'clients/create');

        Menus.addMenuItem('topbar', 'Settings', 'site/settings', '', '', false, ['client'], 30);
	}
]);
