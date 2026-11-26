'use strict';

// Acceptance tests of what the editor publishes to a template for an email (epic
// #1351, ADR-0015).
//
// Each active dimension is published under its name, the property a template
// reads (`_root_.audience`), valued by the identifier of the chosen value. The
// design tokens of the chosen values are published under their own names, and
// when two of them carry the same token the dimension with the highest
// precedence wins; between equal precedences, the one listed later (ADR-0032).

const AUDIENCE = {
  name: 'audience',
  precedence: 0,
  isActive: true,
  values: [
    { id: '64a0000000000000000000a1', canonicalType: 'vip' },
    // No identifier: published under its id, never as nothing.
    { id: '64a0000000000000000000a2' },
  ],
};

const BRAND = {
  name: 'brand',
  precedence: 10,
  isActive: true,
  values: [
    {
      id: '64a0000000000000000000b1',
      canonicalType: 'brand-a',
      tokens: { mainColorVar: '#ffd845', textColorVar: '#1a1a1a' },
    },
    {
      id: '64a0000000000000000000b2',
      canonicalType: 'brand-b',
      tokens: { mainColorVar: '#0050ff', audience: '#ff0000' },
    },
  ],
};

const EMAIL_TYPE = {
  name: 'emailType',
  precedence: 40,
  isActive: true,
  values: [
    {
      id: '64a0000000000000000000c1',
      canonicalType: 'promotional',
      tokens: { mainColorVar: '#e60000' },
    },
  ],
};

// Turned on by #1357 (the chosen values reach the template)
describe('publishing dimensions to the template', () => {
  let governanceValues;

  beforeAll(() => {
    // Required here, not at the top of the file: the module doesn't exist until
    // #1357 ships it.
    ({
      governanceValues,
    } = require('../../packages/editor/src/js/utils/governance-values.js'));
  });

  it('publishes each dimension under its name, valued by the chosen identifier', () => {
    const { values } = governanceValues({
      dimensions: [AUDIENCE, BRAND],
      selections: {
        audience: '64a0000000000000000000a1',
        brand: '64a0000000000000000000b2',
      },
    });

    expect(values).toMatchObject({ audience: 'vip', brand: 'brand-b' });
  });

  // The content keeps what it holds, a template option set before the
  // dimension existed included (`country=be` in an old email): nothing decided
  // it away.
  it('publishes nothing for a dimension the email never had a value for', () => {
    const { values } = governanceValues({
      dimensions: [AUDIENCE],
      selections: { audience: '' },
    });

    expect(values).not.toHaveProperty('audience');
  });

  it('publishes an empty string for a dimension the writer emptied', () => {
    const { values } = governanceValues({
      dimensions: [AUDIENCE],
      selections: { audience: '' },
      valued: ['audience'],
    });

    expect(values.audience).toBe('');
  });

  it('publishes the id of a value that has no identifier', () => {
    const { values } = governanceValues({
      dimensions: [AUDIENCE],
      selections: { audience: '64a0000000000000000000a2' },
    });

    expect(values.audience).toBe('64a0000000000000000000a2');
  });

  // A template may render a root property as HTML: only letters, digits, `-`
  // and `_` reach it as they are.
  it.each([['<b>vip</b>'], ['vip clients'], ['"vip"'], ['clients-fidèles']])(
    'publishes the id of a value whose identifier is %p',
    (canonicalType) => {
      const { values } = governanceValues({
        dimensions: [
          {
            ...AUDIENCE,
            values: [{ id: '64a0000000000000000000a3', canonicalType }],
          },
        ],
        selections: { audience: '64a0000000000000000000a3' },
      });

      expect(values.audience).toBe('64a0000000000000000000a3');
    }
  );

  it('publishes an identifier of letters, digits, hyphens and underscores as is', () => {
    const { values } = governanceValues({
      dimensions: [
        {
          ...AUDIENCE,
          values: [
            { id: '64a0000000000000000000a3', canonicalType: 'Vip_2-b' },
          ],
        },
      ],
      selections: { audience: '64a0000000000000000000a3' },
    });

    expect(values.audience).toBe('Vip_2-b');
  });

  it('does not publish a deactivated dimension', () => {
    const { values } = governanceValues({
      dimensions: [{ ...AUDIENCE, isActive: false }],
      selections: { audience: '64a0000000000000000000a1' },
    });

    expect(values).not.toHaveProperty('audience');
  });

  // The email type is a standard dimension the section holds apart from the
  // company dimensions: its types and its chosen one come as their own fields.
  describe('the email type', () => {
    const PROMOTIONAL = {
      id: '64a0000000000000000000c1',
      canonicalType: 'promotional',
    };

    it('is published under its name, valued by the chosen identifier', () => {
      const { values } = governanceValues({
        dimensions: [AUDIENCE],
        selections: { audience: '64a0000000000000000000a1' },
        emailTypes: [PROMOTIONAL],
        emailTypeId: PROMOTIONAL.id,
      });

      expect(values).toMatchObject({
        emailType: 'promotional',
        audience: 'vip',
      });
    });

    it('is not published when the editor was sent no email type list', () => {
      const { values } = governanceValues({
        dimensions: [AUDIENCE],
        selections: { audience: '64a0000000000000000000a1' },
        emailTypeId: PROMOTIONAL.id,
      });

      expect(values).not.toHaveProperty('emailType');
    });
  });

  it('publishes nothing for an email type the email never had', () => {
    const { values } = governanceValues({
      dimensions: [],
      selections: {},
      emailTypes: [{ id: '64a0000000000000000000c1' }],
      emailTypeId: '',
    });

    expect(values).not.toHaveProperty('emailType');
  });

  it('publishes the trigger under its name', () => {
    expect(
      governanceValues({ dimensions: [], selections: {}, trigger: 'automated' })
        .values.trigger
    ).toBe('automated');
  });

  it('publishes nothing for a trigger the email never had', () => {
    expect(
      governanceValues({ dimensions: [], selections: {}, trigger: '' }).values
    ).not.toHaveProperty('trigger');
  });

  it('publishes an empty trigger once the writer emptied it', () => {
    expect(
      governanceValues({
        dimensions: [],
        selections: {},
        trigger: '',
        valued: ['trigger'],
      }).values.trigger
    ).toBe('');
  });
});

