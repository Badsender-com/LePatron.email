import {
  changedDimensionFields,
  scopeIsFixed,
} from '~/helpers/taxonomy-dimension-form.js';

// What the dimension dialog sends beyond the wording (#1521, ADR-0024).

const INITIAL = {
  parentName: null,
  role: null,
  scope: 'all',
  precedence: 0,
};
const changes = (form, { isStandard = false, initial = INITIAL } = {}) =>
  changedDimensionFields({
    form: { name: 'silo', ...initial, ...form },
    initial,
    isStandard,
  });

describe('the scope a dimension dialog offers', () => {
  it('fixes the scope of a standard dimension and of one holding a role', () => {
    expect(scopeIsFixed({ standard: true })).toBe(true);
    expect(scopeIsFixed({ role: 'language' })).toBe(true);
    expect(scopeIsFixed({ standard: false, role: null })).toBe(false);
  });
});

describe('what the dimension dialog sends beyond the wording', () => {
  it('sends nothing that did not change', () => {
    expect(changes({})).toEqual({});
  });

  it('sends a scope restricted to the templates reading it, and back', () => {
    expect(changes({ scope: 'readingTemplates' })).toEqual({
      scope: 'readingTemplates',
    });
    expect(
      changes(
        { scope: 'all' },
        { initial: { ...INITIAL, scope: 'readingTemplates' } }
      )
    ).toEqual({ scope: 'all' });
  });

  it('brings the scope back to every email when a role is chosen', () => {
    expect(
      changes(
        { role: 'language', scope: 'readingTemplates' },
        { initial: { ...INITIAL, scope: 'readingTemplates' } }
      )
    ).toEqual({ role: 'language', scope: 'all' });
  });

  it('sends a parent, a role and a precedence that changed', () => {
    expect(
      changes({ parentName: 'market', role: 'country', precedence: '12' })
    ).toEqual({ parentName: 'market', role: 'country', precedence: 12 });
  });

  it('sends neither parent, role nor scope for a standard dimension', () => {
    expect(
      changes(
        { parentName: 'market', role: 'country', scope: 'readingTemplates' },
        { isStandard: true }
      )
    ).toEqual({});
  });

  it('sends no precedence for the trigger', () => {
    expect(
      changedDimensionFields({
        form: { ...INITIAL, name: 'trigger', precedence: 5 },
        initial: INITIAL,
        isStandard: true,
      })
    ).toEqual({});
  });
});
