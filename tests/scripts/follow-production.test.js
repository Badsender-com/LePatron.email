/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A copy follows production every night (ADR 0019, #1426): the hosting
// platform's scheduler runs a command, the web server runs no timer. The
// command runs the same follow as the button, records it as the night's, does
// nothing on an instance that follows no production, and says by its exit
// code when the follow did not go through.

const { createMcpStore } = require('../helpers/mcp-fake-models');

const store = createMcpStore();
jest.doMock(
  '../../packages/server/common/models.common.js',
  () => store.models
);
jest.doMock('../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
const mockSource = {
  isConfigured: jest.fn(),
  isNightly: jest.fn(),
  productionOrigin: jest.fn(() => 'https://production.example'),
  fetchProductionExport: jest.fn(),
};
jest.doMock(
  '../../packages/server/ai-skill/services/skills-source-client.js',
  () => mockSource
);

const f = require('../helpers/mcp-fixtures');
const {
  exportForCopies,
} = require('../../packages/server/ai-skill/services/skills-follow.format.js');
const {
  lastFollow,
} = require('../../packages/server/ai-skill/services/skills-follow-lock.js');
const { followTonight } = require('../../scripts/follow-production.js');

const SUBJECT_LINES = 'redaction.subject-line';
const EMPTY_COPY = { ...f.SEED, expertises: [], skills: [] };

// Production's answer, read from a store seeded as production.
async function productionAnswer() {
  store.seed(f.SEED);
  return JSON.parse(JSON.stringify(await exportForCopies({ origin: 'prod' })));
}

describe('the nightly follow', () => {
  const log = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSource.isConfigured.mockReturnValue(true);
    mockSource.isNightly.mockReturnValue(true);
  });

  it('follows production, and records it as the night', async () => {
    const answer = await productionAnswer();
    store.seed(EMPTY_COPY);
    mockSource.fetchProductionExport.mockResolvedValue(answer);

    const exitCode = await followTonight({ log });

    expect(exitCode).toBe(0);
    expect(store.stored('expertises').map((e) => e.expertiseId)).toContain(
      SUBJECT_LINES
    );
    expect(await lastFollow()).toMatchObject({
      status: 'succeeded',
      trigger: 'night',
    });
  });

  it('does nothing on an instance that follows no production', async () => {
    store.seed(EMPTY_COPY);
    mockSource.isConfigured.mockReturnValue(false);

    const exitCode = await followTonight({ log });

    expect(exitCode).toBe(0);
    expect(mockSource.fetchProductionExport).not.toHaveBeenCalled();
    expect(await lastFollow()).toBeNull();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/follows no production/i)
    );
  });

  // Each instance says whether it follows at night (ADR 0019).
  it('does nothing on a copy that does not follow at night', async () => {
    store.seed(EMPTY_COPY);
    mockSource.isNightly.mockReturnValue(false);

    const exitCode = await followTonight({ log });

    expect(exitCode).toBe(0);
    expect(mockSource.fetchProductionExport).not.toHaveBeenCalled();
    expect(await lastFollow()).toBeNull();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/SKILLS_SOURCE_NIGHTLY/)
    );
  });

  // The scheduler runs the command on every instance: one follows, the
  // others find its lock and write nothing.
  it('writes nothing and exits 0 while another follow runs', async () => {
    store.seed({
      ...EMPTY_COPY,
      follows: [
        {
          status: 'running',
          trigger: 'night',
          by: '',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 1000),
        },
      ],
    });

    const exitCode = await followTonight({ log });

    expect(exitCode).toBe(0);
    expect(mockSource.fetchProductionExport).not.toHaveBeenCalled();
    expect(store.stored('expertises')).toEqual([]);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/another follow/i));
  });

  it('exits in error when the follow fails, having recorded it', async () => {
    store.seed(EMPTY_COPY);
    mockSource.fetchProductionExport.mockRejectedValue(
      Object.assign(new Error('Production refused the read token.'), {
        reason: 'token_refused',
      })
    );

    const exitCode = await followTonight({ log });

    expect(exitCode).toBe(1);
    expect(await lastFollow()).toMatchObject({
      status: 'failed',
      reason: 'token_refused',
      trigger: 'night',
    });
    expect(store.stored('expertises')).toEqual([]);
  });
});
