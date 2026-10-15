/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

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
      propertyPath: 'text',
      value: block.text,
    })),
};

describe('runQualityChecks', () => {
  it('exports the HTML only once, and not at all when it is given', () => {
    const vm = fakeViewModel();
    runQualityChecks(vm);
    expect(vm.exportHTML).toHaveBeenCalledTimes(1);

    vm.exportHTML.mockClear();
    runQualityChecks(vm, { html: '<p></p>' });
    expect(vm.exportHTML).not.toHaveBeenCalled();
  });

  it('completes each finding with its rule, block label and fingerprint', () => {
    const vm = fakeViewModel({ blocks: heroBlocks });
    const { findings } = runQualityChecks(vm, { rules: [reportEveryBlock] });

    expect(findings).toHaveLength(2);
    expect(findings[1]).toMatchObject({
      ruleId: 'fake',
      category: 'content',
      severity: 'warning',
      messageKey: 'Fake',
      params: {},
      blockId: 'ko_heroBlock_2',
      blockLabel: 'Hero #2',
      propertyPath: 'text',
    });
  });

  it('changes the fingerprint when the faulty value changes', () => {
    const run = (text) =>
      runQualityChecks(
        fakeViewModel({ blocks: [{ ...heroBlocks[0], text }] }),
        { rules: [reportEveryBlock] }
      ).findings[0].fingerprint;

    expect(run('a')).toBe(run('a'));
    expect(run('a')).not.toBe(run('b'));
  });

  it('tells identical findings of a block apart, the same way every run', () => {
    const twice = {
      ...reportEveryBlock,
      run: () => [
        { messageKey: 'Fake', blockId: 'ko_heroBlock_1', value: 'Read more' },
        { messageKey: 'Fake', blockId: 'ko_heroBlock_1', value: 'Read more' },
      ],
    };
    const run = () =>
      runQualityChecks(fakeViewModel({ blocks: heroBlocks }), {
        rules: [twice],
      }).findings.map((f) => f.fingerprint);

    const [first, second] = run();
    expect(first).not.toBe(second);
    expect(run()).toEqual([first, second]);
  });

  it('lists every check with its status, passed ones included', () => {
    const passing = { ...reportEveryBlock, id: 'passing', run: () => [] };
    const vm = fakeViewModel({ blocks: heroBlocks });
    const { checks } = runQualityChecks(vm, {
      rules: [reportEveryBlock, passing],
    });

    expect(checks).toEqual([
      { ruleId: 'fake', category: 'content', status: 'failed', count: 2 },
      { ruleId: 'passing', category: 'content', status: 'passed', count: 0 },
    ]);
  });

  it('keeps running the other checks when one of them throws', () => {
    const broken = {
      ...reportEveryBlock,
      id: 'broken',
      run: () => {
        throw new Error('boom');
      },
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const vm = fakeViewModel({ blocks: heroBlocks });
    const { findings, checks } = runQualityChecks(vm, {
      rules: [broken, reportEveryBlock],
    });

    expect(findings).toHaveLength(2);
    expect(checks[0]).toEqual({
      ruleId: 'broken',
      category: 'content',
      status: 'error',
    });
    console.error.mockRestore();
  });

  it('traces an exported node back to the block it lives in', () => {
    let traced;
    const tracer = {
      ...reportEveryBlock,
      run: (ctx) => {
        traced = Array.from(ctx.doc.querySelectorAll('span')).map((node) =>
          ctx.blockIdOf(node)
        );
        return [];
      },
    };
    const html = exportOf(
      { ko_heroBlock_1: '<table><tr><td><span>in</span></td></tr></table>' },
      { frame: '<span>frame</span>' }
    );
    runQualityChecks(fakeViewModel({ blocks: heroBlocks, html }), {
      rules: [tracer],
    });

    expect(traced).toEqual([null, 'ko_heroBlock_1']);
  });

  it('judges the blocks of every container, not only the main one', () => {
    const vm = fakeViewModel({
      blocks: [heroBlocks[0]],
      containers: {
        footerBlocks: [{ id: 'ko_textBlock_9', type: 'textBlock' }],
      },
    });
    const { findings } = runQualityChecks(vm, { rules: [reportEveryBlock] });

    expect(findings.map((f) => f.blockId)).toEqual([
      'ko_heroBlock_1',
      'ko_textBlock_9',
    ]);
  });

  it('reads a template without a main container', () => {
    const vm = fakeViewModel();
    vm.content = () => ({ tracking: () => ({ trackingUrls: () => [] }) });

    expect(runQualityChecks(vm, { rules: [reportEveryBlock] })).toEqual({
      findings: [],
      checks: [
        { ruleId: 'fake', category: 'content', status: 'passed', count: 0 },
      ],
    });
  });

  describe('when the engine itself fails', () => {
    beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
    afterEach(() => console.error.mockRestore());

    it('reports no finding when the email cannot be read', () => {
      const vm = fakeViewModel();
      vm.content = () => {
        throw new Error('boom');
      };

      expect(runQualityChecks(vm, { rules: [reportEveryBlock] })).toEqual({
        findings: [],
        checks: [{ ruleId: 'fake', category: 'content', status: 'error' }],
      });
    });

    it('fails only the rule whose findings cannot be completed', () => {
      const malformed = { ...reportEveryBlock, id: 'bad', run: () => [null] };
      const vm = fakeViewModel({ blocks: heroBlocks });
      const { findings, checks } = runQualityChecks(vm, {
        rules: [malformed, reportEveryBlock],
      });

      expect(checks.map((c) => c.status)).toEqual(['error', 'failed']);
      expect(findings).toHaveLength(2);
    });
  });
});
