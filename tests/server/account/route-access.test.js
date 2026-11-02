'use strict';

// A right that is not granted is refused (ADR 0004). Every route that writes
// declares the capability it needs, read off the real express stack: a route
// added without one fails here, rather than opening itself to every role
// that can sign in. The few routes open to any signed-in user, or to anyone,
// are listed below with the reason they are.

jest.mock('sharp', () => jest.fn());
jest.mock('puppeteer', () => ({}));

const fs = require('fs');
const path = require('path');

const { CAPABILITIES: C } = require('../../../packages/shared/access/roles.js');

const SERVER = path.join(__dirname, '../../../packages/server');
const load = (file) => require(path.join(SERVER, file));

const { mailingCommentsRouter, commentsRouter } = load(
  'comment/comment.routes.js'
);
const { skillsRouter, expertiseRouter, invocationsRouter } = load(
  'ai-skill/ai-skill.routes'
);

// As index.js mounts them.
const ROUTERS = {
  '/api/folders': load('folder/folder.routes'),
  '/api/profiles': load('profile/profile.routes'),
  '/api/workspaces': load('workspace/workspace.routes'),
  '/api/personalized-blocks': load(
    'personalized-blocks/personalized-block-routes.js'
  ),
  '/api/groups': load('group/group.routes'),
  '/api/mailings/:mailingId/comments': mailingCommentsRouter,
  '/api/mailings': load('mailing/mailing.routes'),
  '/api/templates': load('template/template.routes'),
  '/api/users/me/selected-group': load('account/selected-group.routes'),
  '/api/users': load('user/user.routes'),
  '/api/images': load('image/image.routes'),
  '/api/emails-groups': load('emails-group/emails-group.routes'),
  '/api/integrations': load('integration/integration.routes.js'),
  '/api/feed-mappings': load('feed-mapping/feed-mapping.routes.js'),
  '/api/taxonomy-items': load('taxonomy/taxonomy.routes.js'),
  '/api/ai-features': load('ai-feature/ai-feature.routes'),
  '/api/ai-skills': skillsRouter,
  '/api/ai-expertise': expertiseRouter,
  '/api/ai-invocations': invocationsRouter,
  '/api/ai-playground': load('ai-playground/ai-playground.routes'),
  '/api/translation': load('translation/translation.routes'),
  '/api/account': load('account/account.routes'),
  '/api/version': load('version/version.routes'),
  '/api/comments': commentsRouter,
  '/api/crm-intelligence': load('crm-intelligence/crm-intelligence.routes.js'),
  '/api/dashboards': load('dashboard/dashboard.routes.js'),
};

// Open to anyone, or to any signed-in user, on purpose.
const EXEMPTIONS = {
  'POST /api/account/login': 'signing in',
  'DELETE /api/account/:email/password': 'asking for a password reset',
  'PUT /api/account/:email/password/:token':
    'setting a password from the emailed link',
  'PUT /api/users/me/storage/:key': "the user's own interface preferences",
  'PUT /api/users/me/selected-group/':
    "a super admin's own selected group, refused to anyone else by its controller",
};

