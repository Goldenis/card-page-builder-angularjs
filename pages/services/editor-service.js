(function () {
    'use strict';

    angular
        .module('pages')
        .factory('editorService', editorService);

    editorService.$inject = ['logger', '$timeout', '$compile', 'appConfig', 'cardsHelper', '$rootScope', 'debounce', 'MediumS3ImageUploader'];

    function editorService(logger, $timeout, $compile, appConfig, cardsHelper, $rootScope, debounce, MediumS3ImageUploader) {
        var TEXT_NODE_TYPE = 3;

        var throttleTimer,
            editorSingleton,
            editorScope;

        var service = {
            renderEditor: renderEditor,
            destroyEditor: destroyEditor,
            cleanUpHtml: cleanUpHtml
        };

        $rootScope.$on('$stateChangeSuccess', function() {
            if (editorScope) {
                destroyEditor();
            }
        });

        // remove autofocus on modal shown, which hides medium editor toolbar.
        var Modal = $.fn.modal.Constructor;
        var _enforceFocus = Modal.prototype.enforceFocus;
        Modal.prototype.enforceFocus = function () {
            if (this.$element && this.$element.closest('.page.content').length) return;
            return _enforceFocus.apply(this, arguments);
        };

        return service;

        function renderEditor(client, scope, immediate) {
            if (throttleTimer) $timeout.cancel(throttleTimer);

            throttleTimer = $timeout(function () {
                if (editorScope) {
                    destroyEditor();
                }

                try {
                    editorScope = scope.$new(); // page builder nested scope
                    editorSingleton = editorFactory(client, editorScope);
                }
                catch (ex) {
                    if (ex.message == "Cannot read property 'attachCustomEvent' of undefined") return console.warn(ex);
                    throw ex;
                }
            }, immediate ? 0 : 300);
        }

        function destroyEditor() {
            try {
                console.log('destroy editor');

                if (!editorScope) {
                    console.warn('editor is already disposed');
                    return;
                }

                var $editable = $('.editable');

                if (editorScope.myEditor) {
                    $editable.off('click', '.medium-insert-buttons-show', editorScope.defaultMediumInsertEmbedHandler);
                }

                editorScope.$destroy();
                editorScope = null;

                if (editorSingleton) {
                    editorSingleton.destroy();

                    // destroy medium insert plugin
                    $editable.each(function () {
                        $(this).data('plugin_mediumInsert', null);
                        $(this).find('.medium-insert-buttons').remove();
                    });
                }
            }
            catch (ex) {
                console.error('dispose medium editor exception', ex);
            }
        }

        function editorFactory(client, scope) {
            console.log('render editor');

            var $editable = $('.editable');

            // text node inside - patch and wrap it to <p class="p"> to work properly
            $editable.each(function () {
                var $e = $(this);
                if ($e.find('>*').length == 0 && $e.text().trim() != '') {
                    $e.contents().wrap('<p class="p">');
                }
            });

            scope.myEditor = new MediumEditor($editable, buildMediumEditorOptions(scope));

            // enable medium-editor-insert-plugin
            var $mediumInsertCompatible = $editable.filter(withoutLinksInHierarchy);
            if ($mediumInsertCompatible.length > 0) {
                // stub for incompatible edtables to workaround plugin bug with undefined destroy function at:
                // >> $(el).data('plugin_' + pluginName).disable();
                $editable.not($mediumInsertCompatible).data('plugin_mediumInsert', { disable: $.noop });

                $mediumInsertCompatible.mediumInsert({
                    editor: scope.myEditor,
                    addons: {
                        images: null,
                        embeds: {
                            placeholder: 'Paste a link and press Enter'
                        }
                    }
                });
            }

            scope.defaultMediumInsertEmbedHandler = function(e) {
                var embeds = $(e.target).closest('.editable').data('plugin_mediumInsertEmbeds');
                if (!embeds) return;
                embeds.add();
            };

            $editable.on('click', '.medium-insert-buttons-show', scope.defaultMediumInsertEmbedHandler);
            $editable.on('click', 'img', function () { selectNode(this); });

            function selectNode(node) {
                var range = document.createRange(),
                    sel = document.getSelection();
                range.selectNode(node);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            $('.medium-editor-action-justifyFull').empty().append('<i class="fa fa-align-justify"></i>');
            $('.medium-editor-action-justifyRight').empty().append('<i class="fa fa-align-right"></i>');
            $('.medium-editor-action-justifyLeft').empty().append('<i class="fa fa-align-left"></i>');
            $('.medium-editor-action-justifyCenter').empty().append('<i class="fa fa-align-center"></i>');
            $('.medium-editor-action-anchor').empty().append('<i class="fa fa-link"></i>');
            $('.medium-editor-action-bold').empty().append('<i class="fa fa-bold"></i>');
            $('.medium-editor-action-italic').empty().append('<i class="fa fa-italic"></i>');
            $('.medium-editor-action-unorderedlist').empty().append('<i class="fa fa-list-ul"></i>');
            $('.medium-editor-action-removeFormat').empty().append('<i class="fa fa-eraser"></i>');
            $('.medium-editor-action-quote').empty().hide();

            ['editableClick', 'editableKeyup'].forEach(function (eventName) {
                scope.myEditor.subscribe(eventName, function () {
                    scope.headerModel = getEditableHeader(scope.myEditor.getSelectedParentElement());
                    $('#headerDD').val(scope.headerModel);
                });
            });

            scope.myEditor.subscribe('editableInput', function (event, editable) {
                (scope.$parent || scope).isPageDirty = true;
                $timeout(normalizeContent.bind(this, editable, scope));
            });

            // hide medium insert buttons and placeholder
            scope.myEditor.subscribe('editableBlur', function (event, editable) {
                var $editable = $(editable);
                var mediumInsert = $editable.data('plugin_mediumInsert');
                if (!mediumInsert) return;
                (mediumInsert.hideButtons || $.noop)();
                $editable.find('.medium-insert-embeds-active').remove();
            });

            // align medium insert plus sign relative to cursor position, which depends on text-align property.
            var positionInsertButtons = debounce(100, function(e) {
                var $editable = $(e.target).closest('.editable');
                var $text = $editable.find('.medium-insert-active');
                if (!$text.length) return;

                var align = $text.css('text-align');
                $editable.find('.medium-insert-buttons').css('margin-left', align == 'center' ? '48%' : (align == 'right' ? '98%' : 0));
            });
            scope.myEditor.subscribe('editableKeyup', positionInsertButtons);
            scope.myEditor.subscribe('editableClick', positionInsertButtons);

            if (client) {
                $timeout(function () {
                    render(scope.myEditor, client, scope);
                });
            }

            return scope.myEditor;
        }

        function withoutLinksInHierarchy(i, element) {
            var $e = $(element);
            return !$e.is('a')
                && $e.closest('a').length == 0
                && $e.find('a').length == 0;
        }

        function buildMediumEditorOptions(scope) {
            return {
                toolbar: {
                    buttons: ['quote', 'bold', 'italic', 'unorderedlist', 'anchor', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'removeFormat', 'colors', 'clientFonts', 'headerDropDown', 'placeholder']
                },
                buttonLabels: 'fontawesome',
                placeholder: false,
                imageDragging: false,
                hideToolbar: function () {
                    scope.$parent.$apply();
                },
                anchor: {
                    targetCheckbox: true, // enables external link feature
                    targetCheckboxText: 'New Window',
                    pages: scope.$parent.pagesList,
                    selectedClient: function () {
                        return (scope.$parent || scope).selectedClient;
                    }
                },
                extensions: {
                    'colors': new MediumButton({
                        label: '<span id="colorpicker"></span>',
                        action: function (html, mark) {
                            $timeout(function () {
                                // color links separately to have underline of the same selected color
                                var $selected = $(MediumEditor.selection.getSelectedElements(document));
                                var $selectedLinks = $selected.find('a');

                                var $parentA = $selected.closest('a');
                                if ($parentA.find('.editable').length) $parentA = [];
                                $selectedLinks = $selectedLinks.add($parentA);

                                $selectedLinks.each(function () {
                                    this.style.setProperty('color', scope.colorChoice, 'important');
                                });

                                $selectedLinks.find('span.color').contents().unwrap();
                            });

                            var content = stripTags(html, 'span.color');
                            var $container = $('<div>').append($('<span>').append(content));
                            $container.find('*:not(a)').addClass('color').css({color: scope.colorChoice});
                            var result = $container.html();
                            return result;
                        }
                    }),

                    // workaround to WebKit quirk:
                    // override native unorderedlist command, which wraps text to span with computed styles in WebKit browsers (like Chrome, Firefox, Safari),
                    // therefore clearing formatting for selected text.
                    'unorderedlist': new MediumButton({
                        label: '<i class="fa fa-list-ul"></i>',
                        action: function (html, mark) {
                            // collapse selection to text
                            editorSingleton.importSelection(editorSingleton.exportSelection());

                            return alterSelectedParagraphs(scope.myEditor, function (selectedParagraphs) {
                                var $container = $(selectedParagraphs).parentsUntil('.editable').closest('ul').last().parent();
                                $container = $container.length ? $container : $(selectedParagraphs).parent();

                                var $selectedLi = $(selectedParagraphs).closest('li');

                                if ($selectedLi.length == 0) {
                                    // make unordered list
                                    $(selectedParagraphs).wrapAll('<ul>');
                                    $(selectedParagraphs).wrap('<li>');
                                }
                                else {
                                    // reset unordered list
                                    var $prevLi = $($selectedLi.first().prevAll('li').get().reverse());
                                    var $nextLi = $selectedLi.last().nextAll('li');

                                    // unwrap selected (only) list items
                                    $selectedLi.contents().unwrap().unwrap();

                                    // wrap prev/next list items into separate <ul> tags
                                    $prevLi.wrapAll('<ul>');
                                    $nextLi.wrapAll('<ul>');
                                }

                                // clean up empty ul and li tags (e.g. caused by unwrapping all list items)
                                while ($container.find('li:empty').remove().length > 0);
                                while ($container.find('ul:empty').remove().length > 0);
                            });
                        }
                    }),
                    'clientFonts': new MediumButton({
                        label: '<span id="customFonts"></span>',
                        action: function (html, mark) {
                            return alterSelectedParagraphs(scope.myEditor, function (selectedParagraphs) {
                                $(selectedParagraphs).css({fontFamily: scope.selectedFont});
                            });
                        }
                    }),
                    'headerDropDown': new MediumButton({
                        label: '<span id="dropdown"></span>',
                        action: function (html, mark) {
                            return alterSelectedParagraphs(scope.myEditor, function (selectedParagraphs) {
                                $(selectedParagraphs).attr('class', scope.selectedHeader);
                            });
                        }
                    }),
                    's3-image-uploader': new MediumS3ImageUploader({
                        credentials: appConfig.credentialsAWS,
                        filepath: function (file, container) {
                            var client = resolveClient(container);
                            return cardsHelper.generateUniqueName(file.name, client);
                        }
                    })
                }
            };
        }

        function render(editor, client, scope) {
            var color = 0, font = 0;
            $('#colorpicker,#customFonts').empty();
            for (var i in client.variables) {
                if (client.variables[i].kind === 'Color') {
                    color++;
                    var xx = '<span class="colorblock" style="background-color: ' + client.variables[i].value + ';" ng-click="setColor(\'' + client.variables[i].value + '\')"></span>';
                    var cxx = $compile(xx)(scope);
                    $('#colorpicker').append(cxx);
                }
                if (client.variables[i].kind === 'Font') {
                    font++;
                    var yy = '<li><button title=' + client.variables[i].value + ' ng-click="setFont(\'' + client.variables[i].value + '\')" style="display:table-cell; padding:0;">' + client.variables[i].variable + '</button></li>';
                    var cyy = $compile(yy)(scope);
                    $('#customFonts').append(cyy);
                }
            }
            color === 0 ? $('#colorpicker').closest('li').hide() : $('#colorpicker').closest('li').show();
            font === 0 ? $('#customFonts').closest('li').hide() : $('#customFonts').closest('li').show();

            $('#headerDD').closest('li').remove();
            var bb = '<li><select id="headerDD" style="display:inherit;color:white;background-color:#242424;height:50px;border-radius: 8px; border: none;" ng-model="headerModel" ng-change="setHeaderValue(headerModel)">' +
                '<option value="" disabled selected style="display:none;">Select heading</option>' +
                '<option value="h1">Header 1</option>' +
                '<option value="h2">Header 2</option>' +
                '<option value="h3">Header 3</option>' +
                '<option value="h4">Header 4</option>' +
                '<option value="caption">Caption</option>' +
                '<option value="p">Body</option>' +
                '<option value="p-large">Paragraph Large</option>' +
                '<option value="pull-quotes">Pull Quotes</option>' +
                '<option value="footnote">Footnote</option></select></li>';
            var cbb = $compile(bb)(scope);
            $('.medium-editor-toolbar-actions').find('#headerDD').remove();
            $('.medium-editor-toolbar-actions').prepend(cbb);
            /****** override MediumButton defaults for dropdowns ******/
            $('#headerDD').click(function (event) {
                event.stopPropagation();
            });

            scope.setColor = function (e) {
                if (e) {
                    scope.colorChoice = e;
                }
                $('[medium-editor-model]').trigger('input');
            };
            scope.setFont = function (e) {
                if (e) {
                    scope.selectedFont = e;
                }
                $('[medium-editor-model]').trigger('input');
            };
            scope.setHeaderValue = function (e) {
                scope.selectedHeader = e;
                if (e === 'blockquote') {
                    $('.medium-editor-action-quote').trigger('click');
                } else {
                    $('.medium-editor-button-last').trigger('click');
                }
                $('[medium-editor-model]').trigger('input');
            };
        }

        function getEditableHeader(element) {
            var isEditable = $(element).is('.editable');
            if (isEditable && element.tagName.toLowerCase() !== 'p') return;
            var header = isEditable ? 'p' : $(element).attr('class') || 'p';
            return header;
        }

        function stripTags(html, tagSelector) {
            var $content = $('<p>').html(html);
            $content.find(tagSelector).contents().unwrap();
            return $content.html();
        }

        function resolveClient(container) {
            var client = $(container).closest('[data-client-name]').data('client-name');
            return client;
        }

        function alterSelectedParagraphs(editor, handler) {
            var initialSel = editor.exportSelection();

            // restore selection at the end
            $timeout(function () {
                try {
                    editor.importSelection(initialSel);

                    // hotfix: first word selection reset, start++ required
                    if (!MediumEditor.selection.isActive()) {
                        initialSel.start++;
                        editor.importSelection(initialSel);
                    }
                }
                catch (ex) {
                    console.warn(ex);
                }
            });

            var selectedParagraphs = getSelectedParagraphs(editor);
            handler(selectedParagraphs);

            // reset selection to avoid replace with return result
            document.getSelection().removeAllRanges();

            var $selectedParentEditable = $(selectedParagraphs).closest('.editable');
            if ($selectedParentEditable.length) {
                $timeout(function () {
                    var sel = editor.exportSelection();
                    $('[medium-editor-model]').trigger('input');
                    editor.events.updateInput($selectedParentEditable[0]);
                    $timeout(function () {
                        editor.importSelection(sel);
                    });
                });
            }

            // since nothing selected, return blank string for replacement
            return '';
        }

        function getSelectedParagraphs(editor) {
            var selected = MediumEditor.selection.getSelectedElements(document);
            selected = $(selected).filter('p,li');

            if (!selected.length) {
                try {
                    selected = $(editor.getSelectedParentElement());
                    selected = $(selected).filter('p,li');
                } catch (ex) {
                    console.warn('selection failed', ex);
                }
            }

            if (!selected.length) {
                try {
                    selected = $(editor.getSelectedParentElement()).closest('p,li');
                    selected = $(selected).filter('p,li');
                } catch (ex) {
                    console.warn('selection failed', ex);
                }
            }

            if (!selected.length) {
                try {
                    selected = $(editor.getSelectedParentElement());
                } catch (ex) {
                    console.warn('selection failed', ex);
                }
            }

            return selected;
        }

        function normalizeContent(editable, scope) {
            if (!editable) return;

            var $editable = $(editable);

            // add p class by default
            $editable.find('p:not([class])').addClass('p');

            // unwrap spans without user defined classes (like .color, .font)
            $editable.find('span:not([class])').contents().unwrap();

            // remove any autogenerated (without class) styles
            $editable.find('[style]:not([class])')
                .filter(function () {
                    return $(this).closest('figure').length == 0;
                }) // ignore figure content
                .removeAttr('style');

            // remove empty spans (like span.font)
            $editable.find('span:empty').remove();

            // unwrap nested p tags
            $editable.find('p > p').contents().unwrap();

            var isEmpty = $editable.text() == '';

            if (isEmpty) {
                // remove empty div blocks
                $editable.find('> div:empty').remove();
            }

            // combine adjacent <ul> tags
            $editable.find('ul:visible').map(function () {
                return $(this).nextUntil(':not(ul)').add(this);
            }).each(function (i, $adjacentULs) {
                if ($adjacentULs.length > 1) {
                    $adjacentULs.contents().unwrap().wrapAll('<ul>');
                }
            });

            // wrap children text nodes into selected style or paragraph by default
            _.each(editable.childNodes, function (node) {
                if (node.nodeType == TEXT_NODE_TYPE && node.textContent.trim() != '') {
                    $(node).wrap($('<p>').addClass(scope.selectedHeader || 'p'));
                }

                // when all the text is removed, medium editor sometimes (e.g. for Cardkit Header card) puts <br> tag,
                // which is handled in wrong way - every single letter is wrapped into separate <p> tag.
                // that happens due to focus reset to editable content element.
                var selection = document.getSelection();
                if (selection && (isEmpty || selection.focusNode == editable)) {
                    setCursorAfter(node);
                }
            });
        }

        function setCursorAfter(element) {
            var selection = document.getSelection();
            if (!selection) return;

            var range = selection.getRangeAt(0).cloneRange();
            range.setStartAfter(element);
            range.collapse(true);

            selection.removeAllRanges();
            selection.addRange(range);
        }

        function cleanUpHtml(html) {
            html = html || '';
            if (typeof html != 'string') html = $(html).html();
            var $tmp = $('<div>').html(html);

            // clean up medium editor attributes and classes
            var mediumEditorAttributes = ['aria-multiline', 'contenteditable', 'data-medium-editor-element', 'data-placeholder', 'medium-editor-index', 'role', 'spellcheck', 'medium-editor-model', 'data-medium-element', 'data-placeholder'];
            $tmp.find('.editable').each(function () {
                mediumEditorAttributes.forEach(function (attr) {
                    $tmp.find('[' + attr + ']').removeAttr(attr);
                });
            });

            var mediumEditorClasses = ['editable', 'medium-editor-insert-plugin', 'medium-editor-model', 'medium-insert-active', 'medium-editor-placeholder'];
            mediumEditorClasses.forEach(function (cl) {
                $tmp.find('.' + cl).removeClass(cl);
            });

            $tmp.find('.medium-insert-buttons').remove();
            $tmp.find('.medium-insert-embed > p').remove();

            return $tmp.html();
        }
    }
})();
