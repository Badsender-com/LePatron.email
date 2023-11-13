'use strict';
/* global global: false */

var $ = require('jquery');
var ko = require('knockout');
const _omit = require('lodash.omit');
var console = require('console');
var performanceAwareCaller = require('./timed-call.js').timedCall;

const MAX_SIZE = 102000;

var toastr = require('toastr');
toastr.options = {
  closeButton: false,
  debug: false,
  positionClass: 'toast-bottom-full-width',
  target: '#mo-body',
  onclick: null,
  showDuration: '300',
  hideDuration: '1000',
  timeOut: '5000',
  extendedTimeOut: '1000',
  showEasing: 'swing',
  hideEasing: 'linear',
  showMethod: 'fadeIn',
  hideMethod: 'fadeOut',
};
/* Sets custom styling for all blocks (mainBlocks, blockDefs) in the ViewModel.*/
function unlinkAllBlocks(viewModel) {
  const mainBlocks = viewModel.content().mainBlocks().blocks();
  const blockDefinitions = viewModel.blockDefs;

  // Loop through each block in mainBlocks and set customStyle to true
  mainBlocks.forEach((blockObservable) => {
    const block = blockObservable();
    block.customStyle(true);
  });

  // Loop through each block definition and set customStyle to true
  blockDefinitions.forEach((block) => {
    block.customStyle = true;
  });
}