// The routes the roles below the company admin reach, and what each needs:
// the server's half of the rights matrix (tests/shared/access/roles.test.js).
const ROLE_ROUTES = {
  'POST /api/mailings': C.MAILING_CREATE,
  'PATCH /api/mailings/:mailingId': C.MAILING_ORGANIZE,
  'DELETE /api/mailings/:mailingId': C.MAILING_DELETE,
  'POST /api/mailings/copy': C.MAILING_ORGANIZE,
  'POST /api/mailings/:mailingId/move': C.MAILING_ORGANIZE,
  'POST /api/mailings/move-many': C.MAILING_ORGANIZE,
  'POST /api/mailings/:mailingId/duplicate': C.MAILING_ORGANIZE,
  'POST /api/mailings/:mailingId/duplicate-translate': C.MAILING_ORGANIZE,
  'PUT /api/mailings': C.MAILING_ORGANIZE,
  'PATCH /api/mailings/:mailingId/metadata': C.MAILING_EDIT_CONTENT,
  'PUT /api/mailings/:mailingId/mosaico': C.MAILING_EDIT_CONTENT,
  'POST /api/mailings/:mailingId/mosaico/send-test-mail': C.MAILING_SEND_TEST,
  'POST /api/mailings/:mailingId/mosaico/download-zip': C.MAILING_EXPORT,
  'POST /api/mailings/download-multiple-zip': C.MAILING_EXPORT,
  'POST /api/profiles/:mailingId/send-campaign-mail': C.MAILING_EXPORT,
  'POST /api/folders': C.FOLDER_MANAGE,
  'PATCH /api/folders/:folderId': C.FOLDER_MANAGE,
  'POST /api/folders/:folderId/move': C.FOLDER_MANAGE,
  'DELETE /api/folders/:folderId': C.FOLDER_DELETE,
  'POST /api/mailings/:mailingId/comments': C.MAILING_COMMENT,
  'PATCH /api/comments/:commentId': C.MAILING_COMMENT,
  'DELETE /api/comments/:commentId': C.MAILING_COMMENT,
  'PATCH /api/comments/:commentId/resolve': C.MAILING_COMMENT,
  'PATCH /api/comments/:commentId/unresolve': C.MAILING_COMMENT,
  'POST /api/translation/text': C.MAILING_EDIT_CONTENT,
  'POST /api/translation/block': C.MAILING_EDIT_CONTENT,
  'POST /api/translation/jobs/:jobId/cancel': C.MAILING_EDIT_CONTENT,
  'POST /api/images/gallery/:mongoId': C.GALLERY_MANAGE,
  'POST /api/images/gallery/:mongoId/from-url': C.GALLERY_MANAGE,
  'PATCH /api/images/gallery/:mongoId/:imageName/label': C.GALLERY_MANAGE,
  'DELETE /api/images/:imageName': C.GALLERY_MANAGE,
  'POST /api/personalized-blocks/': C.BLOCK_LIBRARY_ADD,
};

const WRITES = ['post', 'put', 'patch', 'delete'];

/**
 * Every route that writes, with the capabilities its guards require: the
 * route's own guards, and those a router mounts before it for its path
 * (`router.use`, `router.all('*')`).
 */
function writeRoutes() {
  const routes = [];
  Object.entries(ROUTERS).forEach(([mount, router]) => {
    router.stack.forEach((layer, index) => {
      if (!layer.route) return;
      const methods = Object.keys(layer.route.methods).filter((method) =>
        WRITES.includes(method)
      );
      if (!methods.length) return;

      const inherited = router.stack
        .slice(0, index)
        .filter(
          (before) =>
            (!before.route || before.route.methods._all) &&
            before.match(layer.route.path)
        )
        .flatMap((before) =>
          before.route
            ? before.route.stack.map((h) => h.handle)
            : [before.handle]
        );
      const own = layer.route.stack.map((h) => h.handle).slice(0, -1);
      const capabilities = [...inherited, ...own].flatMap(
        (guard) => guard.access?.capabilities || []
      );

      methods.forEach((method) =>
        routes.push({
          key: `${method.toUpperCase()} ${mount}${layer.route.path}`,
          capabilities,
        })
      );
    });
  });
  return routes;
}

const ROUTES = writeRoutes();

describe('every route that writes', () => {
  it('finds the routes', () => {
    expect(ROUTES.length).toBeGreaterThan(100);
  });

  it('needs a capability, or is exempted with a reason', () => {
    const open = ROUTES.filter(
      ({ key, capabilities }) => !capabilities.length && !EXEMPTIONS[key]
    ).map(({ key }) => key);

    expect(open).toEqual([]);
  });

  it('keeps no exemption that has become useless', () => {
    const stale = Object.keys(EXEMPTIONS).filter((key) => {
      const route = ROUTES.find((candidate) => candidate.key === key);
      return !route || route.capabilities.length > 0;
    });

    expect(stale).toEqual([]);
  });

  it.each(Object.entries(ROLE_ROUTES))('%s needs %s', (key, capability) => {
    const route = ROUTES.find((candidate) => candidate.key === key);

    expect(route).toBeDefined();
    expect(route.capabilities).toContain(capability);
  });

  it('are all mounted here, as index.js mounts them', () => {
    const index = fs.readFileSync(path.join(SERVER, 'index.js'), 'utf8');
    const mounted = [...index.matchAll(/app\.use\(\s*'(\/api\/[^']+)'/g)].map(
      (match) => match[1]
    );

    // Static files and their cache headers, no route that writes.
    const notRouters = ['/api/documentation'];

    expect(
      mounted.filter((mount) => !notRouters.includes(mount)).sort()
    ).toEqual(Object.keys(ROUTERS).sort());
  });
});
