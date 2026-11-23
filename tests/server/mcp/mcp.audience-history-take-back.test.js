/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Taking back the past openings and withdrawals (ADR 0031): only from what
// the call log still holds of the audiences set through an assistant, run
// dry first, and never a date for an item the call log does not know.

const harness = require('../../helpers/mcp-harness');
const f = require('../../helpers/mcp-fixtures');
const s = require('../../helpers/mcp-catalog-changes-seed');

let logs = 0;
const log = (id, change, iso, fields = {}) => ({
  _id: `507f1f77bcf86cd7994399${String((logs += 1)).padStart(2, '0')}`,
  _company: f.PLATFORM_GROUP,
  _user: f.ALICE,
  method: 'tools/call',
  name: 'set_audience',
  objectIds: [id],
  change,
  outcome: 'ok',
  createdAt: new Date(iso),
  ...fields,
});

// No history recorded yet: the items as they were before ADR 0031.
const SEED = {
  ...s.SEED,
  expertises: s.EXPERTISES.map((e) => ({ ...e, audienceHistory: [] })),
  skills: s.SKILLS.map((k) => ({ ...k, audienceHistory: [] })),
  callLogs: [
    log('b2b.prospection', 'audience:all:check', '2026-11-18T11:59:00Z'),
    log('b2b.prospection', 'audience:all', '2026-11-18T12:00:00Z'),
    log('b2b.prospection', 'audience:all', '2026-11-18T12:05:00Z'),
    log('redaction.old-tone', 'audience:platform', '2026-11-20T08:00:00Z', {
      outcome: 'refused',
    }),
    log('nowhere.to-be-found', 'audience:all', '2026-11-19T08:00:00Z'),
  ],
};

const takeBack = (options) =>
  require('../../../packages/server/ai-skill/services/audience-history-take-back.js').takeBackAudienceHistory(
    options
  );
const historyOf = (id) =>
  harness.stored('expertises').find((e) => e.expertiseId === id)
    .audienceHistory;

describe('audience history taking back', () => {
  beforeEach(() => harness.seed(SEED));

  // Turned on by #1669 (take back the past openings, dry first)
  describe.skip('from the call log', () => {
    it('lists, dry, the openings it found, and writes nothing', async () => {
      const report = await takeBack({ write: false });

      expect(report.found).toEqual([
        {
          kind: 'expertise',
          id: 'b2b.prospection',
          audience: 'all',
          at: '2026-11-18T12:00:00.000Z',
        },
      ]);
      expect(report.unresolved).toEqual(['nowhere.to-be-found']);
      expect(report.written).toBe(0);
      expect(historyOf('b2b.prospection')).toEqual([]);
    });

    it('records what it found, with who set it', async () => {
      const report = await takeBack({ write: true });

      expect(report.written).toBe(1);
      const [entry] = historyOf('b2b.prospection');
      expect(entry.audience).toBe('all');
      expect(new Date(entry.at).toISOString()).toBe('2026-11-18T12:00:00.000Z');
      expect(String(entry._by)).toBe(f.ALICE);
    });

    it('invents nothing for an item the call log does not know', async () => {
      await takeBack({ write: true });

      expect(historyOf('crm.governance')).toEqual([]);
      expect(historyOf('redaction.old-tone')).toEqual([]);
    });

    it('records nothing twice', async () => {
      await takeBack({ write: true });
      const again = await takeBack({ write: true });

      expect(again.found).toEqual([]);
      expect(historyOf('b2b.prospection')).toHaveLength(1);
    });
  });
});
