(function () {
     'use strict';

     angular
          .module('cards')
          .factory('cardsHtmlHelper', cardsHtmlHelper);

     cardsHtmlHelper.$inject = [];

     function cardsHtmlHelper() {
          var service = {
               cleanUpCardHtml                : cleanUpCardHtml,
               compileCardHtml                : compileCardHtml,
               assembleCardHtml               : assembleCardHtml,
          };
          return service;

         function cleanUpCardHtml(html) {
             var newHtml = html;

             // jQuery bug: it can't handle <a> inside <a> and split them up.
             // you can try and compare: $('<div><a href="#test1"><div>test <a href="#test2">link</a></div></a><div>').html()
             // $(html).remove('.medium-insert-buttons');

             // strip out .medium-insert-buttons element manually
             var start = newHtml.indexOf('<div class="medium-insert-buttons');
             while (start >= 0) {
                 var end = newHtml.indexOf('</div>', start);
                 newHtml = newHtml.substring(0, start) + newHtml.substring(end + '</div>'.length);
                 start = newHtml.indexOf('<div class="medium-insert-buttons');
             }

             // remove not yet uploaded images
             var $tmp = $('<div>').html(newHtml);
             $tmp.find('.image.uploading').remove();
             newHtml = $tmp.html();

             // remove redundant classes caused by Angular inline bindings in class attribute that are saved improperly
             // (probably due to race condition between DOM saving and Angular animation).
             newHtml = newHtml.replace(/[^ {}"\\]*-add-add[^ {}"\\]*/g, '');

             // remove duplicated classes that crash the whole page builder down.
             $(newHtml).find('[class]').each(function () {
                 var list = this.classList;
                 var classes = _.uniq(list);

                 var redundantClasses = _.filter(classes, function(cl) { return cl.indexOf('-add-add') || cl.indexOf('add-remove'); });
                 _.each(redundantClasses, function (cl) { list.remove(cl); });

                 var duplicates = _.filter(classes, function(cl) { return _.filter(list, function(li) { return cl == li; }).length > 1; });
                 _.each(duplicates, function (cl) {
                     list.remove(cl); // including duplicates
                     list.add(cl);
                 });
             });

             newHtml = assembleCardHtml(newHtml);

             return newHtml;
         }

         function compileCardHtml(html, card) {
             html = cleanUpCardHtml(html);

             //var repeatVars = _.chain(card.variables).where({ kind: 'Repeat' }).pluck('shortCode').value();
             var repeatVars = _.uniq(getMatches(html, /{{\/([^}]+)}}/g));

             // compile Repeat card variables
             html = html.replace(/\n/g, '');
             repeatVars.forEach(function (repeat) {
                 var repeatBlockRegex = new RegExp('{{' + repeat + '}}(.*?){{/' + repeat + '}}', 'gi');
                 html = html.replace(repeatBlockRegex, function (m, content) {
                     var action = _.findItemByKey(card.actions, repeat);
                     var count = action && parseInt(action[repeat], 10) || 0;

                     // resolve template
                     var $content = $('<div>').html(content);
                     var template = $content.find('>template').htmlOuter() || ('<template>' + content + '</template>');

                     // resolve items
                     var $items = $content.find('>item').filter(function(i) { return i < count; });
                     var items = $items.htmlOuter() + _.replicate(count - $items.length, '<item>' + $(template).html() + '</item>');

                     var result = '<div class="repeat-variable" name="' + repeat + '">' + template + items + '</div>';
                     return result;
                 });
             });

             // strip out extra closing repeat tags, like {{/count}} without pair
             html = html.replace(/{{\/[^}]+}}/gi, '');

             return html;
         }

         function assembleCardHtml(html) {
             var $container = $('<div>').html(html);

             $container.find('.repeat-variable').each(function() {
                 var varName = $(this).attr('name');
                 $(this).prepend('{{' + varName + '}}').append('{{/' + varName + '}}');
             }).contents().unwrap();

             var html = $container.html();
             return html;
         }

         //
         // PRIVATE FUNCTIONS
         //

         function getMatches(text, regex, index) {
             index = typeof index == 'number' ? index : 1;
             var matches, output = [];
             while (matches = regex.exec(text)) {
                 output.push(matches[index]);
             }
             return output;
         }
     }
})();
