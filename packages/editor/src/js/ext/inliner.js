'use strict';
/* global global: false */
var console = require('console');
var $ = require('jquery');
var inlineDocument = require('juice/lib/inline')({}).inlineDocument;
var {
  detachSyntheticMarkup,
  restoreSyntheticMarkup,
} = require('./synthetic-blocks/protect-from-inliner.js');

var inlinerPlugin = function (vm) {
  vm.inline = function (doc) {
    // Take the markup of every synthetic block out of the document first:
    // the template's `data-inline="true"` rules are generic (`img { ... }`) and
    // would otherwise be inlined onto markup the template does not own.
    // This has to happen before the style -> replacedstyle copy below, or those
    // nodes would get a replacedstyle duplicate that the export regexes in
    // viewmodel.js would restore over their original style attribute.
    var protectedMarkup = detachSyntheticMarkup($, doc);

    // tinymce may have added style attributes to elements that will also have global styles to be inlined
    $('[style]:not([replacedstyle])', doc).each(function (index, el) {
      var $el = $(el);
      $el.attr('replacedstyle', $el.attr('style'));
    });

    var style = [];
    $('style[data-inline="true"]', doc).each(function (index, element) {
      var content = $(element).html();
      content = content.replace(/<!-- ko ((?!--).)*? -->/g, ''); // this replaces the above with a more formal (but slower) solution
      content = content.replace(/<!-- \/ko -->/g, '');
      style.push(content);
      $(element).removeAttr('data-inline');
    });
    var styleText = style.join('\n');
    var $context = function (selector, context) {
      if (typeof context == 'undefined') context = doc;
      return $(selector, context);
    };
    $context.root = function () {
      return $(':root', doc);
    };
    inlineDocument($context, styleText, {
      styleAttributeName: 'replacedstyle',
    });

    restoreSyntheticMarkup(protectedMarkup);
  };
};

module.exports = inlinerPlugin;
