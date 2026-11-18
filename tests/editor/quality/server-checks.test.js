'use strict';

// Which checks read the server's answer, and which of them make the export
// wait, is said once, in the shared catalogue (packages/shared/quality/checks.js):
// each check declares what it asks of the server. The editor still lists its
// rules by hand; these tests tie its lists to the catalogue's.

const {
  REMOTE_RULES,
  SERVER_ANSWER_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  CHECKS,
  SERVER_CHECKS,
  SERVER_TASKS,
} = require('../../../packages/shared/quality/checks.js');
const {
  REMOTE_CHECKS,
} = require('../../../packages/server/mailing/quality-resources.payload.js');

const idsOf = (rules) => rules.map((rule) => rule.id).sort();

describe("the editor's server checks and the catalogue", () => {
  it('runs on the server answer exactly the checks the catalogue makes the export wait for', () => {
    expect(idsOf(REMOTE_RULES)).toEqual([...SERVER_CHECKS].sort());
  });

  it('reads the server answer in exactly the checks that ask the server something', () => {
    expect(idsOf(SERVER_ANSWER_RULES)).toEqual(
      Object.keys(SERVER_TASKS).sort()
    );
  });

  it('never makes the export wait for a local check with a second look', () => {
    const late = SERVER_ANSWER_RULES.filter(
      (rule) => !REMOTE_RULES.includes(rule)
    );
    expect(idsOf(late)).toEqual(['unsupported-image-formats']);
    late.forEach((rule) => {
      expect(CHECKS[rule.id].server.awaited).toBe(false);
      expect(SERVER_CHECKS).not.toContain(rule.id);
    });
  });

  it('has the server accept every check reading its answer, with its task', () => {
    expect(REMOTE_CHECKS).toEqual({
      'broken-links': 'linkProbes',
      'dangerous-links': 'webRisk',
      'domain-blocklists': 'blocklists',
      'image-weight': 'images',
      'images-total-weight': 'images',
      'oversized-images': 'images',
      'unsupported-image-formats': 'images',
    });
  });
});
