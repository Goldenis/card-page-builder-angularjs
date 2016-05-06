(function ($) {
    'use strict';

    $.fn.htmlOuter = function () {
        var html = $(this).clone().wrapAll('<div>').parent().html();
        return (html || '').trim();
    };
}(jQuery));
