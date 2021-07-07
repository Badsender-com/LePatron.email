'use strict';

const $ = require('jquery');
const ko = require('knockout');
const axios = require('axios');

module.exports = (opts) => {
  var profileUrl = opts.metadata.url?.profileList;

    function init(viewModel) {
      loadProfiles(viewModel);
    }

    function viewModel(viewModel) {
      viewModel.profiles = ko.observableArray([]);
      viewModel.selectedProfile = ko.observable(null);
      viewModel.setSelectedProfile = (profile, event) => {
       viewModel.selectedProfile(profile)
      };
    }


    function loadProfiles(vm) {
      axios.get(profileUrl)
        .then((response) => {
          vm.profiles(response?.data?.result);
        }).catch((error) => {
        // handle error
        vm.notifier.error(this.vm.t('error-server'));
      });
    }

    return {
      init,
      viewModel
    }
  };
