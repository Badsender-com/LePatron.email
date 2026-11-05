/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
  runRules,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel } = require('./fake-view-model');

const heroBlocks = [
  { id: 'ko_heroBlock_1', type: 'heroBlock' },
  { id: 'ko_heroBlock_2', type: 'heroBlock' },
];

const reportEveryBlock = {
  id: 'fake',
  category: 'content',
  severity: 'warning',
  run: (ctx) =>
    ctx.blocks.map((block) => ({
      messageKey: 'Fake',
      blockId: block.id,
      value: block.text,
    })),
};

// What a rule may declare besides `run`: whether it applies, and what its
// pass says. Neither must take the run down.
describe('a rule that applies, or not', () => {
  it('describes a passed check only, and keeps it passed when that fails', () => {
    const undescribed = {
      ...reportEveryBlock,
      id: 'undescribed',
      run: () => [],
      passParams: () => {
        throw new Error('boom');
      },
    };
    const failing = {
      ...reportEveryBlock,
      passParams: jest.fn(() => ({ n: 1 })),
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { checks } = runQualityChecks(fakeViewModel({ blocks: heroBlocks }), {
      rules: [undescribed, failing],
    });
    console.error.mockRestore();

    expect(checks[0]).toMatchObject({ status: 'passed', passParams: {} });
    expect(checks[1]).toMatchObject({ status: 'failed', passParams: {} });
    expect(failing.passParams).not.toHaveBeenCalled();
  });

  it('leaves out a rule that cannot tell whether it applies', () => {
    const undecided = {
      ...reportEveryBlock,
      id: 'undecided',
      enabled: () => {
        throw new Error('boom');
      },
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { checks } = runQualityChecks(fakeViewModel({ blocks: heroBlocks }), {
      rules: [undecided, reportEveryBlock],
    });
    console.error.mockRestore();

    expect(checks.map((c) => c.ruleId)).toEqual(['fake']);
  });
});

describe('runRules', () => {
  it('runs rules on a context already built, the server answer added', () => {
    const { ctx } = runQualityChecks(fakeViewModel({ blocks: heroBlocks }), {
      rules: [],
    });
    const remoteReader = {
      ...reportEveryBlock,
      id: 'remote',
      run: (c) => [{ messageKey: 'Seen', value: c.remote.answer }],
    };
    ctx.remote = { answer: 42 };

    const { findings, checks } = runRules(ctx, [remoteReader]);
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'remote',
        messageKey: 'Seen',
        fingerprint: expect.stringMatching(/^remote\|-\|-\|/),
      }),
    ]);
    expect(checks).toMatchObject([
      { ruleId: 'remote', status: 'failed', count: 1 },
    ]);
  });

  it('leaves out a rule that does not apply', () => {
    const off = { ...reportEveryBlock, id: 'off', enabled: () => false };
    const { ctx } = runQualityChecks(fakeViewModel(), { rules: [] });
    expect(
      runRules(ctx, [off, reportEveryBlock]).checks.map((c) => c.ruleId)
    ).toEqual(['fake']);
  });
});
