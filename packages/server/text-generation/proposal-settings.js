'use strict';

const { Groups, Templates } = require('../common/models.common.js');
const {
  resolveQualitySettings,
} = require('../../shared/quality/resolve-quality-settings.js');

/**
 * The quality settings the editor's quality control applies to a mailing
 * (`qualitySettings` of the editor data, mailing.schema.js): its template's,
 * else its template's company's, else the defaults (ADR 0009). The proposals
 * are measured against the same thresholds as the email they go into, so the
 * modal and the quality control never give two verdicts on one text.
 *
 * @param {Object} mailing with `_wireframe`
 * @returns {Promise<{ checks: Object }>}
 */
async function qualitySettingsOf(mailing) {
  const template = mailing._wireframe
    ? await Templates.findById(mailing._wireframe)
        .select({ _company: 1, qualitySettings: 1 })
        .lean()
    : null;
  const group = template?._company
    ? await Groups.findById(template._company)
        .select({ qualitySettings: 1 })
        .lean()
    : null;
  return resolveQualitySettings(group, template);
}

module.exports = { qualitySettingsOf };
