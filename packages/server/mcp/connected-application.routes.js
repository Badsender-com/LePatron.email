'use strict';

const express = require('express');
const { GUARD_CAN, GUARD_USER } = require('../account/auth.guard.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { GUARD_MCP_COMPANY } = require('./mcp-company.guard.js');
const applications = require('./connected-application.controller.js');

// The applications a user connected (ADR 0012), which they list and revoke
// one by one, whatever their role: each is their own.
// Mounted on `/api/connected-applications`.
const connectedApplicationsRouter = express.Router();

connectedApplicationsRouter.get('/', GUARD_USER, applications.listOwn);
connectedApplicationsRouter.delete('/:id', GUARD_USER, applications.revokeOwn);

// A company's connected applications, which its tech admin, or a super
// admin, counts and revokes at once, say when an assistant leaks. Mounted on
// `/api/groups/:groupId/connected-applications`.
const groupConnectedApplicationsRouter = express.Router({ mergeParams: true });
const MANAGE_TECH = GUARD_CAN(CAPABILITIES.GROUP_MANAGE_TECH);

groupConnectedApplicationsRouter.get(
  '/',
  MANAGE_TECH,
  GUARD_MCP_COMPANY,
  applications.countOfCompany
);
groupConnectedApplicationsRouter.delete(
  '/',
  MANAGE_TECH,
  GUARD_MCP_COMPANY,
  applications.revokeAllOfCompany
);

module.exports = {
  connectedApplicationsRouter,
  groupConnectedApplicationsRouter,
};
