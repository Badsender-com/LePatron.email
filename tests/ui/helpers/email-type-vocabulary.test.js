import { CANONICAL_TYPES } from '~/helpers/taxonomy.js';
import { EMAIL_TYPES } from '~/helpers/email-types.js';
import en from '~/helpers/locales/en.js';
import fr from '~/helpers/locales/fr.js';

const {
  EmailTypeCanonicalValues,
} = require('../../../packages/server/constant/email-type-canonical.js');

/**
 * The canonical email-type vocabulary lives in three places that must agree:
 * the server constant, the taxonomy screens' list, and the AI skills' list. Each
 * file says "keep in sync" in a comment, and a comment has never kept anything in
 * sync — adding `marketing-automation` meant editing five files, and nothing would
 * have failed had one been missed.
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
  it('holds the four types the product defines', () => {
    expect([...CANONICAL_TYPES].sort()).toEqual([
      'marketing-automation',
      'newsletter',
      'promo',
      'transactional',
    ]);
  });

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
