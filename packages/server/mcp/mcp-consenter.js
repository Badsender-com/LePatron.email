'use strict';

const { Users, Groups } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { READ_SCOPE, WRITE_SCOPE, toRequestUser } = require('./mcp-identity.js');
const ERROR_CODES = require('../constant/error-codes.js');

// Who may consent to a connection (ADR 0012), to which companies, and why
// not: what a company lacks, the MCP module or MCP access (ADR 0017), told as
// the code of the refusal (ERROR_CODES.MCP_CONSENT_…).

// What a company lacks for its users to connect (ADR 0017): the MCP module,
// which only the platform company opens, or MCP access, which its tech admin
// turns on. None when it has both.
function lackOf(group) {
  if (group?.enableMcpModule !== true) return ERROR_CODES.MCP_CONSENT_NO_MODULE;
  if (group.enableMcp !== true) return ERROR_CODES.MCP_CONSENT_NO_ACCESS;
  return null;
}

const OPEN_FIELDS = 'enableMcpModule enableMcp';

// What a company lacks, read as stored now.
async function lackOfCompany(groupId) {
  return lackOf(await Groups.findById(groupId).select(OPEN_FIELDS).lean());
}

// Why no company is offered, told from what is missing. Of the one company
// the consent is about: the client's, or the user's own. For a super admin
// free to choose, of them all: no company has the module, or none has MCP
// access as well.
async function refusalWithoutGroups(consenter, company) {
  const companyId = company?.id || (!consenter.isPlatform && consenter.ownId);
  if (!companyId) {
    return (await Groups.exists({ enableMcpModule: true }))
      ? ERROR_CODES.MCP_CONSENT_NO_ACCESS
      : ERROR_CODES.MCP_CONSENT_NO_MODULE;
  }
  return (await lackOfCompany(companyId)) || ERROR_CODES.MCP_CONSENT_NO_ACCESS;
}

// The account behind the app's session, read as the MCP server reads it, and
// the groups a connection may be bound to: the user's own, or, for a super
// admin, every group with MCP access. Either way, only a group that has the
// MCP module (ADR 0017).
async function consenterOf(req) {
  const userId = req.user?.id;
  const record =
    userId &&
    (await Users.findOne({ _id: userId, isDeactivated: { $ne: true } })
      .select('_id name email role _company')
      .lean());
  if (!record) return null;
  // No company is chosen yet: the user's own stands for it.
  const user = toRequestUser(record, record._company);
  const isPlatform = permissions.can(user, CAPABILITIES.PLATFORM_MANAGE);
  const open = { enableMcpModule: true, enableMcp: true };
  const groups = await Groups.find(
    isPlatform ? open : { _id: record._company, ...open }
  )
    .select('_id name')
    .sort({ name: 1 })
    .lean();
  return {
    user,
    isPlatform,
    ownId: String(record._company),
    groups: groups.map((group) => ({
      id: String(group._id),
      name: group.name,
    })),
    // Drafting skills and expertises is offered to whoever may manage the
    // platform (ADR 0014).
    scopes: isPlatform ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE],
  };
}

module.exports = { consenterOf, refusalWithoutGroups, lackOfCompany };
