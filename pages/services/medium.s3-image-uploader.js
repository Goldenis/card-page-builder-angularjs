(function () {
    'use strict';

    angular
        .module('pages')
        .factory('MediumS3ImageUploader', MediumS3ImageUploader);

    MediumS3ImageUploader.$inject = ['$window', 's3Storage', 'logger'];

    function MediumS3ImageUploader($window, s3Storage, logger) {
        return $window.MediumEditor.Extension.extend({
            name: 'image-dropping-to-s3',
            init: function () {
                this.subscribe('editableDrag', this.handleDrag.bind(this));
                this.subscribe('editableDrop', this.handleDrop.bind(this));

                handleGlobalDragAndDrop(function (event) {
                    var editor = $(this.base.getFocusedElement()).closest('.editable');
                    if (editor.length) {
                        this.handleDrop(event, editor);
                        return true;
                    }
                }.bind(this));
            },
            handleDrag: function (event) {
                var className = 'medium-editor-dragover';
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';

                if (event.type === 'dragover') {
                    event.target.classList.add(className);
                    this.base.selectElement(event.target);
                } else if (event.type === 'dragleave') {
                    event.target.classList.remove(className);
                }
            },
            handleDrop: function (event, editor) {
                var className = 'medium-editor-dragover',
                    files;
                event.preventDefault();
                event.stopPropagation();

                // IE9 does not support the File API, so prevent file from opening in a new window
                // but also don't try to actually get the file
                if (event.dataTransfer.files) {
                    files = Array.prototype.slice.call(event.dataTransfer.files, 0);
                    files.some(function (file) {
                        if (file.type.match("image")) {
                            id = 'medium-img-' + (+new Date());

                            var fileReader, id;
                            fileReader = new FileReader();
                            fileReader.readAsDataURL(file);

                            event.target.classList.remove(className);
                            $(editor).find('.medium-editor-dragover').removeClass('medium-editor-dragover');

                            var focused = this.base.getFocusedElement();
                            if (focused && !isContentEmpty(focused)) {
                                var selection = this.base.exportSelection();
                                selection.start = selection.end;
                                this.base.importSelection(selection);
                            }

                            this.base.pasteHTML('<img class="medium-image-loading" id="' + id + '">');
                            $('#' + id).wrap('<p>').wrap('<span class="image">');

                            fileReader.onload = function () {
                                var img = this.base.options.ownerDocument.getElementById(id);
                                if (img) {
                                    img.removeAttribute('id');
                                    img.removeAttribute('class');
                                    img.src = fileReader.result;

                                    var $image = $(img).closest('.image').addClass('uploading');
                                    var $progress = $('<span>').addClass('progress').text('Uploading... 0%').appendTo($image);

                                    var filepath = this.filepath(file, editor);
                                    s3Storage.uploadOptimized(filepath, file).then(function (url) {
                                        img.src = url;
                                        $(img).trigger('change');
                                    }, function (err) {
                                        $image.remove(); // remove failed image
                                        console.error(err);
                                        logger.error('Failed to upload image');
                                    }, function (progress) {
                                        $progress.text('Uploading... ' + progress + '%');
                                        $(img).trigger('change');
                                    }).finally(function () {
                                        $image.removeClass('uploading');
                                        $progress.remove();
                                    });
                                }
                            }.bind(this);
                        }
                    }.bind(this));
                }
                event.target.classList.remove(className);
            },
            filepath: function (file) {
                var salt = Math.floor(Math.random() * 100).toString();
                return 'app/medium-image-' + id + '-' + salt;
            }
        });

        function isContentEmpty(element) {
            var $element = $(element);
            return $element.length == 0
                || $element.text().trim() == '' && $element.find('img').length == 0;
        }

        function handleGlobalDragAndDrop(callback) {
            window.addEventListener('dragover', function(e){
                e = e || event;
                e.preventDefault();
            }, false);

            window.addEventListener('drop', function(e){
                e = e || event;
                e.preventDefault();

                var handled = (callback || $.noop)(event);
                if (handled) {
                    e.stopPropagation();
                }
            }, false);
        }

    }

})();
