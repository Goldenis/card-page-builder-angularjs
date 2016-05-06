"use strict";

(function (MediumEditor) {
    var AnchorExtension = MediumEditor.extensions.anchor;

    var _getInput = AnchorExtension.prototype.getInput;
    AnchorExtension.prototype.getInput = function () {
        if (!this.pages) return _getInput.apply(this, arguments);
        return this.getForm().querySelector('.medium-editor-toolbar-input');
    };

    var _attachFormEvents = AnchorExtension.prototype.attachFormEvents;
    AnchorExtension.prototype.attachFormEvents = function (form) {
        if (!this.pages) return _attachFormEvents.apply(this, arguments);

        var $form = $(form);
        var $select = $('<select class="medium-editor-toolbar-input" placeholder="' + (this.base.options.anchorInputPlaceholder || '') + '">');
        $form.find('.medium-editor-toolbar-input').replaceWith($select);

        $form.on('change', '.medium-editor-toolbar-anchor-google-tracking', function (e) {
            var value = $(e.target).prop('checked');
            var $gt = $form.find('.google-tracking-form');
            value ? $gt.show() : $gt.hide();
        });

        _attachFormEvents.apply(this, arguments);

        $select.selectize({
            create: true,
            createOnBlur: true,
            preload: true,
            valueField: 'url',
            labelField: 'name',
            sortField: 'name',
            searchField: ['name', 'url'],
            load: function (query, callback) {
                this._loadOptions(callback);
            }.bind(this)
        });

        // prevent closing the form
        var dropdown = $form.find('.selectize-dropdown')[0];
        this.base.on(dropdown, 'mousedown', function (e) {
            e.stopPropagation();
            e.preventDefault();
        }, true);

        // restore text selection on input blur
        var selectInput = $form.find('input')[0];
        this.base.on(selectInput, 'blur', function () {
            this.base.importSelection(this._oldSelection);

            // workaround medium editor bug - impossible to set up link for first word in editable content
            if (!MediumEditor.selection.isActive()) {
                var selection = angular.copy(this._oldSelection);
                delete selection.emptyBlocksIndex;

                // adjust selection to respect whitespaces before
                selection.start++;
                if (selection.start == selection.end) {
                    selection.end++;
                }

                this.base.importSelection(selection);
            }
        }.bind(this));
    };

    var _showForm = AnchorExtension.prototype.showForm;
    AnchorExtension.prototype.showForm = function () {
        var result = _showForm.apply(this, arguments);
        if (!this.pages) return result;

        this._oldSelection = this.base.exportSelection();

        // reset form
        var $form = $(this.getForm());
        $form.addClass('selectize');
        $form.find(':input').val('');
        $form.find('input[type="checkbox"]').prop('checked', false);
        $form.find('.google-tracking-form').hide();

        var selectize = $form.find('select')[0].selectize;
        selectize.setValue('', true);
        selectize.load(this._loadOptions.bind(this));

        return result;
    };

    var _getTemplate = AnchorExtension.prototype.getTemplate;
    AnchorExtension.prototype.getTemplate = function () {
        var template = _getTemplate.apply(this, arguments);

        var $template = $('<div>').html(template);

        // make label checkable
        var newWindowCheckboxId = 'newWindowCheckbox';
        $template.find('.medium-editor-toolbar-anchor-target').attr('id', newWindowCheckboxId);
        $template.find('label').first().attr('for', newWindowCheckboxId);

        var googleTrackingCheckboxId = 'googleTrackingToggle';
        var $toggle = $('<div>').addClass('medium-editor-toolbar-form-row google-tracking-toggle');
        $('<input type="checkbox">').addClass('medium-editor-toolbar-anchor-google-tracking').attr('id', googleTrackingCheckboxId).appendTo($toggle);
        $('<label>Add tracking data</label>').attr('for', googleTrackingCheckboxId).appendTo($toggle);
        $toggle.insertBefore($template.find('.medium-editor-toolbar-form-row'));

        var $row = $('<div>').addClass('medium-editor-toolbar-form-row google-tracking-form').hide();
        $row.append('<h4>GOOGLE EVENT TRACKING</h4>');
        $row.append(['Category', 'Action', 'Label', 'Value'].map(function (label) {
            var $div = $('<div layout="row">').addClass('event-' + label.toLowerCase());
            $('<label>').attr('for', label).text(label).appendTo($div);
            $('<input type="text" flex>').attr('id', label).appendTo($div);
            return $div[0];
        }));
        $template.append($row);

        return $template.html();
    };

    AnchorExtension.prototype._loadOptions = function (callback) {
        this.pages.then(function (opts) {
            var selectedClient = this.selectedClient();

            // filter options by client
            opts = selectedClient ? _.filter(opts, function (opt) {
                return opt.client && opt.client._id == selectedClient._id;
            }) : [];

            (opts || []).forEach(function (opt) {
                opt.url = opt.url || _.buildUrl(opt.name);
            });

            callback(opts);
        }.bind(this));
    };

    // Called when the button the toolbar is clicked
    // Overrides ButtonExtension.handleClick
    var _handleClick = AnchorExtension.prototype.handleClick;
    AnchorExtension.prototype.handleClick = function (event) {
        var range = MediumEditor.selection.getSelectionRange(this.document);
        if (range.startContainer.nodeName.toLowerCase() === 'a' ||
            range.endContainer.nodeName.toLowerCase() === 'a' ||
            MediumEditor.util.getClosestTag(MediumEditor.selection.getSelectedParentElement(range), 'a')) {
            selectNode(MediumEditor.util.getClosestTag(MediumEditor.selection.getSelectedParentElement(range), 'a'));
        }

        return _handleClick.apply(this, arguments);
    };

    var _getFormOpts = AnchorExtension.prototype.getFormOpts;
    AnchorExtension.prototype.getFormOpts = function () {
        var opts = _getFormOpts.apply(this, arguments);

        var $form = $(this.form);
        if ($form.find('.medium-editor-toolbar-anchor-google-tracking').prop('checked')) {
            opts.gaEventTrack = {
                category: $form.find('#Category').val(),
                action: $form.find('#Action').val(),
                label: $form.find('#Label').val(),
                value: $form.find('#Value').val()
            };
        }

        return opts;
    };

    var _createLink = MediumEditor.prototype.createLink;
    MediumEditor.prototype.createLink = function (opts) {
        var currentSelection = this.options.contentWindow.getSelection();
        var imgSelected = currentSelection && currentSelection.isCollapsed
            && (currentSelection.anchorNode.nodeName.toLowerCase() == 'img' ? currentSelection.anchorNode : currentSelection.anchorNode.querySelector('img'));

        if (imgSelected) {
            var customEvent, i;
            var currentEditor = MediumEditor.selection.getSelectionElement(this.options.contentWindow);

            try {
                this.events.disableCustomEvent('editableInput');
                if (opts.url && opts.url.trim().length > 0) {
                    // since we are going to create a link from an extracted text,
                    // be sure that if we are updating a link, we won't let an empty link behind (see #754)
                    // (Workaroung for Chrome)
                    this.execAction('unlink');
                    $(currentSelection.anchorNode).find('a').contents().unwrap();

                    // Creates the link in the document fragment
                    MediumEditor.util.createLink(this.options.ownerDocument, [imgSelected], opts.url.trim());

                    if (this.options.targetBlank || opts.target === '_blank') {
                        MediumEditor.util.setTargetBlank(MediumEditor.selection.getSelectionStart(this.options.ownerDocument), opts.url);
                    }

                    if (opts.buttonClass) {
                        MediumEditor.util.addClassToAnchors(MediumEditor.selection.getSelectionStart(this.options.ownerDocument), opts.buttonClass);
                    }

                    selectNode(imgSelected);
                }
                // Fire input event for backwards compatibility if anyone was listening directly to the DOM input event
                if (this.options.targetBlank || opts.target === '_blank' || opts.buttonClass) {
                    customEvent = this.options.ownerDocument.createEvent('HTMLEvents');
                    customEvent.initEvent('input', true, true, this.options.contentWindow);
                    for (i = 0; i < this.elements.length; i += 1) {
                        this.elements[i].dispatchEvent(customEvent);
                    }
                }
            } finally {
                this.events.enableCustomEvent('editableInput');
            }
            // Fire our custom editableInput event
            this.events.triggerCustomEvent('editableInput', customEvent, currentEditor);
        }
        else {
            var result = _createLink.apply(this, arguments);

            var $selected = $(MediumEditor.selection.getSelectedElements(document));
            if ($selected.closest('.editable').length == 0) return;

            var $link = $selected.filter('a').add($selected.find('a'));
            var gaHandler = gaEventHandler(opts.gaEventTrack);
            if (gaHandler) $link.attr('onclick', gaHandler);

            return result;
        }
    };

    function selectNode(node) {
        var range = document.createRange(),
            sel = document.getSelection();
        range.selectNode(node);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function gaEventHandler(opts) {
        if (!opts) return;
        var attrs = [opts.category, opts.action, opts.label, opts.value];
        var params = attrs.map(escapeJsAttr).map(wrapper("'")).join(", ");
        var handler = "ga('send', 'event', " + params + ")";
        return handler;
    }

    function escapeJsAttr(attr) {
        return (attr || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

    function wrapper(str) {
        return function(content) {
            return str + (content || '') + str;
        };
    }

})(MediumEditor);
