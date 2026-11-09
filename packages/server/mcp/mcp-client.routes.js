'use strict';

const express = require('express');
const { GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { GUARD_MCP_COMPANY } = require('./mcp-company.guard.js');
const clients = require('./mcp-client.controller.js');

// The clients a company registers by hand (ADR 0012), in its MCP settings:
// its tech admin's, or a super admin's. Mounted on
// `/api/groups/:groupId/mcp-clients`, whose `groupId` the routes read.
const router = express.Router({ mergeParams: true });
const MANAGE_TECH = GUARD_CAN(CAPABILITIES.GROUP_MANAGE_TECH);

router.get('/', MANAGE_TECH, GUARD_MCP_COMPANY, clients.list);
router.post('/', MANAGE_TECH, GUARD_MCP_COMPANY, clients.create);
router.delete('/:clientId', MANAGE_TECH, GUARD_MCP_COMPANY, clients.remove);

module.exports = router;
