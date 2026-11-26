'use strict';

const ko = require('knockout');
const {
  STANDARD_DIMENSIONS,
} = require('../../../../shared/taxonomy/constants.js');
const { isPublishable } = require('./publish-to-template');

/**
 * The template options the editor hides (ADR-0015, Consequences): the root
 * property of the template a company dimension sent to the editor feeds. The
 * dimension decides, and two selects for one property can only disagree: the
 * dimension would overwrite the template option's choice at its next change.
 *
 * A deactivated dimension is not sent to the editor, or is sent flagged, and
 * no longer decides: its option comes back. So does a dimension with no value
 * to offer, declared before its values or with all of them deactivated: hiding
 * the option would leave nothing in its place. The email type and the trigger
 * follow the same rule: their selects in the email settings feed the
 * `emailType` and `trigger` properties. Covered by
 * tests/editor/template-options.test.js.
 *
 * @param {Object} params
 * @param {Array} params.dimensions the company dimensions the server sent the
 *   editor
 * @param {Array} [params.emailTypes] the email types the editor offers
 * @param {string[]} [params.triggers] the triggers the editor offers
 * @param {string[]} params.templateProperties the root properties of the template
 * @returns {string[]} the properties whose option is hidden
 */
function hiddenTemplateOptions({
  dimensions,
  emailTypes,
  triggers,
  templateProperties,
}) {
  const standard = [
    { name: STANDARD_DIMENSIONS.EMAIL_TYPE, values: emailTypes },
    {
      name: STANDARD_DIMENSIONS.TRIGGER,
      values: (triggers || []).map((trigger) => ({ id: trigger })),
    },
  ];
  const fed = standard
    .concat(dimensions || [])
    .filter(
      (dimension) => dimension.isActive !== false && offersValues(dimension)
    )
    .map((dimension) => dimension.name);
  return (templateProperties || []).filter((property) =>
    fed.includes(property)
  );
}

// The server also sends the deactivated values an email carries, flagged:
// those are shown, not offered.
function offersValues(dimension) {
  return (dimension.values || []).some((value) => value.isActive !== false);
}

/**
 * The root properties of an email's content a dimension can feed: the
 * observables holding a plain value that Mosaico built from the template's
 * options and its `_root_` reads, those utils/publish-to-template.js writes.
 *
 * @param {Object|null} content the root of the email's content
 * @returns {string[]}
 */
function rootPropertiesOf(content) {
  if (!content) return [];
  return Object.keys(content).filter((name) => isPublishable(content[name]));
}

/**
 * Hang on the viewModel what the template's own option editors read
 * (converter/editor.js): the hidden options, and the test each option editor
 * runs. Empty until the email settings say what they feed, and for an
 * opted-out company: every option stays.
 *
 * @param {Object} vm the editor's viewModel
 */
function exposeHiddenTemplateOptions(vm) {
  vm.hiddenTemplateOptions = ko.observableArray([]);
  vm.isHiddenTemplateOption = (name) =>
    vm.hiddenTemplateOptions().indexOf(name) !== -1;
}

/**
 * Hide the template options the email settings feed, read from the email's
 * content as the editor opened it.
 *
 * @param {Object} vm the editor's viewModel, `content` and the
 *   `hiddenTemplateOptions` exposeHiddenTemplateOptions hung on it
 * @param {Object} config the email settings the server sent,
 *   `{dimensions, emailTypes, triggers}`
 */
function hideTemplateOptionsFedBy(vm, config) {
  vm.hiddenTemplateOptions(
    hiddenTemplateOptions({
      dimensions: config.dimensions,
      emailTypes: config.emailTypes,
      triggers: config.triggers,
      templateProperties: rootPropertiesOf(vm.content && vm.content()),
    })
  );
}

module.exports = {
  hiddenTemplateOptions,
  rootPropertiesOf,
  exposeHiddenTemplateOptions,
  hideTemplateOptionsFedBy,
};
