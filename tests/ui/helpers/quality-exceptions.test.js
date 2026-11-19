import {
  recommendedOf,
  exceptionsOf,
  emptyException,
  generalOf,
  effectiveOf,
  isEmptyException,
  matchesBase,
  sameException,
  exceptionCount,
  blocksFrom,
  usesEmailMetadata,
  serverReadsImages,
  IMAGE_SERVER_CHECKS,
  adjustmentsOf,
  valuesEqualToBase,
} from '~/helpers/quality-exceptions.js';

// The "Contrôle qualité" page shows exceptions only (ADR 0009, admin design
// v4): what a group sets for every template (the general settings), and what
// one template sets for itself. Everything else applies the recommended
// values, the catalogue's.

const general = {
  checks: {
    subject: { thresholds: { tooLong: 80 } },
    'merge-tags': { state: 'blocking' },
  },
};

describe('the exceptions of a level', () => {
  it('reads only what is set, on the catalogue checks', () => {
    expect(
      exceptionsOf({
        checks: {
          subject: { thresholds: { tooLong: 80 } },
          headings: { state: 'off' },
          constructor: { state: 'off' },
        },
      })
    ).toEqual({
      subject: { state: null, thresholds: { long: null, tooLong: 80 } },
      headings: { state: 'off', thresholds: {} },
    });
  });

  it('reads a state the catalogue does not know as nothing set', () => {
    const stored = {
      checks: {
        headings: { state: 'loud' },
        subject: { state: 'loud', thresholds: { long: 45 } },
      },
    };
    expect(exceptionsOf(stored)).toEqual({
      subject: { state: null, thresholds: { long: 45, tooLong: null } },
    });
    // What applies: the default, as the editor reads it.
    expect(generalOf(stored).headings.state).toBe('on');
    expect(generalOf(stored).subject).toEqual({
      state: 'on',
      thresholds: { long: 45, tooLong: 60 },
    });
  });

  it('has none when nothing is stored', () => {
    expect(exceptionsOf(undefined)).toEqual({});
    expect(exceptionsOf({ checks: { headings: {} } })).toEqual({});
  });

  it('starts a new exception with nothing set', () => {
    expect(emptyException('subject')).toEqual({
      state: null,
      thresholds: { long: null, tooLong: null },
    });
    expect(isEmptyException(emptyException('subject'))).toBe(true);
  });
});

describe('what applies', () => {
  it('gives the recommended values of a check', () => {
    expect(recommendedOf('subject')).toEqual({
      state: 'on',
      thresholds: { long: 40, tooLong: 60 },
    });
    expect(recommendedOf('tracking-params').state).toBe('blocking');
  });

  it('lays the general settings over the recommended values', () => {
    const applied = generalOf(general);
    expect(applied.subject).toEqual({
      state: 'on',
      thresholds: { long: 40, tooLong: 80 },
    });
    expect(applied['merge-tags'].state).toBe('blocking');
    expect(applied.headings.state).toBe('on');
  });

  it('lays an exception over what it replaces', () => {
    const base = generalOf(general).subject;
    expect(
      effectiveOf(
        { state: 'blocking', thresholds: { long: '45', tooLong: null } },
        base
      )
    ).toEqual({ state: 'blocking', thresholds: { long: 45, tooLong: 80 } });
  });

  it("resolves a template's exception as the server does", () => {
    // The template's "too long" of 50 wins over a general "long" of 70.
    const base = generalOf({
      checks: { subject: { thresholds: { long: 70 } } },
    }).subject;
    const ex = { state: null, thresholds: { long: null, tooLong: '50' } };
    expect(effectiveOf(ex, base, 'subject')).toEqual({
      state: 'on',
      thresholds: { long: 50, tooLong: 50 },
    });
    expect(adjustmentsOf('subject', ex, base)).toEqual([
      { threshold: 'long', inherited: 70, value: 50 },
    ]);
    // In order, nothing moves.
    expect(adjustmentsOf('subject', ex, recommendedOf('subject'))).toEqual([]);
  });

  it('tells an exception that changes nothing', () => {
    const base = recommendedOf('subject');
    expect(
      matchesBase(
        { state: 'on', thresholds: { long: 40, tooLong: null } },
        base
      )
    ).toBe(true);
    expect(
      matchesBase(
        { state: null, thresholds: { long: 45, tooLong: null } },
        base
      )
    ).toBe(false);
  });

  it("names a template's values equal to the general ones", () => {
    // Kept on save (D3), but they will not follow the general settings.
    const base = generalOf(general)['merge-tags'];
    expect(
      valuesEqualToBase({ state: 'blocking', thresholds: {} }, base)
    ).toEqual(['state']);
    const subject = generalOf(general).subject;
    expect(
      valuesEqualToBase(
        { state: 'blocking', thresholds: { long: '40', tooLong: 70 } },
        subject
      )
    ).toEqual(['long']);
    expect(valuesEqualToBase(emptyException('subject'), subject)).toEqual([]);
  });

  it('tells an unsaved change, an empty field and null alike', () => {
    const saved = { state: 'off', thresholds: { long: 45, tooLong: null } };
    expect(
      sameException(saved, {
        state: 'off',
        thresholds: { long: '45', tooLong: '' },
      })
    ).toBe(true);
    expect(
      sameException(saved, {
        state: 'on',
        thresholds: { long: 45, tooLong: null },
      })
    ).toBe(false);
    expect(sameException(emptyException('subject'), null)).toBe(false);
  });

  it('counts the checks a level has an exception on', () => {
    expect(exceptionCount(general)).toBe(2);
    expect(exceptionCount(null)).toBe(0);
  });
});