// The dimensions an email has had a value for, when it opened or since: only
// those are published empty once emptied.
describe('the dimensions an email has had a value for', () => {
  const {
    rememberValued,
  } = require('../../packages/editor/src/js/utils/governance-values.js');

  it('are those it opens with a value for, the email type and trigger included', () => {
    expect(
      rememberValued([], {
        selections: { audience: '64a0000000000000000000a1', brand: '' },
        emailTypeId: '64a0000000000000000000c1',
        trigger: 'adhoc',
      }).sort()
    ).toEqual(['audience', 'emailType', 'trigger']);
  });

  it('leave out an email type or a trigger the email does not have', () => {
    expect(
      rememberValued([], { selections: {}, emailTypeId: '', trigger: '' })
    ).toEqual([]);
  });

  it('keep a dimension the writer empties', () => {
    expect(
      rememberValued(['audience'], { selections: { audience: '' } })
    ).toEqual(['audience']);
  });

  it('grow with a dimension the writer gives a value to', () => {
    expect(
      rememberValued(['audience'], {
        selections: { audience: '', brand: '64a0000000000000000000b1' },
      })
    ).toEqual(['audience', 'brand']);
  });

  it('stay the same list when nothing is new, so nothing recomputes', () => {
    const valued = ['audience'];

    expect(
      rememberValued(valued, {
        selections: { audience: '64a0000000000000000000a1' },
      })
    ).toBe(valued);
  });
});

