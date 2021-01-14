'use strict';
var ko = require('knockout');
var console = require('console');
// This module deals with serialization/deserialization of a "tree-path" representing the path to reach the given leaf.
// In order to be correctly serialized we have to move from "reference" to "string" and viceversa.

var _reference = function (model, path) {
  var p = 0;
  var p1, p2;
  var m = model;
  while (p < path.length) {
    switch (path.charAt(p)) {
      case '(':
        if (path.charAt(p + 1) == ')') {
          m = m();
        } else {
          // TODO error
        }
        p += 2;
        break;
      case '[':
        p2 = path.indexOf(']', p);
        m = m[path.substring(p + 1, p2)];
        p = p2 + 1;
        break;
      case '.':
        p1 = path.indexOf('(', p);
        if (p1 == -1) p1 = path.length;
        p2 = path.indexOf('[', p);
        if (p2 == -1) p2 = path.length;
        p2 = Math.min(p1, p2);
        m = m[path.substring(p + 1, p2)];
        p = p2;
        break;
      default:
      // TODO error
    }
  }
  return m;
};

var _getPath = function (parents, child) {
  var path = '';
  var p;
  for (var k = 0; k <= parents.length; k++) {
    p = k < parents.length ? parents[k] : child;
    if (ko.isObservable(p)) path += '()';
    if (typeof p._fieldName !== 'undefined') {
      path += '.' + p._fieldName;
    } else if (k > 0 && typeof parents[k - 1].pop == 'function') {
      var parentArray = ko.isObservable(parents[k - 1])
        ? ko.utils.peekObservable(parents[k - 1])
        : parents[k - 1];
      var pos = ko.utils.arrayIndexOf(parentArray, p);
      if (pos != -1) {
        path += '[' + pos + ']';
      } else {
        // NOTE this happen, sometimes when TinyMCE sends updates for objects already removed.
        console.error(
          'Unexpected object not found in parent array',
          parentArray,
          p,
          k,
          parents.length,
          ko.toJS(parentArray),
          ko.utils.unwrapObservable(p)
        );
        throw 'Unexpected object not found in parent array';
      }
    } else {
      console.error(
        'Unexpected parent with no _fieldName and no parent array',
        k,
        parents
      );
      throw 'Unexpected parent with no _fieldName and no parent array';
    }
  }
  return path;
};

var makeDereferencedUndoAction = function (undoFunc, model, path, value, item) {
  var child = _reference(model, path);
  undoFunc(child, value, item);
};

var listener;

var _setListener = function (listenfunc) {
  listener = listenfunc;
};

/* dereferencing path and changing value with "toJS" */
var makeUndoActionDereferenced = function (
  model,
  undoFunc,
  parents,
  child,
  oldVal,
  item
) {
  try {
    var path = _getPath(parents, child);

    // Transform actions in simple JS objects.
    if (typeof oldVal === 'object' || typeof oldVal === 'function')
      oldVal = ko.toJS(oldVal);
    if (
      typeof item !== 'undefined' &&
      (typeof item.value === 'object' || typeof item.value === 'function')
    ) {
      var newItem = ko.toJS(item);
      item = newItem;
    }

    if (typeof listener !== 'undefined') {
      try {
        listener(path, child, oldVal, item);
      } catch (e) {
        console.log('Undoserializer ignoring exception in listener callback');
      }
    }

    return makeDereferencedUndoAction.bind(
      undefined,
      undoFunc,
      model,
      path,
      oldVal,
      item
    );
  } catch (e) {
    // NOTE this happens, from time to time, when TinyMCE sends updates for deleted content.
    console.error('Exception processing undo', e, parents, child, item);
  }
};

var watchEnabled;
var _watchEnabled = function (newVal) {
  if (typeof newVal !== 'undefined') watchEnabled = newVal;
  else return watchEnabled;
};

module.exports = {
  dereference: _getPath,
  reference: _reference,
  makeUndoAction: makeUndoActionDereferenced,
  setListener: _setListener,
  watchEnabled: _watchEnabled,
};
