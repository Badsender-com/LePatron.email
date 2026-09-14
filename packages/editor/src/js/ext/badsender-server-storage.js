'use strict';
import _ from 'lodash';

const console = require('console');
const $ = require('jquery');
const ko = require('knockout');
const _omit = require('lodash.omit');
const {
  EDITOR_ONLY_METADATA_KEYS,
} = require('../utils/editor-only-metadata-keys');
const { errorKeyFor } = require('../utils/email-metadata');
const emailMetadataStore = require('../utils/email-metadata-store');
const {
  getErrorsForControlQuality,
  displayErrors,
  checkRequiredTrackingParams,
  displayTrackingError,
} = require('../ext/badsender-control-quality');

function getData(viewModel) {
  // gather meta
  // remove keys that aren't necessary to update
  const datas = _omit(ko.toJS(viewModel.metadata), EDITOR_ONLY_METADATA_KEYS);
  datas.data = viewModel.exportJS();
  return datas;
}

function loader(opts) {
  const updateRoute = opts.metadata.url.update;
  return function (viewModel) {
    console.info('init server storage (save, test, download)');
    /// ///
    // SAVE
    /// ///
    // The metadata route, when the company has the feature. `undefined` otherwise,
    // which is what `saveMetadata` below checks.
    const metadataRoute =
      opts.metadata.emailMetadataConfig &&
      opts.metadata.emailMetadataConfig.url &&
      opts.metadata.emailMetadataConfig.url.update;

    const saveCmd = {
      name: 'Save', // l10n happens in the template
      enabled: ko.observable(true),
      // Drives the dot on the Save button. The email settings have no save button
      // of their own any more, so without this the user types a subject line, gets
      // no signal at all, and leaves.
      hasPendingChanges: ko.observable(false),
    };

    // Kept for the lifetime of the editor: the store is reset, not rebuilt, when
    // the template is swapped.
    emailMetadataStore.onChange(function (dirty) {
      saveCmd.hasPendingChanges(dirty);
    });

    /**
     * The email settings, PATCHed on their own route, before the email itself.
     *
     * Two requests rather than one because the metadata endpoint validates what
     * `updateMosaico` does not — a withdrawn typology, a subject past the server
     * limit, a company that opted out — and answers 422.
     *
     * Its failure NEVER blocks the email save. An earlier revision skipped the PUT
     * when the PATCH failed, reasoning that refusing early costs nothing. It holds
     * for a 422, which the user can fix in the form. It does not hold for a 403,
     * a 5xx or a dropped connection: the store stays dirty by design, so every
     * later click replayed the same failing PATCH and skipped the PUT again, and
     * the email became permanently unsavable with no way out from the interface.
     * An admin turning the company flag off mid-session was enough to destroy
     * someone's afternoon of work.
     *
     * Resolves immediately when there is nothing to do, so an opted-out company
     * follows exactly the path it did before this feature existed.
     */
    function saveMetadata() {
      if (!metadataRoute || !emailMetadataStore.isDirty()) {
        return $.Deferred().resolve().promise();
      }

      // Captured before the request, and handed back on success. Marking the
      // state at response time would swallow whatever the user typed while it was
      // in flight: their correction would never be sent and never be flagged.
      const sent = emailMetadataStore.snapshot();

      return $.ajax({
        url: metadataRoute,
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify(emailMetadataStore.payload()),
      }).then(function () {
        // Only on success: a failed PATCH leaves the state dirty on purpose, so
        // the button keeps saying there is something to retry.
        emailMetadataStore.markSaved(sent);
      });
    }

    saveCmd.execute = function () {
      saveCmd.enabled(false);
      // Read by onPostSuccess: a "saved" toast shown next to a metadata error
      // would tell the user their subject line is safe when it is not.
      let metadataFailed = false;

      saveMetadata()
        .fail(function (jqXHR) {
          metadataFailed = true;
          onMetadataError(jqXHR);
        })
        // `always`, not `done`: the email content is never held hostage by the
        // metadata route. See saveMetadata's header for what that cost before.
        .always(function () {
          saveMailing().always(onPostComplete);
        });

      function saveMailing() {
        let data = getData(viewModel);

        data = {
          ...data,
          htmlToExport: viewModel.exportHTML()
        };
        // force JSON for bodyparser to catch up
        // => keep types server side
        return $.ajax({
          url: updateRoute,
          method: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify(data),
          success: onPostSuccess,
          error: onPostError,
        });
      }

      // use callback for easier jQuery updates
      // => Deprecation notice for .success(), .error(), and .complete()
      function onPostSuccess(data, textStatus, jqXHR) {
        if (metadataFailed) return;
        viewModel.notifier.success(viewModel.t('save-message-success'));
      }

      function onPostError(jqXHR, textStatus, errorThrown) {
        console.log('save error');
        console.log(errorThrown);
        viewModel.notifier.error(viewModel.t('save-message-error'));
      }

      // The email itself is saved either way; this names what did NOT go through.
      // A withdrawn typology reads very differently from a generic save failure.
      function onMetadataError(jqXHR) {
        viewModel.notifier.error(
          viewModel.t(
            errorKeyFor({
              response: { data: (jqXHR && jqXHR.responseJSON) || null },
            })
          )
        );
      }

      function onPostComplete() {
        saveCmd.enabled(true);
      }
    };

    /// ///
    // EMAIL
    /// ///
    const testCmd = {
      name: 'Test', // l10n happens in the template
      enabled: ko.observable(true),
    };
    testCmd.execute = function () {
      viewModel.openTestModal(true);
    };

    /// ///
    // ZIP
    /// ///

    // Download markup can be found in:
    // • tmpl-badsender/download-buttons.tmpl.html

    // Download local/FTP button
    const downloadCmd = {
      name: 'Download', // l10n happens in the template
      enabled: ko.observable(true),
    };

    const dlDefault = { forCdn: false, forFtp: false };
    downloadCmd.execute = function downloadMail(downloadOptions = dlDefault) {
      // ====================================
      // Block download if required tracking params are missing
      const missingTracking = checkRequiredTrackingParams(viewModel);
      if (missingTracking.length > 0) {
        displayTrackingError(missingTracking, viewModel);
        document.getElementById('main-wysiwyg-area').scrollTo({
          behavior: 'smooth',
          top: 0,
        });
        return;
      }

      // ====================================
      // Check for missing input values
      const errors = getErrorsForControlQuality(viewModel);
      if (errors && errors.length > 0) {
        displayErrors(errors, viewModel);
        // Scroll to top so the user can see warnings if there is any
        document.getElementById('main-wysiwyg-area').scrollTo({
          behavior: 'smooth',
          top: 0,
        })
      } else {
        $('.error-message').remove();
      }

      downloadCmd.enabled(false);

      viewModel.notifier.info(viewModel.t('Downloading...'));

      $.ajax({
        url: viewModel.metadata.url.zip,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          html: viewModel.exportHTML(),
          filename: viewModel.metadata.name(),
          downLoadForCdn: downloadOptions.forCdn,
          downLoadForFtp: downloadOptions.forFtp,
          // Send the live tracking state from the builder so the backend
          // validates / rewrites against the latest values rather than the
          // last saved snapshot in mailing.data.tracking.
          tracking: ko.toJS(viewModel.content().tracking),
        }),
        xhrFields: { responseType: 'blob' },
        success: function(blob) {
          var url = window.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = viewModel.metadata.name() + '.zip';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        },
        error: function() {
          viewModel.notifier.error(viewModel.t('download-ftp-error'));
        },
        complete: function() {
          downloadCmd.enabled(true);
        },
      });
    };

    viewModel.save = saveCmd;
    viewModel.test = testCmd;
    viewModel.download = downloadCmd;
  };
}

module.exports = loader;
