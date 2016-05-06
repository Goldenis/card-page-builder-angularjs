(function () {
     "use strict";

     angular
          .module('orders')
          .run(run);

           run.$inject = ['Menus'];

          function run(Menus) {
               // Set top bar menu items, need to assign premissions
               //menuId, menuItemTitle, menuItemURL, menuItemType, menuItemUIRoute, isPublic, roles, position
               Menus.addMenuItem('topbar', 'Orders', 'orders', '', '', false, ['SubmitOrders'], 0);
               //Menus.addSubMenuItem('topbar', 'cards', 'List Cards', 'cards', '', false, ['ViewAllCards'], false);
               //Menus.addSubMenuItem('topbar', 'cards', 'New Card', 'cards/create', '', false, ['CreateNewCards'], false);
          }

}());