describe('blocking', () => {
  // Only the most severe level of a blocking check blocks (ADR 0009): a
  // subject of 55 characters, over the info level only, still goes out.
  it('blocks a pair past its most severe level, as it applies', () => {
    expect(blocksFrom('subject', { long: 45, tooLong: 80 })).toEqual({
      name: 'tooLong',
      value: 80,
    });
    expect(blocksFrom('preheader', { long: 100, tooLong: 140 })).toEqual({
      name: 'tooLong',
      value: 140,
    });
    expect(
      blocksFrom('images-total-weight', { warningKb: 500, errorKb: 1024 })
    ).toEqual({ name: 'errorKb', value: 1024 });
  });

  it('says nothing more for a check without a pair', () => {
    expect(blocksFrom('html-size', { maxKb: 100 })).toBeNull();
    expect(blocksFrom('headings', {})).toBeNull();
  });
});

describe("a company's email metadata", () => {
  it('is used only when the company switched it on', () => {
    expect(usesEmailMetadata({ emailMetadata: { enabled: true } })).toBe(true);
    expect(usesEmailMetadata({ emailMetadata: { enabled: false } })).toBe(
      false
    );
    expect(usesEmailMetadata({})).toBe(false);
    expect(usesEmailMetadata(null)).toBe(false);
  });
});

describe('the server reading the images', () => {
  const off = { state: 'off', thresholds: {} };
  const allOff = Object.fromEntries(IMAGE_SERVER_CHECKS.map((id) => [id, off]));

  it('is asked by the checks that download the images, from the catalogue', () => {
    expect(IMAGE_SERVER_CHECKS).toEqual([
      'image-weight',
      'images-total-weight',
      'oversized-images',
    ]);
  });

  it('happens while one of them is on, as the settings will apply', () => {
    // General settings: the recommended values have them on.
    expect(serverReadsImages({}, generalOf(null))).toBe(true);
    expect(serverReadsImages(allOff, generalOf(null))).toBe(false);
    // One back on in the drafts, blocking.
    expect(
      serverReadsImages(
        {
          ...allOff,
          'oversized-images': { state: 'blocking', thresholds: {} },
        },
        generalOf(null)
      )
    ).toBe(true);
  });

  it('follows the general settings on a template, under its own', () => {
    const generalOff = generalOf({ checks: allOff });
    expect(serverReadsImages({}, generalOff)).toBe(false);
    expect(
      serverReadsImages(
        { 'image-weight': { state: 'on', thresholds: {} } },
        generalOff
      )
    ).toBe(true);
  });
});
