'use strict';

const {
  partitionInputKeys,
  cleanInput,
  EXPERTISE_KEY,
} = require('../../../packages/ui/helpers/input-form-reconcile');

// What happens to a scenario's input when the selected skill changes: which
// keys the new schema does not know, and which of those carry work worth
// confirming before it is dropped.

const DESCRIPTOR_WITH_EXPERTISE = { hasExpertiseField: true };
const DESCRIPTOR_WITHOUT = { hasExpertiseField: false };

describe('partitionInputKeys', () => {
  it('reports nothing for an input the schema fully knows', () => {
    expect(
      partitionInputKeys({ prompt: 'hi', tone: 'formal' }, ['prompt', 'tone'])
    ).toEqual({ dropped: [], droppedNonEmpty: [] });
  });

  it('separates keys with a value from keys without', () => {
    const out = partitionInputKeys(
      { prompt: 'hi', brief: 'a real brief', tone: '', extra: null },
      ['prompt']
    );
    expect(out.dropped).toEqual(['brief', 'tone', 'extra']);
    // Empty values are not worth a confirmation dialog.
    expect(out.droppedNonEmpty).toEqual(['brief']);
  });

  it('counts false and 0 as values worth keeping', () => {
    const out = partitionInputKeys({ flag: false, count: 0 }, []);
    expect(out.droppedNonEmpty).toEqual(['flag', 'count']);
  });

  it('survives an absent input', () => {
    expect(partitionInputKeys(undefined, ['prompt'])).toEqual({
      dropped: [],
      droppedNonEmpty: [],
    });
  });

  // `expertise` is never in `fields` (describe-schema keeps it out — the runner
  // injects it) but the zod schema accepts it when the skill declares it.
  it('does not drop `expertise` when the skill declares it', () => {
    const out = partitionInputKeys(
      { prompt: 'hi', [EXPERTISE_KEY]: [{ expertiseId: 'e1' }] },
      ['prompt'],
      DESCRIPTOR_WITH_EXPERTISE
    );
    expect(out.dropped).toEqual([]);
  });

  it('drops `expertise` when the skill does not declare it', () => {
    const out = partitionInputKeys(
      { prompt: 'hi', [EXPERTISE_KEY]: [{ expertiseId: 'e1' }] },
      ['prompt'],
      DESCRIPTOR_WITHOUT
    );
    expect(out.dropped).toEqual([EXPERTISE_KEY]);
    expect(out.droppedNonEmpty).toEqual([EXPERTISE_KEY]);
  });

  it('drops `expertise` when there is no descriptor at all', () => {
    const out = partitionInputKeys({ [EXPERTISE_KEY]: ['x'] }, []);
    expect(out.dropped).toEqual([EXPERTISE_KEY]);
  });
});

describe('cleanInput', () => {
  it('keeps the known keys and their values', () => {
    expect(
      cleanInput({ prompt: 'hi', brief: 'gone', tone: '' }, ['prompt', 'tone'])
    ).toEqual({ prompt: 'hi', tone: '' });
  });

  it('omits a known key that has no value rather than writing undefined', () => {
    const out = cleanInput({ prompt: 'hi' }, ['prompt', 'tone']);
    expect(out).toEqual({ prompt: 'hi' });
    expect('tone' in out).toBe(false);
  });

  it('preserves `expertise` when the skill declares it', () => {
    expect(
      cleanInput(
        { prompt: 'hi', [EXPERTISE_KEY]: ['e1'] },
        ['prompt'],
        DESCRIPTOR_WITH_EXPERTISE
      )
    ).toEqual({ prompt: 'hi', [EXPERTISE_KEY]: ['e1'] });
  });

  it('removes `expertise` when the skill does not declare it', () => {
    expect(
      cleanInput(
        { prompt: 'hi', [EXPERTISE_KEY]: ['e1'] },
        ['prompt'],
        DESCRIPTOR_WITHOUT
      )
    ).toEqual({ prompt: 'hi' });
  });

  it('survives an absent input', () => {
    expect(cleanInput(undefined, ['prompt'])).toEqual({});
  });
});
