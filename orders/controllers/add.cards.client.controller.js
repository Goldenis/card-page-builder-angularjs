(function () {
     "use strict";

     angular
          .module('orders')
          .controller('AddCardsController', AddCardsController);

     AddCardsController.$inject = ['Orders', '$stateParams', 'logger', 'assign', 'appConfig', '$timeout', 'cardsHelper', 's3Storage'];

     function AddCardsController(Orders, $stateParams, logger, assign, appConfig, $timeout, cardsHelper, s3Storage) {
          var vm = this;
          var orderId = $stateParams.orderId;
          vm.tempCard = {};
          Orders.get({orderId: orderId}).$promise.then(function (orders) {
               vm.order = orders;
               initializeController();
          }).catch(function () {logger.error('Error getting orders')});

          function initializeController() {
               vm.indexCard = vm.indexCard || 0;
               vm.newElement = newElement;
               vm.editCard = editCard;
               vm.editElement = editElement;
               vm.removeElement = removeElement;
               vm.deleteCard = deleteCard;
               vm.openModal = openModal;
               vm.saveNewCard = saveNewCard;
               vm.uploadImage = uploadImage;
               vm.toggleDelete = toggleDelete;
               vm.deleteImage = deleteImage;
               vm.updateNote = updateNote;
               vm.checkForOwn = checkForOwn;
               vm.clear = clear;
               vm.price = appConfig.pricing;
               assign.recalculateElementsAndPrices(vm.order);
               if(vm.order.cards.length==0){vm.order.cards[vm.order.cards.length] = {elements:[], images:[]}}
               clear();

               function newElement(element, form) {
                    vm.submitted = true;
                    if(form.$valid){
                         if(!vm.updatingExisting){
                              vm.order.cards[vm.indexCard]['elements'].push(element);
                         } else{
                              vm.order.cards[vm.indexCard]['elements'][vm.currentElement]= _.extend(vm.order.cards[vm.indexCard]['elements'][vm.currentElement], element);
                         }
                         vm.tempCard = {};
                         vm.submitted = false;
                         assign.recalculateElementsAndPrices(vm.order);
                         Orders.update({orderId:vm.order._id}, vm.order).$promise.then(function (data) {
                              vm.order = data;
                              vm.updatingExisting ? logger.success('Element updated successfully') : logger.success('Element added successfully');
                              clear();
                         }).catch(function () {logger.error('Error adding element');})
                    } else {
                         logger.warning('Form is invalid');
                    }
               }

               function editCard(index) {
                    vm.indexCard = index;
               }

               function editElement(element) {
                    console.log(element.element);
                    _.contains(appConfig.ratios, String(element.ratio)) || !element.ratio?vm.editRatioWithArea = false:vm.editRatioWithArea = true;
                    _.contains(appConfig.elements, String(element.element))?vm.editElementWithArea = false:vm.editElementWithArea = true;
                    vm.tempCard = Object.create(element);
                    vm.currentElement = vm.order.cards[vm.indexCard]['elements'].indexOf(element);
                    vm.updatingExisting = true;
               }

               function saveNewCard() {
                    vm.indexCard = vm.order.cards.length;
                    vm.order.cards[vm.order.cards.length] = {elements: []};
               }

               function toggleDelete() {
                    vm.deleteRequest = !vm.deleteRequest;
               }

               function deleteImage(image) {
                    vm.order.cards[vm.indexCard].images.splice(vm.order.cards[vm.indexCard].images.indexOf(image), 1);
                    Orders.update({orderId:vm.order._id}, vm.order).$promise.then(function (orders) {
                         vm.order = orders;
                         logger.success('Image deleted successfully');
                    })
               }

               function removeElement(element) {
                    vm.order.cards[vm.indexCard]['elements'].splice(vm.order.cards[vm.indexCard]['elements'].indexOf(element), 1);
                    assign.recalculateElementsAndPrices(vm.order);
                    Orders.update({orderId:vm.order._id}, vm.order).$promise.then(function (data) {
                         vm.order = data;
                         logger.success('Element successfully deleted');
                    }).catch(function () {logger.error('Error deleting element');})
               }

               function deleteCard() {
                    $('#deleteModal').modal2('hide');
                    var index = vm.order.cards.indexOf(vm.selectedCard);
                    vm.order.cards.splice(index, 1);
                    assign.recalculateElementsAndPrices(vm.order);
                    Orders.update({orderId:vm.order._id}, vm.order).$promise.then(function (orders) {
                         vm.order = orders;
                         if(vm.order.cards.length==0){vm.order.cards[vm.order.cards.length] = {elements:[]}}
                         index >= vm.order.cards.length ? vm.indexCard = vm.order.cards.length-1 : vm.indexCard = index;
                         logger.success('Card deleted successfully');
                    }).catch(function () {
                         logger.error('Error deleting card');
                    })
               }

               function openModal(card, index) {
                    vm.deleteIndex = index+1;
                    vm.selectedCard = card;
                    $('#deleteModal').modal2('show');
               }

               function uploadImage(files) {
                    $timeout(function () {vm.imageUploading = true});
                    var uniqName = cardsHelper.generateUniqueName(files[0].name);

                    if (!vm.order.cards[vm.indexCard].images) {
                         vm.order.cards[vm.indexCard].images = [];
                    }

                    var newImage = { url: s3Storage.resolveUrl(uniqName) };
                    vm.order.cards[vm.indexCard].images.unshift(newImage);

                    s3Storage.uploadOptimized(uniqName, files[0]).then(function (url) {
                         newImage.url = url;
                         $timeout(function () {vm.imageUploading = false});
                         return Orders.update({orderId:vm.order._id}, vm.order).$promise.then(function (orders) {
                              vm.order = orders;
                         });
                    }).then(function () {
                         logger.success('Image uploaded successfully');
                    }).catch(function () {
                         logger.error('Error uploading image');
                    });
               }

               function updateNote(note, imageIndex) {
                    vm.order.cards[vm.indexCard].images[imageIndex]['note'] = note;
                    Orders.update({orderId:vm.order._id}, vm.order).$promise.then(function (orders) {
                         vm.order = orders;
                         logger.success('Note updated successfully');
                    }).catch(function () {
                         logger.error('Error updating note');
                    })
               }

               function checkForOwn(data) {
                    if(data.element=='Write your own'){
                         vm.writeOwnElement = true;
                         vm.tempCard.element = '';
                         $timeout(function(){$('#writeOwnElement').focus();},100);
                    }
                    if(data.ratio=='Write your own'){
                         vm.writeOwnRatio = true;
                         vm.tempCard.ratio = '';
                         $timeout(function(){$('#writeOwnRatio').focus();},100);
                    }
               }

               function clear() {
                    vm.tempCard = {};
                    vm.updatingExisting = false;
                    vm.writeOwnElement = false;
                    vm.writeOwnRatio = false;
                    vm.editElementWithArea = false;
                    vm.editRatioWithArea = false;
                    vm.submitted = false;
                    $('#addNumber').focus();
               }
          }
     }

}());
