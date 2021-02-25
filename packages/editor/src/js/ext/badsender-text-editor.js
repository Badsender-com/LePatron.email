'use strict';

var debounce = require('lodash.debounce');

require('./link-with-color');

//////
// DEFINE TINYMCE CUSTOM PLUGINS
//////

//----- LETTER SPACING

// convert a fibonacci suite to em
var defaults = [0, 1, 2, 3, 5, 8, 13]
  .map(function (e) {
    return Math.round(e * 0.1 * 100) / 100;
  })
  .map(function (i) {
    return i + '=' + i + 'em';
  })
  .join(' ');

tinymce.PluginManager.add('spacing', addLetterSpacing);

function addLetterSpacing(editor, url) {
  editor.addButton('letterspacingselect', function () {
    var formats = editor.settings.spacing_formats || defaults;
    var items = formats.split(' ').map(function (item) {
      var text = item;
      var value = item;
      // Allow text=value font sizes.
      var values = item.split('=');
      if (values.length > 1) {
        text = values[0];
        value = values[1];
      }
      return { text: text, value: value };
    });

    function setLetterSpacing(e) {
      if (!e.control.settings.value) return;
      tinymce.activeEditor.formatter.register('letter-spacing', {
        inline: 'span',
        styles: { 'letter-spacing': e.control.settings.value },
      });
      tinymce.activeEditor.formatter.apply('letter-spacing');
    }

    return {
      type: 'listbox',
      text: 'Letter spacing',
      tooltip: 'Letter spacing',
      values: items,
      fixedWidth: true,
      onclick: setLetterSpacing,
    };
  });
}

//----- FREE FONT SIZE

// Util function copied from Tiny MCE
function each(o, cb, s) {
  var n, l;

  if (!o) {
    return 0;
  }

  s = s || o;

  if (o.length !== undefined) {
    // Indexed arrays, needed for Safari
    for (n = 0, l = o.length; n < l; n++) {
      if (cb.call(s, o[n], n, o) === false) {
        return 0;
      }
    }
  } else {
    // Hashtables
    for (n in o) {
      if (o.hasOwnProperty(n)) {
        if (cb.call(s, o[n], n, o) === false) {
          return 0;
        }
      }
    }
  }

  return 1;
}

// inspired by tinymce.js#44265
tinymce.PluginManager.add('fontsizedialog', fontsizedialog);

function fontsizedialog(editor, url) {
  var fontSizeMin = 8;
  var fontSizeMax = 666;
  var selectionFs = false;
  var dialogHelpText = [
    tinymce.util.I18n.translate('minimum size: 8px'),
    tinymce.util.I18n.translate('no decimals'),
  ]
    .map(function (t) {
      return '• ' + t;
    })
    .join('<br>');

  editor.addButton('fontsizedialogbutton', {
    text: 'Font size',
    tooltip: 'Font size',
    // add a class to fix button width
    // Haven't found a way to update toolbar size dynamically
    // iterating over https://www.tinymce.com/docs/api/tinymce.ui/tinymce.ui.button/#parents
    // and calling .reflow() doesn't make the trick
    classes: 'fontsizedialogbutton',
    icon: false,
    onPostRender: afterBtnInit,
    onclick: openFsDialog,
  });

  function afterBtnInit(initEvent) {
    var btnInstance = initEvent.control;
    var formatName = 'fontsize';
    var self = this;

    editor.on('nodeChange', debounce(onNodeChange, 150));

    function onNodeChange(e) {
      each(e.parents, getFontSize);
      if (!selectionFs) {
        selectionFs = document.defaultView
          .getComputedStyle(e.parents[0] || e.element, null)
          .getPropertyValue('font-size');
      }
    }

    function getFontSize(node) {
      if (node.style && node.style.fontSize) {
        btnInstance.text(
          tinymce.util.I18n.translate('Font size: ') + node.style.fontSize
        );
        selectionFs = node.style.fontSize;
        return false;
      }
      selectionFs = false;
      btnInstance.text(tinymce.util.I18n.translate('Font size'));
    }
  }

  function openFsDialog(btnEvent) {
    var initValue = selectionFs ? /^(\d+)/.exec(selectionFs) : null;
    initValue = Array.isArray(initValue) ? initValue[0] : '';

    editor.windowManager.open({
      title: 'Enter a font-size',
      width: 320,
      height: 120,
      body: [
        {
          type: 'label',
          multiline: true,
          text: '',
          // multiline “hack” from:
          // http://www.devsumo.com/technotes/2014/07/tinymce-4-multi-line-labels-in-popup-dialogs/
          onPostRender: function () {
            this.getEl().innerHTML = dialogHelpText;
          },
        },
        {
          type: 'textbox',
          name: 'bsdialogfontsize',
          label: 'in pixel',
          autofocus: true,
          value: initValue,
          onPostRender: function () {
            this.$el.attr({
              type: 'number',
              min: fontSizeMin,
              step: 1,
            });
          },
        },
      ],
      onsubmit: function (e) {
        var newFontSize = ~~e.data.bsdialogfontsize;
        if (newFontSize >= fontSizeMin && newFontSize <= fontSizeMax) {
          editor.execCommand('FontSize', false, newFontSize + 'px');
        } else {
          // tinyMCE notifications are very small…
          // no need to put them for now
          // editor.notificationManager.open({
          //   text: 'Invalid font size',
          //   type: 'error',
          // })
        }
      },
    });
  }
}

tinymce.PluginManager.add('specialcharacters', specialcharacters);

function specialcharacters(editor) {
  editor.addButton('specialcharacters', function () {
    const items = [
      {
        text: 'Unbreakable space',
        onclick: function() {
          editor.insertContent('&nbsp;');
        }
      },
      {
        text: 'Unbreakable hyphen',
        onclick: function() {
          editor.insertContent('&#8209;');
        }
      },
    ];

    return {
      type: 'menubutton',
      text: 'Special character',
      icon: false,
      menu: items,
    };
  });
}

//////
// CONFIGURATION
//////

var tinymceConfigFull = {
  toolbar1:
    'bold italic forecolor backcolor | fontsizedialogbutton styleselect letterspacingselect removeformat specialcharacters | linkcolorbutton unlinkcolorbutton | pastetext code',
  //- add colorpicker & custom plugins
  //- https://www.tinymce.com/docs/plugins/colorpicker/
  plugins: [
    'linkcolor hr paste lists textcolor colorpicker code spacing fontsizedialog specialcharacters',
  ],
  link_text_decoration_list: [
    {text: 'Underline', value: ''},
    {text: 'Normal', value: 'none'}
  ],
  //- https://www.tinymce.com/docs/configure/content-formatting/#style_formats
  style_formats: [
    {
      title: 'Inline',
      items: [
        { title: 'Bold', icon: 'bold', inline: 'strong' },
        { title: 'Italic', icon: 'italic', inline: 'em' },
        {
          title: 'Underline',
          icon: 'underline',
          inline: 'span',
          styles: { 'text-decoration': 'underline' },
        },
        {
          title: 'Strikethrough',
          icon: 'strikethrough',
          inline: 'span',
          styles: { 'text-decoration': 'line-through' },
        },
        { title: 'Superscript', icon: 'superscript', inline: 'sup' },
        { title: 'Subscript', icon: 'subscript', inline: 'sub' },
        { title: 'Code', icon: 'code', inline: 'code' },
      ],
    },
  ],
};

module.exports = tinymceConfigFull;
