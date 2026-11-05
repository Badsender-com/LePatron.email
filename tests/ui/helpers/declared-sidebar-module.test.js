import { declaredSidebarModule } from '~/helpers/declared-sidebar-module.js';

// A page whose path names no module declares the one it belongs to in its
// `meta` option. Nuxt 2 leaves `$route.meta` empty: the module is read from
// the components the route matched.

const page = (meta) => ({ options: { meta } });
const routeTo = (...components) => ({
  meta: {},
  matched: components.map((component) => ({
    components: { default: component },
  })),
});

describe('declaredSidebarModule', () => {
  it("reads the module a page declares, though the route's meta is empty", () => {
    const route = routeTo(page({ acl: 'x', sidebarModule: 'settings' }));

    expect(declaredSidebarModule(route)).toBe('settings');
  });

  it('reads it from a component given as plain options', () => {
    const route = routeTo({ meta: { sidebarModule: 'settings' } });

    expect(declaredSidebarModule(route)).toBe('settings');
  });

  it('takes the first one a nested route declares', () => {
    const route = routeTo(page({ acl: 'x' }), page({ sidebarModule: 'crm' }));

    expect(declaredSidebarModule(route)).toBe('crm');
  });

  it('answers nothing for a page that declares none, or no route', () => {
    expect(declaredSidebarModule(routeTo(page({ acl: 'x' }), page()))).toBe(
      undefined
    );
    expect(declaredSidebarModule(undefined)).toBe(undefined);
  });
});
