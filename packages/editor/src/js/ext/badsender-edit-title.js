'use strict';

var $ = require('jquery');
var ko = require('knockout');
var console = require('console');
var userCan = require('./user-can.js').userCan;
var CAPABILITIES = require('../../../../shared/access/roles.js').CAPABILITIES;

function handleCreationName(viewModel) {
  var originalValue;
  viewModel.titleMode = ko.observable('show');
  viewModel.metadata.name = ko.observable(viewModel.metadata.name);

  viewModel.creationName = ko.computed(function () {
    return viewModel.metadata.name();
  }, viewModel);

  // Renaming is organising the email, like the listing's rename. Locked
  // until the current user is known, like the toolbox panels.
  viewModel.canRenameCreation = function () {
    return userCan(viewModel, CAPABILITIES.MAILING_ORGANIZE);
  };

  viewModel.enableEditCreationName = function (data, event) {
    if (!viewModel.canRenameCreation()) return;
    console.log('enableEditCreationName', data);
    originalValue = viewModel.metadata.name();
    viewModel.titleMode('edit');
  };

  // Back to the name's button, re-created when the form goes.
  function focusName() {
    setTimeout(function () {
      var button = document.querySelector('.creation-name__button');
      if (button) button.focus();
    }, 0);
  }

  viewModel.cancelEditCreationName = function (data, event) {
    console.log('cancelEditCreationName');
    viewModel.metadata.name(originalValue);
    originalValue = '';
    viewModel.titleMode('show');
    focusName();
  };

  viewModel.saveEditCreationName = function (data, event) {
    console.log('saveEditCreationName', viewModel.metadata.name());
    viewModel.titleMode('saving');
    viewModel.notifier.info(viewModel.t('edit-title-ajax-pending'));

    $.ajax({
      method: 'PUT',
      url: viewModel.metadata.url.update,
      data: {
        name: viewModel.metadata.name()
      },
      success: function (mosaicoCreation) {
        viewModel.metadata.name(mosaicoCreation.metadata.name);
        viewModel.notifier.success(viewModel.t('edit-title-ajax-success'));
      },
      error: function () {
        viewModel.notifier.error(viewModel.t('edit-title-ajax-fail'));
      },
      complete: function () {
        originalValue = '';
        viewModel.titleMode('show');
        focusName();
      },
    });
  };
}

module.exports = handleCreationName;
