const Vue = require('vue/dist/vue.common');
const { SimpleSelect } = require('../select/simpleSelect');
const {
  listShareLinks,
  createShareLink,
  revokeShareLink,
  copyText,
} = require('./share-link-api');

const EXPIRY_OPTIONS = [1, 7, 30];
// As many as the server allows (share-link.service.js).
const MAX_ACTIVE_LINKS = 20;

// "Share a preview", under the send form of the drawer: a link anyone can
// open without an account, to the last saved version of the email. The active
// links are listed, to copy again or to turn off. A link the server cannot
// show again (no encryption key configured) is shown once, when created.
const ShareLinkPanel = Vue.component('ShareLinkPanel', {
  components: { SimpleSelect },
  props: {
    vm: { type: Object, required: true },
    // The tab is shown: the list is loaded then, and again at each visit, so
    // that links that expired meanwhile are gone.
    active: { type: Boolean, default: false },
  },
  data: () => ({
    expiry: null,
    links: [],
    created: null,
    // The link whose address was just copied: its button says so.
    copiedId: null,
    busy: false,
    // Links being turned off: a second click must not send a second request.
    revoking: [],
  }),
  computed: {
    url() {
      const urls = (this.vm.metadata && this.vm.metadata.url) || {};
      return urls.shareLinks || null;
    },
    expiryOptions() {
      return EXPIRY_OPTIONS.map((days) => ({
        code: days,
        label: days === 1 ? this.t('1 day') : this.t('__count__ days', { count: days }),
      }));
    },
    days() {
      return this.expiry ? this.expiry.code : 7;
    },
  },
  watch: {
    active: {
      immediate: true,
      handler(isActive) {
        if (isActive && this.url) this.refresh();
      },
    },
  },
  created() {
    this.expiry = this.expiryOptions.find((option) => option.code === 7);
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    // In the language of the page the editor runs in.
    formatDate(value, withTime = false) {
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      if (withTime) Object.assign(options, { hour: '2-digit', minute: '2-digit' });
      return new Date(value).toLocaleString(document.documentElement.lang || undefined, options);
    },
    // Two links of the same day must read differently: when each was made.
    describe(link) {
      const params = {
        name: link.createdBy,
        created: this.formatDate(link.createdAt, true),
        date: this.formatDate(link.expiresAt),
      };
      return link.createdBy
        ? this.t('Created __created__ by __name__, until __date__', params)
        : this.t('Created __created__, until __date__', params);
    },
    refresh() {
      return listShareLinks(this.url)
        .then((links) => {
          this.links = links;
        })
        .catch((error) => console.error('Loading the preview links failed', error));
    },
    create() {
      if (this.busy) return;
      this.busy = true;
      createShareLink(this.url, this.days)
        .then((link) => {
          this.created = link;
          this.copiedId = null;
          this.links = [{ ...link, url: link.copyable ? link.url : null }].concat(
            this.links
          );
          this.$nextTick(() => this.$refs.createdUrl && this.$refs.createdUrl.focus());
        })
        .catch((error) => {
          const code = error.response && error.response.data && error.response.data.message;
          this.vm.notifier.error(
            code === 'SHARE_LINKS_LIMIT_REACHED'
              ? this.t('This email already has __count__ active links: turn one off first', {
                  count: MAX_ACTIVE_LINKS,
                })
              : this.t('The link could not be created')
          );
        })
        .finally(() => {
          this.busy = false;
        });
    },
    copy(link, field) {
      copyText(link.url, field).then((ok) => {
        this.copiedId = ok ? link.id : null;
        if (!ok) this.vm.notifier.error(this.t('Copy failed: select the link and copy it'));
      });
    },
    revoke(link) {
      if (this.revoking.includes(link.id)) return;
      this.revoking.push(link.id);
      revokeShareLink(this.url, link.id)
        .then(() => {
          this.links = this.links.filter((l) => l.id !== link.id);
          if (this.created && this.created.id === link.id) this.created = null;
        })
        .catch(() => this.vm.notifier.error(this.t('The link could not be turned off')))
        .finally(() => {
          this.revoking = this.revoking.filter((id) => id !== link.id);
        });
    },
  },
  template: `
    <section v-if="url" class="qc-share" aria-labelledby="qc-share-title">
      <h3 id="qc-share-title" class="qc-share__title">{{ t('Share a preview') }}</h3>
      <p class="qc-field__help">{{ t('Anyone with the link sees the last saved version of the email, without an account.') }}</p>

      <div class="qc-share__create">
        <div class="qc-field qc-share__expiry">
          <span class="qc-field__label">{{ t('Valid for') }}</span>
          <SimpleSelect v-model="expiry" :options="expiryOptions" />
        </div>
        <button type="button" class="qc-button qc-button--outline qc-share__button" :disabled="busy" @click="create">
          <span class="lucide lucide-link" aria-hidden="true"></span>{{ t('Create a link') }}
        </button>
      </div>

      <div v-if="created" class="qc-share__created" role="status">
        <div class="qc-share__url">
          <input
            ref="createdUrl"
            class="qc-field__input"
            type="text"
            readonly
            :value="created.url"
            :aria-label="t('Preview link')"
            @focus="$event.target.select()"
          >
          <button type="button" class="qc-button qc-button--cta qc-share__button" @click="copy(created, $refs.createdUrl)">
            <span :class="['lucide', copiedId === created.id ? 'lucide-check' : 'lucide-copy']" aria-hidden="true"></span>{{ copiedId === created.id ? t('Copied') : t('Copy link') }}
          </button>
        </div>
        <p v-if="!created.copyable" class="qc-field__help">{{ t('Copy it now: it will not be shown again.') }}</p>
      </div>

      <ul v-if="links.length" class="qc-share__list" :aria-label="t('Active links')">
        <li v-for="link in links" :key="link.id" class="qc-share__item">
          <span class="qc-share__meta">{{ describe(link) }}</span>
          <button
            v-if="link.url"
            type="button"
            class="qc-link-button"
            :aria-label="t('Copy the link: __link__', { link: describe(link) })"
            @click="copy(link, $refs['url-' + link.id][0])"
          >{{ copiedId === link.id ? t('Copied') : t('Copy link') }}</button>
          <input
            v-if="link.url"
            :ref="'url-' + link.id"
            class="qc-sr-only"
            type="text"
            readonly
            tabindex="-1"
            aria-hidden="true"
            :value="link.url"
          >
          <button
            type="button"
            class="qc-link-button"
            :disabled="revoking.includes(link.id)"
            :aria-label="t('Turn off the link: __link__', { link: describe(link) })"
            @click="revoke(link)"
          >{{ t('Turn off') }}</button>
        </li>
      </ul>
    </section>
  `,
});

module.exports = { ShareLinkPanel };
