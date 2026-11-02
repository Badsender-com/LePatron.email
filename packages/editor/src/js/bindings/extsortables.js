'use strict';

var ko = require('knockout');
var sortable = require('jquery-ui/ui/widgets/sortable');
var draggable = require('jquery-ui/ui/widgets/draggable');
var console = require('console');
var extendDragOptions = require('./extended-drag-options.js').extendDragOptions;
require('knockout-sortable');

if (typeof sortable == 'undefined')
  throw 'Cannot find jquery-ui sortable widget dependency!';
if (typeof draggable == 'undefined')
  throw 'Cannot find jquery-ui sortable widget dependency!';

var makeExtendedValueAccessor = function (valueAccessor) {
  return function () {
    var modelValue = valueAccessor();
    ko.utils.unwrapObservable(modelValue);
    return extendDragOptions(modelValue);
  };
};

ko.bindingHandlers.extsortable = {
  init: function (element, valueAccessor, allBindingsAccessor, data, context) {
    return ko.bindingHandlers.sortable.init(
      element,
      makeExtendedValueAccessor(valueAccessor),
      allBindingsAccessor,
      data,
      context
    );
  },
  update: function (
    element,
    valueAccessor,
    allBindingsAccessor,
    data,
    context
  ) {
    return ko.bindingHandlers.sortable.update(
      element,
      makeExtendedValueAccessor(valueAccessor),
      allBindingsAccessor,
      data,
      context
    );
  },
};

ko.bindingHandlers.extdraggable = {
  init: function (element, valueAccessor, allBindingsAccessor, data, context) {
    return ko.bindingHandlers.draggable.init(
      element,
      makeExtendedValueAccessor(valueAccessor),
      allBindingsAccessor,
      data,
      context
    );
  },
  update: function (
    element,
    valueAccessor,
    allBindingsAccessor,
    data,
    context
  ) {
    return ko.bindingHandlers.draggable.update(
      element,
      makeExtendedValueAccessor(valueAccessor),
      allBindingsAccessor,
      data,
      context
    );
  },
};
