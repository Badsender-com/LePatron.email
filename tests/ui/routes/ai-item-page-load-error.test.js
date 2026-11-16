/**
 * @jest-environment jsdom
 */
'use strict';

// The page of a skill or an expertise answers "not found" only when the
// item's own API says so. Any other failure of what it loads keeps its
// status and message, and is logged: a page hidden behind a 404 cannot be
// diagnosed. The pages' asyncData runs with the server simulated.

const { componentOf } = require('../../helpers/mount-sfc.js');
const routes = require('~/helpers/ai-skill-routes.js');
const skillsCopy = require('~/helpers/skills-copy.js');
const usedByFeature = require('~/helpers/used-by-feature.js');
const pageLoadError = require('~/helpers/page-load-error.js');

// What asyncData reads is the real thing; the rest of what the page imports
// plays no part in it, and stands as a function, which a mixin factory is.
const nothing = () => ({});
const REAL = {
  '~/helpers/ai-skill-routes.js': routes,
  '~/helpers/skills-copy.js': skillsCopy,
  '~/helpers/used-by-feature.js': usedByFeature,
  '~/helpers/page-load-error.js': pageLoadError,
};
const imports = new Proxy(REAL, {
  has: () => true,
  get: (real, name) => (name in real ? real[name] : nothing),
});

const httpError = (status, message) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { message } },
  });

let logged;
beforeEach(() => {
  logged = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
});

describe.each([
  [
    'skill',
    'packages/ui/routes/ai-skills/_skillId/index.vue',
    { skillId: 'generic.text' },
    '/ai-skills/generic.text',
    true,
    'Skill not found',
  ],
  [
    'expertise',
    'packages/ui/routes/ai-expertise/_expertiseId/index.vue',
    { expertiseId: 'brand.voice' },
    '/ai-expertise/brand.voice',
    // Its only other load, the copy state, never fails the page.
    false,
    'Expertise not found',
  ],
])(
  'loading the page of a %s',
  (kind, file, params, itemUrl, otherLoadFails, notFound) => {
    const { asyncData } = componentOf(file, imports);

    // The item's API answers `item`, every other load `other`.
    async function load({ item, other }) {
      const error = jest.fn();
      const $get = jest.fn(async (url) => {
        const answer = url.endsWith(itemUrl) ? item : other;
        if (answer instanceof Error) throw answer;
        return answer;
      });
      await asyncData({ $axios: { $get }, params, error });
      return error;
    }

    it('answers not found when the item does not exist', async () => {
      const error = await load({ item: httpError(404, 'gone'), other: {} });

      expect(error).toHaveBeenCalledWith({
        statusCode: 404,
        message: notFound,
      });
      expect(logged).not.toHaveBeenCalled();
    });

    it('keeps the status and the message of a failure of the item, and logs it', async () => {
      const failure = httpError(500, 'Cast to ObjectId failed');
      const error = await load({ item: failure, other: {} });

      expect(error).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Cast to ObjectId failed',
      });
      expect(logged).toHaveBeenCalledWith(expect.any(String), failure);
    });

    if (otherLoadFails) {
      it('keeps a 404 of another load as that load said it, logged', async () => {
        const error = await load({
          item: {},
          other: httpError(404, 'no route'),
        });

        expect(error).toHaveBeenCalledWith({
          statusCode: 404,
          message: 'no route',
        });
        expect(logged).toHaveBeenCalled();
      });
    }
  }
);
