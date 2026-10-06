/**
 * @jest-environment jsdom
 */

'use strict';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

const axios = require('axios');
const Vue = require('vue/dist/vue.common');
const {
  ShareLinkPanel,
} = require('../../../packages/editor/src/js/vue/components/quality-drawer/share-link-panel.js');

Vue.config.productionTip = false;
Vue.config.devtools = false;

const URL = '/api/mailings/m1/share-links';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(url = URL, active = true) {
  const vm = {
    t: (key, params = {}) =>
      Object.keys(params).reduce(
        (text, name) => text.replace(`__${name}__`, params[name]),
        key
      ),
    notifier: { error: jest.fn() },
    metadata: { url: { shareLinks: url } },
  };
  document.body.innerHTML = '<div id="root"></div>';
  const app = new Vue({
    render: (h) => h(ShareLinkPanel, { props: { vm, active } }),
  }).$mount('#root');
  await flush();
  return { vm, el: app.$el };
}

beforeEach(() => {
  jest.resetAllMocks();
  axios.get.mockResolvedValue({
    data: {
      items: [
        {
          id: 'l1',
          createdBy: 'Ana',
          canRevoke: true,
          createdAt: '2026-09-29T15:20:00Z',
          expiresAt: '2026-10-06T00:00:00Z',
          url: 'https://app.test/share/old',
        },
      ],
    },
  });
});

describe('ShareLinkPanel', () => {
  it('lists the active links, without any address', async () => {
    const { el } = await mount();
    expect(axios.get).toHaveBeenCalledWith(URL);
    expect(el.querySelectorAll('.qc-share__item')).toHaveLength(1);
    expect(el.textContent).toMatch(/Created .+ by Ana, until/);
    expect(
      el
        .querySelector('.qc-share__item button:last-of-type')
        .getAttribute('aria-label')
    ).toMatch(/^Turn off the link: Created /);
    expect(el.querySelector('.qc-share__created')).toBeNull();
  });

  it('creates a link for the chosen time and shows its address once', async () => {
    axios.post.mockResolvedValue({
      data: {
        id: 'l2',
        url: 'https://app.test/share/abc',
        expiresAt: '2026-09-30T00:00:00Z',
        createdBy: 'Ana',
        canRevoke: true,
      },
    });
    const { el } = await mount();

    const select = el.querySelector('select');
    select.value = '30';
    select.dispatchEvent(new Event('change'));
    el.querySelector('.qc-share__create button').click();
    await flush();

    expect(axios.post).toHaveBeenCalledWith(URL, { expiresInDays: 30 });
    expect(el.querySelector('.qc-share__created input').value).toBe(
      'https://app.test/share/abc'
    );
    expect(el.querySelectorAll('.qc-share__item')).toHaveLength(2);
  });

  // The server says which links the user may turn off (their own, unless they
  // administer the company): the others are listed, and can be copied, only.
  it('offers no "Turn off" on a link the user may not revoke', async () => {
    axios.get.mockResolvedValue({
      data: {
        items: [
          {
            id: 'l1',
            createdBy: 'Bob',
            canRevoke: false,
            createdAt: '2026-09-29T15:20:00Z',
            expiresAt: '2026-10-06T00:00:00Z',
            url: 'https://app.test/share/old',
          },
        ],
      },
    });
    const { el } = await mount();
    const labels = Array.from(
      el.querySelectorAll('.qc-share__item button')
    ).map((b) => b.getAttribute('aria-label'));
    expect(labels.some((l) => /^Turn off/.test(l))).toBe(false);
    expect(labels.some((l) => /^Copy the link/.test(l))).toBe(true);
  });

  it('turns a link off', async () => {
    axios.delete.mockResolvedValue({});
    const { el } = await mount();
    Array.from(el.querySelectorAll('.qc-share__item button'))
      .find((b) => /^Turn off/.test(b.getAttribute('aria-label')))
      .click();
    await flush();
    expect(axios.delete).toHaveBeenCalledWith(`${URL}/l1`);
    expect(el.querySelectorAll('.qc-share__item')).toHaveLength(0);
  });

  it('says why a link could not be created', async () => {
    axios.post.mockRejectedValue({
      response: { data: { message: 'SHARE_LINKS_LIMIT_REACHED' } },
    });
    const { vm, el } = await mount();
    el.querySelector('.qc-share__create button').click();
    await flush();
    expect(vm.notifier.error).toHaveBeenCalledWith(
      'This email already has 20 active links: turn one off first'
    );
  });

  it('copies an active link again', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { el } = await mount();
    const copy = Array.from(
      el.querySelectorAll('.qc-share__item button')
    ).find((b) => /^Copy the link/.test(b.getAttribute('aria-label')));
    copy.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith('https://app.test/share/old');
    expect(copy.textContent.trim()).toBe('Copied');
  });

  it('loads the list only once its tab is shown', async () => {
    await mount(URL, false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('sends one request however often "Turn off" is clicked', async () => {
    let done;
    axios.delete.mockReturnValue(
      new Promise((resolve) => {
        done = resolve;
      })
    );
    const { el } = await mount();
    const button = Array.from(
      el.querySelectorAll('.qc-share__item button')
    ).find((b) => /^Turn off/.test(b.getAttribute('aria-label')));
    button.click();
    button.click();
    expect(axios.delete).toHaveBeenCalledTimes(1);
    done({});
    await flush();
  });

  it('is not shown where the server offers no links', async () => {
    const { el } = await mount(null);
    expect(el.querySelector && el.querySelector('.qc-share')).toBeFalsy();
    expect(axios.get).not.toHaveBeenCalled();
  });
});
