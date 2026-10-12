'use strict';

var ko = require('knockout');
var undoManager = require('./undomanager.js');
var undoserializer = require('./undoserializer.js');

// The reactor behind the undo stack watches `viewModel.content` only, and head
// CSS lives outside it, on the mailing (viewModel.headCss). Its changes are
// pushed onto the same stack by hand: undoing one restores the previous
// stylesheet, and that write pushes the inverse onto the redo stack, exactly as
// a content change does. The modal writes once per "Apply", so each Apply is
// one step.
var trackOutsideContent = function (observable, undoRedoStack, isTracking) {
  var previous = observable.peek();
  return observable.subscribe(function (value) {
    var restored = previous;
    previous = value;
    if (!isTracking()) return;
    undoRedoStack.push(function () {
      observable(restored);
    });
  });
};

var addUndoStackExtensionMaker = function (performanceAwareCaller) {
  return function (viewModel) {
    viewModel.contentListeners(viewModel.contentListeners() + 2);

    // TODO the labels should be computed observables (needs changes in undomanager projects)
    var undoRedoStack = undoManager(viewModel.content, {
      levels: 100,
      undoLabel: ko.computed(function () {
        return viewModel.t('Undo');
      }),
      redoLabel: ko.computed(function () {
        return viewModel.t('Redo');
      }),
    });
    viewModel.undo = undoRedoStack.undoCommand;
    viewModel.undo.execute = performanceAwareCaller.bind(
      viewModel,
      'undo',
      viewModel.undo.execute
    );
    viewModel.undoCount = undoRedoStack.undoCount;
    viewModel.redoCount = undoRedoStack.redoCount;
    viewModel.redo = undoRedoStack.redoCommand;
    viewModel.redo.execute = performanceAwareCaller.bind(
      viewModel,
      'redo',
      viewModel.redo.execute
    );
    viewModel.undoReset = performanceAwareCaller.bind(
      viewModel,
      'undoReset',
      undoRedoStack.reset
    );
    viewModel.setUndoModeMerge = undoRedoStack.setModeMerge;
    viewModel.setUndoModeOnce = undoRedoStack.setModeOnce;
    undoRedoStack.setModeIgnore();
    undoRedoStack.setUndoActionMaker(
      undoserializer.makeUndoAction.bind(undefined, viewModel.content)
    );
    undoserializer.watchEnabled(true);

    // Mirrors the stack's ignore mode, which it does not expose: the value
    // seeded at load must not be undoable.
    var tracking = false;
    var headCssSubscription = ko.isObservable(viewModel.headCss)
      ? trackOutsideContent(viewModel.headCss, undoRedoStack, function () {
          return tracking;
        })
      : null;

    return {
      pause: function () {
        tracking = false;
        undoRedoStack.setModeIgnore();
      },
      run: function () {
        tracking = true;
        undoRedoStack.setModeOnce();
      },
      init: function () {
        tracking = true;
        undoRedoStack.setModeOnce();
      },
      dispose: function () {
        viewModel.contentListeners(viewModel.contentListeners() - 2);
        undoserializer.watchEnabled(false);
        if (headCssSubscription) headCssSubscription.dispose();
        undoRedoStack.dispose();
      },
    };
  };
};

module.exports = addUndoStackExtensionMaker;
