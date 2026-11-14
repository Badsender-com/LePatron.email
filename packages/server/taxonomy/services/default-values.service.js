'use strict';

const {
  buildEditorDimensions,
} = require('../../mailing/mailing-company-dimensions.service.js');
const {
  contractOfTemplate,
} = require('../../template/template-contract.service.js');
const {
  resolveDefaults,
} = require('../../../shared/taxonomy/default-values.js');

module.exports = { defaultValuesForNewEmail };

/**
 * The values an email takes when it is created (ADR-0024), whoever creates it:
 * the editor, the API or the MCP server. The rule is the one the editor applies
 * on a parent change (shared/taxonomy/default-values.js): the template's own
 * default, then the company's, for the dimensions in the email's scope.
 *
 * Stored on the email, so a default changed later changes no email.
 *
 * @param {Object} params
 * @param {ObjectId|string} params.companyId
 * @param {ObjectId|string} [params.templateId]
 * @returns {Promise<Array>} the ids of the values to store on the email
 */
async function defaultValuesForNewEmail({ companyId, templateId }) {
  if (!companyId) return [];
  const dimensions = await buildEditorDimensions({ companyId, templateId });
  if (dimensions.length === 0) return [];

  const { declared } = await contractOfTemplate(templateId);
  const selections = resolveDefaults({
    dimensions,
    selections: {},
    templateDefaults: declared,
  });

  const byId = new Map(
    dimensions.flatMap((dimension) =>
      dimension.values.map((value) => [String(value.id), value.id])
    )
  );
  return Object.values(selections).map((id) => byId.get(String(id)));
}