function initializeEditor(content, blockDefs, thumbPathConverter, galleryUrl) {
  var viewModel = {
    galleryRecent: ko.observableArray([]),
    galleryRemote: ko.observableArray([]),
    selectedBlock: ko.observable(null),
    mainPersonalizedBlocks: ko.observable([]),
    isCurrentCustomBlock: ko.observable(null),
    selectedItem: ko.observable(null),
    selectedTool: ko.observable(0),
    selectedImageTab: ko.observable(0),
    dragging: ko.observable(false),
    draggingImage: ko.observable(false),
    galleryLoaded: ko.observable(false),
    previewMode: ko.observable('both'),
    showToolbox: ko.observable(true),
    showTheme: ko.observable(false),
    showGallery: ko.observable(false),
    debug: ko.observable(false),
    contentListeners: ko.observable(0),
    loadedTemplate: ko.observable(false),
    openTestModal: ko.observable(false),
    logoPath: 'rs/img/mosaico32.png',
    logoUrl: '.',
    logoAlt: 'mosaico',
    toggleSaveBlockModal: ko.observable(null),
    toggleDeleteBlockModal: ko.observable(null),
    // Adding observables to manage "Default Blocks" and "Personalized Blocks" tabs
    blocksActiveTab: ko.observable('TEMPLATE_BLOCKS'), // The name of the active tab ("TEMPLATE_BLOCKS" or "CUSTOM_BLOCKS")
    personalizedBlocks: ko.observable([]),
  };

  /**
   * In Knockout.js, observables are special JavaScript objects that can notify subscribers about changes,
   * and can automatically detect dependencies. They are primarily used for two-way data binding,
   * allowing the UI to automatically update when the underlying data changes, and vice versa.
   * For more information you can visit the doc : https://knockoutjs.com/documentation/observables.html
   *
   * However, sometimes it's necessary to obtain the raw values from observables, especially when
   * working with complex data structures that may contain nested observables. The function
   * `recursivelyUnwrapObservable` is designed to traverse an object and extract the raw values
   * from any observables it encounters, producing a 'plain' object without any observables.
   */
  function recursivelyUnwrapObservable(obj) {
    // If 'obj' is an observable, we need to unwrap it to get its actual value.
    // Since this value might also be an observable, we use a recursive call.
    if (ko.isObservable(obj)) {
      return recursivelyUnwrapObservable(obj());
    }

    // If 'obj' is an object (but not null), we want to explore its properties.
    else if (typeof obj === 'object' && obj !== null) {
      const newObj = {};

      // For each property of 'obj', we check if it contains observables and attempt to unwrap them.
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          newObj[key] = recursivelyUnwrapObservable(obj[key]);
        }
      }

      return newObj;
    }

    // If 'obj' is neither an observable nor an object, it's already a primitive or non-observable value.
    return obj;
  }

  // viewModel.content = content._instrument(ko, content, undefined, true);
  viewModel.content = content;
  viewModel.blockDefs = blockDefs;

  viewModel.notifier = toastr;

  // Does token substitution in i18next style
  viewModel.tt = function (key, paramObj) {
    if (typeof paramObj !== 'undefined')
      for (var prop in paramObj)
        if (paramObj.hasOwnProperty(prop)) {
          key = key.replace(
            new RegExp('__' + prop + '__', 'g'),
            paramObj[prop]
          );
        }
    return key;
  };

  // Simply maps to tt: language plugins can override this method to define their own language
  // handling.
  // If this method invokes an observable (e.g: viewModel.lang()) then the UI language will automatically
  // update when the "lang" observable changes.
  viewModel.t = viewModel.tt;

  // currently called by editor.html to translate template-defined keys (label, help, descriptions)
  // the editor always uses the "template" category for that strings.
  // you can override this method as you like in order to provide translation or change the strings in any way.
  viewModel.ut = function (category, key) {
    return key;
  };

  viewModel.templatePath = thumbPathConverter;

  viewModel.remoteUrlProcessor = function (url) {
    return url;
  };

  viewModel.remoteFileProcessor = function (fileObj) {
    if (typeof fileObj.url !== 'undefined')
      fileObj.url = viewModel.remoteUrlProcessor(fileObj.url);
    if (typeof fileObj.thumbnailUrl !== 'undefined')
      fileObj.thumbnailUrl = viewModel.remoteUrlProcessor(fileObj.thumbnailUrl);
    // deleteUrl?
    return fileObj;
  };

  // toolbox.tmpl.html
  viewModel.loadGallery = function () {
    viewModel.galleryLoaded('loading');
    var url = galleryUrl ? galleryUrl : '/upload/';
    // retrieve the full list of remote files
    $.getJSON(url, function (data) {
      for (var i = 0; i < data.files.length; i++)
        data.files[i] = viewModel.remoteFileProcessor(data.files[i]);
      viewModel.galleryLoaded(data.files.length);
      // TODO do I want this call to return relative paths? Or just absolute paths?
      viewModel.galleryRemote(data.files.reverse());
    }).fail(function () {
      viewModel.galleryLoaded(false);
      viewModel.notifier.error(viewModel.t('Unexpected error listing files'));
    });
  };

  // img-wysiwyg.tmpl.html
  viewModel.fileToImage = function (obj, event, ui) {
    // console.log("fileToImage", obj);
    return obj.url;
  };

  // block-wysiwyg.tmpl.html
  viewModel.removeBlock = function (data, parent) {
    // let's unselect the block
    if (
      ko.utils.unwrapObservable(viewModel.selectedBlock) ==
      ko.utils.unwrapObservable(data)
    ) {
      viewModel.selectBlock(null, true);
    }
    var res = parent.blocks.remove(data);
    // TODO This message should be different depending on undo plugin presence.
    viewModel.notifier.info(
      viewModel.t('Block removed: use undo button to restore it...')
    );
    return res;
  };

  // block-wysiwyg.tmpl.html
  viewModel.duplicateBlock = function (index, parent) {
    var idx = ko.utils.unwrapObservable(index);
    // Deinstrument/deobserve the object
    var unwrapped = ko.toJS(ko.utils.unwrapObservable(parent.blocks)[idx]);
    // We need to remove the id so that a new one will be assigned to the clone
    if (typeof unwrapped.id !== 'undefined') unwrapped.id = '';
    // insert the cloned block
    parent.blocks.splice(idx + 1, 0, unwrapped);
  };

  // block-wysiwyg.tmpl.html
  viewModel.deleteBlock = function (data, parent) {
    const actualData = recursivelyUnwrapObservable(data);
    viewModel.toggleDeleteBlockModal(true, actualData);
  };

  // block-wysiwyg.tmpl.html
  viewModel.editBlock = function (data, parent) {
    const actualData = recursivelyUnwrapObservable(data);
    viewModel.toggleSaveBlockModal(true, actualData, 'EDIT');
  };

  /**
   * Checks if the provided value is an object (excluding arrays).
   *
   * @param {any} value - The value to be checked.
   * @returns {boolean} - Returns true if the value is an object and not an array.
   */
  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Merges block styles with template styles. If an attribute in block styles
   * is undefined or null, it takes the value from the template styles. If an attribute
   * doesn't exist in the template styles, the original value from block styles is retained.
   *
   * @param {object} blockStyles - The styles from the block.
   * @param {object} templateStyles - The styles from the template.
   * @returns {object} - Returns the merged styles.
   */
  function mergeBlockStylesWithTemplate(blockStyles, templateStyles) {
    return Object.keys(blockStyles).reduce((mergedStyles, key) => {
      const blockValue = blockStyles[key];
      // Use the template style only if it exists, otherwise set to undefined.
      const templateValue = templateStyles ? templateStyles[key] : undefined;

      // If both blockValue and templateValue are objects, merge them recursively.
      if (isObject(blockValue) && isObject(templateValue)) {
        mergedStyles[key] = mergeBlockStylesWithTemplate(blockValue, templateValue);
      } else {
        // If blockValue is undefined or null, use the templateValue, else keep the blockValue.
        mergedStyles[key] = blockValue === undefined || blockValue === null ? templateValue : blockValue;
      }

      return mergedStyles;
    }, {});
  }

  /**
   * Merges block data styles with template styles deeply. For each attribute in block data,
   * if it's an object, it looks through the template data to find a matching template style and merges them.
   * If the attribute is not an object or doesn't have a corresponding template style, it retains its original value.
   *
   * @param {object} blockData - The main block data containing styles.
   * @param {object} templateData - The main template data containing styles.
   * @returns {object} - Returns the deeply merged block styles.
   */
  function deepMergeStylesWithTemplates(blockData, templateData) {
    return Object.keys(blockData).reduce((result, key) => {
      // If the block data attribute is an object, look for a matching template style.
      if (isObject(blockData[key])) {
        let mergedSubObject = blockData[key];
        for (let templateKey in templateData) {
          if (isObject(templateData[templateKey]) && templateData[templateKey][key]) {
            mergedSubObject = mergeBlockStylesWithTemplate(blockData[key], templateData[templateKey][key]);
            break;
          }
        }
        result[key] = mergedSubObject;
      } else {
        // If the block data attribute is not an object, retain its original value.
        result[key] = blockData[key];
      }

      return result;
    }, {});
  }

  function getTemplateData() {
    // gather meta
    // remove keys that aren't necessary to update
    const datas = _omit(ko.toJS(viewModel.metadata), [
      'urlConverter',
      'template',
    ]);
    datas.data = viewModel.exportJS();
    return datas;
  }

  // block-wysiwyg.tmpl.html
  viewModel.saveBlock = function (blockData) {
    const allTemplateData = getTemplateData();
    const templateContentTheme =
      recursivelyUnwrapObservable(allTemplateData)?.data?.theme ?? {};

    const unwrappedBlockData = recursivelyUnwrapObservable(blockData);

    const finalizedBlockData = deepMergeStylesWithTemplates(unwrappedBlockData, templateContentTheme);

    viewModel.toggleSaveBlockModal(true, finalizedBlockData, 'CREATE');
  };

  // block-wysiwyg.tmpl.html
  viewModel.moveBlock = function (index, parent, up) {
    var idx = ko.utils.unwrapObservable(index);
    var parentBlocks = ko.utils.unwrapObservable(parent.blocks);
    if ((up && idx > 0) || (!up && idx < parentBlocks.length - 1)) {
      var destIndex = idx + (up ? -1 : 1);
      var destBlock = parentBlocks[destIndex];
      viewModel.startMultiple();
      parent.blocks.splice(destIndex, 1);
      parent.blocks.splice(idx, 0, destBlock);
      viewModel.stopMultiple();
    }
  };

  // test method, command line use only
  viewModel.loadDefaultBlocks = function () {
    // cloning the whole "mainBlocks" object so that undomanager will
    // see it as a single operation (maybe I could use "startMultiple"/"stopMultiple".
    var res = ko.toJS(viewModel.content().mainBlocks);
    res.blocks = [];
    var input = ko.utils.unwrapObservable(viewModel.blockDefs);
    for (var i = 0; i < input.length; i++) {
      var obj = ko.toJS(input[i]);
      // generating ids for blocks, maybe this would work also leaving it empty.
      obj.id = 'block_' + i;
      res.blocks.push(obj);
    }
    performanceAwareCaller(
      'setMainBlocks',
      viewModel
        .content()
        .mainBlocks._wrap.bind(viewModel.content().mainBlocks, res)
    );
  };

  // gallery-images.tmpl.html
  viewModel.addImage = function (img) {
    var selectedImg = $('#main-wysiwyg-area .selectable-img.selecteditem');
    if (
      selectedImg.length == 1 &&
      typeof img == 'object' &&
      typeof img.url !== 'undefined'
    ) {
      ko.contextFor(selectedImg[0])._src(img.url);
      return true;
    } else {
      return false;
    }
  };

  // toolbox.tmpl.html
  viewModel.addBlock = function (obj, event) {
    // Personalized blocks need to have block informations to know the name, the category, etc...
    // but once we add the block to the mail, we keep this informations in the block
    // so the builder considers there is an update of the template because the block structure
    // is not the same as the default block in the template.
    // To fix this issue, we need to remove blockInformation when we are adding a block
    // in a mail.
    // if there is a selected block we try to add the block just after the selected one.
    var selected = viewModel.selectedBlock();
    // search the selected block position.
    var found;
    if (selected !== null) {
      // TODO "mainBlocks" is an hardcoded thing.
      for (
        var i = viewModel.content().mainBlocks().blocks().length - 1;
        i >= 0;
        i--
      ) {
        if (viewModel.content().mainBlocks().blocks()[i]() == selected) {
          found = i;
          break;
        }
      }
    }
    var pos;
    if (typeof found !== 'undefined') {
      pos = found + 1;
      viewModel.content().mainBlocks().blocks.splice(pos, 0, obj);
      viewModel.notifier.info(
        viewModel.t('New block added after the selected one (__pos__)', {
          pos: pos,
        })
      );
    } else {
      viewModel.content().mainBlocks().blocks.push(obj);
      pos = viewModel.content().mainBlocks().blocks().length - 1;
      viewModel.notifier.info(
        viewModel.t('New block added at the model bottom (__pos__)', {
          pos: pos,
        })
      );
    }
    // find the newly added block and select it!
    var added = viewModel.content().mainBlocks().blocks()[pos]();
    viewModel.selectBlock(added, true);

    if (added.blockInformation()) {
      const blockToAdd = recursivelyUnwrapObservable(added);
      viewModel.mainPersonalizedBlocks([...viewModel.mainPersonalizedBlocks(), blockToAdd]);
    }

    // prevent click propagation (losing url hash - see #43)
    return false;
  };

  // Used by stylesheet.js to create multiple styles
  viewModel.findObjectsOfType = function (data, type) {
    var res = [];
    var obj = ko.utils.unwrapObservable(data);
    for (var prop in obj)
      if (obj.hasOwnProperty(prop)) {
        var val = ko.utils.unwrapObservable(obj[prop]);
        // TODO this is not the right way to deal with "block list" objects.
        if (prop.match(/Blocks$/)) {
          var contents = ko.utils.unwrapObservable(val.blocks);
          for (var i = 0; i < contents.length; i++) {
            var c = ko.utils.unwrapObservable(contents[i]);
            if (type === null || ko.utils.unwrapObservable(c.type) == type)
              res.push(c);
          }
          // TODO investigate which condition provide a null value.
        } else if (typeof val == 'object' && val !== null) {
          if (type === null || ko.utils.unwrapObservable(val.type) == type)
            res.push(val);
        }
      }
    return res;
  };

  /*
  viewModel.placeholderHelper = 'sortable-placeholder';
  if (false) {
    viewModel.placeholderHelper = {
      element: function(currentItem) {
        return $('<div />').removeClass('ui-draggable').addClass('sortable-placeholder').css('position', 'relative').css('width', '100%').css('height', currentItem.css('height')).css('opacity', '.8')[0];
      },
      update: function(container, p) {
       return;
      }
    };
  }
  */

  // Attempt to insert the block in the destination layout during dragging
  viewModel.placeholderHelper = {
    element: function (currentItem) {
      return $(currentItem[0].outerHTML)
        .removeClass('ui-draggable')
        .addClass('sortable-placeholder')
        .css('display', 'block')
        .css('position', 'relative')
        .css('width', '100%')
        .css('height', 'auto')
        .css('opacity', '.8')[0];
    },
    update: function (container, p) {
      return;
    },
  };

  // TODO the undumanager should be pluggable.
  // Used by "moveBlock" and blocks-wysiwyg.tmpl.html to "merge" drag/drop operations into a single undo/redo op.
  viewModel.startMultiple = function () {
    if (typeof viewModel.setUndoModeMerge !== 'undefined')
      viewModel.setUndoModeMerge();
  };
  viewModel.stopMultiple = function () {
    if (typeof viewModel.setUndoModeOnce !== 'undefined')
      viewModel.setUndoModeOnce();
  };

  // Used by code generated by editor.js
  viewModel.localGlobalSwitch = function (prop, globalProp) {
    var current = prop();
    if (current === null) prop(globalProp());
    else prop(null);
    return false;
  };

  // Used by editor and main "converter" to support item selection
  viewModel.selectItem = function (valueAccessor, item, block) {
    var val = ko.utils.peekObservable(valueAccessor);
    if (typeof block !== 'undefined') viewModel.selectBlock(block, false, true);
    if (val != item) {
      valueAccessor(item);
      // On selectItem if we were on "Blocks" toolbox tab we move to "Content" toolbox tab.
      if (item !== null && viewModel.selectedTool() === 0)
        viewModel.selectedTool(1);
    }
    return false;
  }.bind(viewModel, viewModel.selectedItem);

  viewModel.isSelectedItem = function (item) {
    return viewModel.selectedItem() == item;
  };

  viewModel.selectBlock = function (
    valueAccessor,
    item,
    doNotSelect,
    doNotUnselectItem
  ) {
    var val = ko.utils.peekObservable(valueAccessor);
    if (!doNotUnselectItem) viewModel.selectItem(null);
    if (val != item) {
      valueAccessor(item);
      // hide gallery on block selection
      viewModel.showGallery(false);
      if (item !== null && !doNotSelect && viewModel.selectedTool() === 0)
        viewModel.selectedTool(1);
    }
  }.bind(viewModel, viewModel.selectedBlock);

  viewModel.isCurrentCustomBlock = function() {
    return viewModel.mainPersonalizedBlocks()?.find(block => block.id == viewModel.selectedBlock()?.id()) != undefined;
  };

  // DEBUG
  viewModel.countSubscriptions = function (model, debug) {
    var res = 0;
    for (var prop in model)
      if (model.hasOwnProperty(prop)) {
        var p = model[prop];
        if (ko.isObservable(p)) {
          if (typeof p._defaultComputed != 'undefined') {
            if (typeof debug != 'undefined')
              console.log(
                debug + '/' + prop + '/_',
                p._defaultComputed.getSubscriptionsCount()
              );
            res += p._defaultComputed.getSubscriptionsCount();
          }
          if (typeof debug != 'undefined')
            console.log(debug + '/' + prop + '/-', p.getSubscriptionsCount());
          res += p.getSubscriptionsCount();
          p = ko.utils.unwrapObservable(p);
        }
        if (typeof p == 'object' && p !== null) {
          var tot = viewModel.countSubscriptions(
            p,
            typeof debug != 'undefined' ? debug + '/' + prop + '@' : undefined
          );
          if (typeof debug != 'undefined')
            console.log(debug + '/' + prop + '@', tot);
          res += tot;
        }
      }
    return res;
  };

  // DEBUG
  viewModel.loopSubscriptionsCount = function () {
    var count = viewModel.countSubscriptions(viewModel.content());
    global.document.getElementById('subscriptionsCount').innerHTML = count;
    global.setTimeout(viewModel.loopSubscriptionsCount, 1000);
  };

  viewModel.export = function () {
    var content = performanceAwareCaller('exportHTML', viewModel.exportHTML);
    return content;
  };

  function conditional_restore(html) {
    return html.replace(
      /<replacedcc[^>]* condition="([^"]*)"[^>]*>([\s\S]*?)<\/replacedcc>/g,
      function (match, condition, body) {
        var dd = '<!--[if ' + condition.replace(/&amp;/, '&') + ']>';
        dd += body
          .replace(
            /<!-- cc:bc:([A-Za-z:]*) -->(<\/cc>)?<!-- cc:ac:\1 -->/g,
            '</$1>'
          ) // restore closing tags (including lost tags)
          .replace(/><\/cc><!-- cc:sc -->/g, '/>') // restore selfclosing tags
          .replace(/<!-- cc:bo:([A-Za-z:]*) --><cc/g, '<$1') // restore open tags
          .replace(/^.*<!-- cc:start -->/, '') // remove content before start
          .replace(/<!-- cc:end -->.*$/, ''); // remove content after end
        dd += '<![endif]-->';
        return dd;
      }
    );
  }

  viewModel.exportHTML = function () {
    console.log('viewModel.exportHTML');

    var id = 'exportframe';
    $('body').append(
      '<iframe id="' + id + '" data-bind="bindIframe: $data"></iframe>'
    );
    var frameEl = global.document.getElementById(id);
    ko.applyBindings(viewModel, frameEl);

    ko.cleanNode(frameEl);

    if (viewModel.inline) viewModel.inline(frameEl.contentWindow.document);

    // Obsolete method didn't work on IE11 when using "HTML5 doctype":
    // var docType = new XMLSerializer().serializeToString(global.document.doctype);
    var node = frameEl.contentWindow.document.doctype;
    var docType =
      '<!DOCTYPE ' +
      node.name +
      (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '') +
      (!node.publicId && node.systemId ? ' SYSTEM' : '') +
      (node.systemId ? ' "' + node.systemId + '"' : '') +
      '>';
    var content =
      docType + '\n' + frameEl.contentWindow.document.documentElement.outerHTML;
    ko.removeNode(frameEl);

    content = content.replace(
      /<script ([^>]* )?type="text\/html"[^>]*>[\s\S]*?<\/script>/gm,
      ''
    );
    // content = content.replace(/<!-- ko .*? -->/g, ''); // sometimes we have expressions like (<!-- ko var > 2 -->)
    content = content.replace(/<!-- ko ((?!--).)*? -->/g, ''); // this replaces the above with a more formal (but slower) solution
    content = content.replace(/<!-- \/ko -->/g, '');
    // Remove data-bind/data-block attributes
    content = content.replace(/ data-bind="[^"]*"/gm, '');
    // Remove trash leftover by TinyMCE
    content = content.replace(/ data-mce-(href|src|style)="[^"]*"/gm, '');

    // Replace "replacedstyle" to "style" attributes (chrome puts replacedstyle after style)
    content = content.replace(
      / style="[^"]*"([^>]*) replaced(style="[^"]*")/gm,
      '$1 $2'
    );
    // Replace "replacedstyle" to "style" attributes (ie/ff have reverse order)
    content = content.replace(
      / replaced(style="[^"]*")([^>]*) style="[^"]*"/gm,
      ' $1$2'
    );
    content = content.replace(/ replaced(style="[^"]*")/gm, ' $1');
    // same as style, but for http-equiv (some browser break it if we don't replace, but then we find it duplicated)
    content = content.replace(
      / http-equiv="[^"]*"([^>]*) replaced(http-equiv="[^"]*")/gm,
      '$1 $2'
    );
    content = content.replace(
      / replaced(http-equiv="[^"]*")([^>]*) http-equiv="[^"]*"/gm,
      ' $1$2'
    );
    content = content.replace(/ replaced(http-equiv="[^"]*")/gm, ' $1');

    // BADSENDER: ESP tags gestion

    // Decode content between ESP tags and restore ESP tags
    content = content.replace(/&lt;%.*%&gt;/g, function (match) {
      var elem = document.createElement('textarea');
      elem.innerHTML = match;
      var decoded = elem.value;
      elem.remove();

      return decoded;
    });

    content = content.replace(/&lt;#list.*&lt;\/#list&gt;/g, function (match) {
      var elem = document.createElement('textarea');
      elem.innerHTML = match;
      var decoded = elem.value;
      elem.remove();

      return decoded;
    });

    // We already replace style and http-equiv and we don't need this.
    // content = content.replace(/ replaced([^= ]*=)/gm, ' $1');
    // Restore conditional comments
    content = conditional_restore(content);
    var trash =
      content.match(/ data-[^ =]+(="[^"]+")? /) ||
      content.match(/ replaced([^= ]*=)/);
    if (trash) {
      console.warn(
        'Output HTML contains unexpected data- attributes or replaced attributes',
        trash
      );
    }

    // Close with slash unclosed autoclose tags
    var unclosedAutoTagsRegex = /(<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)("[^"]*"|[^\/">])*)>/gm;
    content = content.replace(unclosedAutoTagsRegex, '$1/>');

    // Remove successful blink lines
    var blackLinesRegex = /^\s*[\r\n]/gm;
    content = content.replace(blackLinesRegex, '');

    // Remove successif empty indentation and empty spaces if content exceeds 102k
    if (content.length > MAX_SIZE) {
      content = content.replace(/\n|\t/g, ' ');
      content = content.replace(/\s\s+/g, ' ');
    }

    return content;
  };

  viewModel.exportHTMLtoTextarea = function (textareaid) {
    $(textareaid).val(viewModel.exportHTML());
  };

  viewModel.exportJSONtoTextarea = function (textareaid) {
    $(textareaid).val(viewModel.exportJSON());
  };

  viewModel.importJSONfromTextarea = function (textareaid) {
    viewModel.importJSON($(textareaid).val());
  };

  viewModel.exportMetadata = function () {
    var json = ko.toJSON(viewModel.metadata);
    return json;
  };

  viewModel.exportJSON = function () {
    var json = ko.toJSON(viewModel.content);
    return json;
  };

  viewModel.exportJS = function () {
    return ko.toJS(viewModel.content);
  };

  viewModel.importJSON = function (json) {
    var unwrapped = ko.utils.parseJson(json);
    viewModel.content._wrap(unwrapped);
  };

  viewModel.exportTheme = function () {
    var flat = {};
    var mod = viewModel.content().theme();

    var _export = function (prefix, flat, mod) {
      for (var prop in mod)
        if (mod.hasOwnProperty(prop)) {
          var a = ko.utils.unwrapObservable(mod[prop]);
          if (a !== null && typeof a == 'object') {
            _export(prop + '.', flat, a);
          } else {
            flat[prefix + prop] = a;
          }
        }
    };

    _export('', flat, mod);

    var output = '';
    for (var prop in flat)
      if (flat.hasOwnProperty(prop) && prop != 'type') {
        output += prop + ': ' + flat[prop] + ';' + '\n';
      }

    return output;
  };

  // moxiemanager (or file browser/imageeditor) extension points.
  // Just implement editImage or linkDialog methods
  // viewModel.editImage = function(src, done) {} : implement this method to enable image editing (src is a wirtableObservable).
  // viewModel.linkDialog = function() {}: implement this method using "this" to find the input element $(this).val is a writableObservable.

  viewModel.loadImage = function (img) {
    // push image at top of "recent" gallery
    viewModel.galleryRecent.unshift(img);
    // select recent gallery tab
    viewModel.selectedImageTab(0);
  };

  // you can ovverride this method if you want to browse images using an external tool
  // if you call _src(yourSrc) you will set a new source for the image.
  viewModel.selectImage = function (_src) {
    viewModel.showGallery(true);
  };

  viewModel.dialog = function (selector, options) {
    $(selector).dialog(options);
  };

  // Dummy log method overridden by extensions
  viewModel.log = function (category, msg) {
    // console.log("viewModel.log", category, msg);
  };

  // Can't keep that piece of code: interfere with my own listener
  if (process.env.MOSAICO) {
    // automatically load the gallery when the gallery tab is selected
    viewModel.selectedImageTab.subscribe(
      function (newValue) {
        if (newValue == 1 && viewModel.galleryLoaded() === false) {
          viewModel.loadGallery();
        }
      },
      viewModel,
      'change'
    );
  }

  unlinkAllBlocks(viewModel);

  return viewModel;
}

module.exports = initializeEditor;
