'use strict';

// Configuring the Articles module
angular.module('cards', ['ngSanitize','ngIdle','cfp.hotkeys'])
	.run(['Menus', 'Idle', '$rootScope', 'hotkeys',
		function(Menus, Idle, $rootScope, hotkeys) {
			$rootScope.$on('$stateChangeStart', function (event, next) {
	            if (next.name === 'editCard'){
	            	Idle.watch();

	            	hotkeys
	            	.add({
		                combo: 'mod+s',
		                description: 'Save on the edit card page',
		                allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
		                callback: function(event, hotkey) {
		                    event.preventDefault();
		                    window.updateCard();
		                }
		            });

	            }	            	
	        });
			
			// Set top bar menu items, need to assign premissions
			Menus.addMenuItem('topbar', 'Cards', 'cards', 'dropdown', '/cards(/create)?', false, ['ViewAllCards', 'ViewPurchasedCards'], 5);
			Menus.addMenuItem('topbar', 'My Cards', 'myCards', '', '', false, ['ViewMyCards'], 10);
			Menus.addSubMenuItem('topbar', 'cards', 'List Cards', 'cards', '', false, ['ViewAllCards', 'ViewPurchasedCards'], false);
			Menus.addSubMenuItem('topbar', 'cards', 'New Card', 'cards/create', '', false, ['CreateNewCards'], false);
		}
	]);
