'use strict';

const {
  listContracts,
} = require('../../template/template-contract.service.js');
const { resolveCompanyId } = require('./company-scope.js');

/**
 * The company's templates with their contract (ADR-0024), for the taxonomy
 * workspace: what an email of each one proposes, which ones read a dimension,
 * and the points to check (ADR-0026). A contract stored by an older reader is
 * read again on the way.
 */
module.exports = { listTemplateContracts };

/**
 * @param {Object} params
 * @param {Object} params.user
 * @param {string} [params.groupId] the target company, super admin only
 * @returns {Promise<Array<{id: string, name: string, contract: Object}>>}
 *   by name
 */
async function listTemplateContracts({ user, groupId }) {
  const companyId = resolveCompanyId(user, groupId);
  const templates = await listContracts({ _company: companyId });
  const listed = templates.map((template) => ({
    id: String(template._id),
    name: template.name,
    contract: template.contract,
  }));
  return listed.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