// Turned on by #1359 (design tokens and precedence)
describe('publishing design tokens', () => {
  let governanceValues;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1357.
    ({
      governanceValues,
    } = require('../../packages/editor/src/js/utils/governance-values.js'));
  });

  it('publishes the tokens of the chosen values under their names', () => {
    const { values } = governanceValues({
      dimensions: [BRAND],
      selections: { brand: '64a0000000000000000000b1' },
    });

    expect(values).toMatchObject({
      mainColorVar: '#ffd845',
      textColorVar: '#1a1a1a',
    });
  });

  it('lets the dimension with the highest precedence win a token both carry', () => {
    const { values, sources } = governanceValues({
      dimensions: [BRAND, EMAIL_TYPE],
      selections: {
        brand: '64a0000000000000000000b1',
        emailType: '64a0000000000000000000c1',
      },
    });

    expect(values.mainColorVar).toBe('#e60000');
    expect(values.textColorVar).toBe('#1a1a1a');
    expect(sources.mainColorVar).toEqual({
      dimension: 'emailType',
      overrode: ['brand'],
    });
  });

  it('lets the brand win once it has the higher precedence', () => {
    const { values } = governanceValues({
      dimensions: [{ ...BRAND, precedence: 50 }, EMAIL_TYPE],
      selections: {
        brand: '64a0000000000000000000b1',
        emailType: '64a0000000000000000000c1',
      },
    });

    expect(values.mainColorVar).toBe('#ffd845');
  });

  it('breaks a tie of precedence: the dimension listed later wins', () => {
    const { values } = governanceValues({
      dimensions: [
        { ...EMAIL_TYPE, precedence: 10 },
        { ...BRAND, precedence: 10 },
      ],
      selections: {
        brand: '64a0000000000000000000b1',
        emailType: '64a0000000000000000000c1',
      },
    });

    expect(values.mainColorVar).toBe('#ffd845');
  });

  it("never lets a token shadow a dimension's name", () => {
    const { values } = governanceValues({
      dimensions: [AUDIENCE, BRAND],
      selections: {
        audience: '64a0000000000000000000a1',
        brand: '64a0000000000000000000b2',
      },
    });

    expect(values.audience).toBe('vip');
  });

  it('never lets a token write over a piece of the content the editor builds', () => {
    const { values } = governanceValues({
      dimensions: [
        {
          ...BRAND,
          values: [
            {
              id: '64a0000000000000000000b3',
              canonicalType: 'brand-c',
              tokens: { type: 'versafix-1', mainColorVar: '#123456' },
            },
          ],
        },
      ],
      selections: { brand: '64a0000000000000000000b3' },
    });

    expect(values).not.toHaveProperty('type');
    expect(values.mainColorVar).toBe('#123456');
  });

  // Reserved for the email's language, which the template receives under
  // `locale` (ADR-0023): a token never shadows it (ADR-0015).
  it('never publishes a token named `locale`', () => {
    const { values, sources } = governanceValues({
      dimensions: [
        {
          ...BRAND,
          values: [
            {
              id: '64a0000000000000000000b3',
              canonicalType: 'brand-c',
              tokens: { locale: 'xx', mainColorVar: '#123456' },
            },
          ],
        },
      ],
      selections: { brand: '64a0000000000000000000b3' },
    });

    expect(values).not.toHaveProperty('locale');
    expect(sources).not.toHaveProperty('locale');
    expect(values.mainColorVar).toBe('#123456');
  });

  it('gives the email type the precedence the server sent', () => {
    const { values } = governanceValues({
      dimensions: [BRAND],
      selections: { brand: '64a0000000000000000000b1' },
      emailTypes: EMAIL_TYPE.values,
      emailTypeId: '64a0000000000000000000c1',
      emailTypePrecedence: 40,
    });

    expect(values.mainColorVar).toBe('#e60000');
  });

  // Stored before the server checked a token's format: the template keeps its
  // own value rather than receive markup or CSS (ADR-0015).
  it.each([
    ['a block of CSS', 'red} body{display:none'],
    ['the end of a style', '</style><script>x()</script>'],
    ['a script link', 'javascript:alert(1)'],
    ['an import', '@import "https://example.com/x.css"'],
    ['a CSS url', 'url(https://example.com/x.png)'],
    ['a script link split by a tab', 'java\tscript:alert(1)'],
    ['a script link split by a newline', 'java\nscript:alert(1)'],
    ['a CSS comment', 'a/*b'],
  ])('never publishes a token holding %s', (kind, token) => {
    const { values, sources } = governanceValues({
      dimensions: [
        {
          ...BRAND,
          values: [
            {
              id: '64a0000000000000000000b3',
              canonicalType: 'brand-c',
              tokens: { mainColorVar: token, textColorVar: '#1a1a1a' },
            },
          ],
        },
      ],
      selections: { brand: '64a0000000000000000000b3' },
    });

    expect(values).not.toHaveProperty('mainColorVar');
    expect(sources).not.toHaveProperty('mainColorVar');
    expect(values.textColorVar).toBe('#1a1a1a');
  });

  it('keeps the valid token of a lower precedence over an unsafe one', () => {
    const { values } = governanceValues({
      dimensions: [
        { ...EMAIL_TYPE, precedence: 10 },
        {
          ...BRAND,
          precedence: 50,
          values: [
            {
              id: '64a0000000000000000000b3',
              canonicalType: 'brand-c',
              tokens: { mainColorVar: 'red} body{display:none' },
            },
          ],
        },
      ],
      selections: {
        brand: '64a0000000000000000000b3',
        emailType: '64a0000000000000000000c1',
      },
    });

    expect(values.mainColorVar).toBe('#e60000');
  });

  // The taxonomy screen breaks a tie by the declared order, the email type
  // placed by its own: the editor receives that place from the server.
  it.each([
    [0, 'brand', '#ffd845'],
    [1, 'emailType', '#e60000'],
  ])(
    'breaks a tie with the email type at the place the server sent (%p)',
    (emailTypePosition, winner, colour) => {
      const { values, sources } = governanceValues({
        dimensions: [{ ...BRAND, precedence: 40 }],
        selections: { brand: '64a0000000000000000000b1' },
        emailTypes: EMAIL_TYPE.values,
        emailTypeId: '64a0000000000000000000c1',
        emailTypePrecedence: 40,
        emailTypePosition,
      });

      expect(values.mainColorVar).toBe(colour);
      expect(sources.mainColorVar.dimension).toBe(winner);
    }
  );

  it('places the email type first when the server sent no place', () => {
    const { values } = governanceValues({
      dimensions: [{ ...BRAND, precedence: 40 }],
      selections: { brand: '64a0000000000000000000b1' },
      emailTypes: EMAIL_TYPE.values,
      emailTypeId: '64a0000000000000000000c1',
      emailTypePrecedence: 40,
    });

    expect(values.mainColorVar).toBe('#ffd845');
  });

  it('publishes no token for a dimension the email has no value for', () => {
    const { values } = governanceValues({
      dimensions: [BRAND],
      selections: {},
    });

    expect(values).not.toHaveProperty('mainColorVar');
  });
});
