'use strict';

/**
 * The one clock of the MCP fixtures (`mcp-fixtures.js`, `mcp-ai-fixtures.js`):
 * dates relative to the run, so a mailing's status does not drift with the
 * calendar ("planned in 5 days" stays in the future).
 */

const NOW = new Date();
const daysFrom = (days) => new Date(NOW.getTime() + days * 24 * 3600 * 1000);

module.exports = { NOW, daysFrom };
