import { CANONICAL_TYPES } from '~/helpers/taxonomy.js';
import { EMAIL_TYPES } from '~/helpers/email-types.js';
import en from '~/helpers/locales/en.js';
import fr from '~/helpers/locales/fr.js';

const {
  EmailTypeCanonicalValues,
} = require('../../../packages/server/constant/email-type-canonical.js');

/**
 * The canonical email-type vocabulary lives in two places that must agree: the
 * server constant and the UI list. Each file says "keep in sync" in a comment, and
 * a comment has never kept anything in sync — nothing would fail if one were
 * missed.
 *
 * It used to live in THREE: the taxonomy screens carried their own copy. They now
 * re-export the skills' list, which is why the assertion below reads as a tautology
 * — it is the guard that keeps it one, should someone paste the literal back.
 *
 * Nothing constrains the STORED value on purpose (the schema takes any string, the
 * skills fall back to the raw one), so a divergence never raises an error. It just
 * means a company can map its typology onto a value the skills selector does not
 * offer, or one that renders as `taxonomy.canonicalTypes.marketing-automation` to
 * the user.
 * That is what these tests catch.
 */
describe('canonical email type vocabulary', () => {
  it('is the same list on the server and on the taxonomy screens', () => {
    expect([...CANONICAL_TYPES].sort()).toEqual(
      [...EmailTypeCanonicalValues].sort()
    );
  });

  it('is the same list for the taxonomy and for the AI skills', () => {
    expect([...CANONICAL_TYPES].sort()).toEqual([...EMAIL_TYPES].sort());
  });

  // Pinned rather than derived: an accidental deletion would keep every other
  // assertion here green, since they all compare the lists to each other.
  //
  // These are the six types of the Badsender classification doctrine, and the list
  // is closed by design: a seventh type only exists if it changes a rule. What a
  // company calls them is its own business — that is what the taxonomy is for.
  it('holds the six types the doctrine defines', () => {
    expect([...CANONICAL_TYPES].sort()).toEqual([
      'editorial',
      'institutional',
      'notification',
      'promotional',
      'service',
      'transactional',
    ]);
  });

  // The values that used to be here and must not come back. `newsletter` was a
  // free tag, not a type; `marketing-automation` was a trigger, which is now its
  // own independent dimension. Both are the kind of thing a well-meaning revert
  // reintroduces.
  it.each(['newsletter', 'promo', 'marketing-automation'])(
    'no longer carries %s',
    (retired) => {
      expect(CANONICAL_TYPES).not.toContain(retired);
    }
  );

  describe.each([
    ['en', en],
    ['fr', fr],
  ])('labels in %s', (lang, locale) => {
    it.each(CANONICAL_TYPES)('names %s on the taxonomy screens', (type) => {
      const label = locale.taxonomy.canonicalTypes[type];
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it.each(CANONICAL_TYPES)('names %s on the AI skills screens', (type) => {
      const label = locale.aiSkills.emailTypes[type];
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });
});
