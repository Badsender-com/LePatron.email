<template>
  <module-marketing-page :module-id="moduleId" />
</template>

<script>
import { ACL_USER } from '~/helpers/pages-acls';
import { SIDEBAR_MODULES } from '~/components/sidebar/sidebar-config';

const KNOWN_MODULE_IDS = SIDEBAR_MODULES.map((m) => m.id);

export default {
  name: 'ModuleUnavailablePage',
  components: {
    // Lazy-loaded: this page is only reached by users who lack a module
    // (rare), so we don't want the marketing screen + its lucide icon map
    // to weigh on every other route's bundle.
    ModuleMarketingPage: () =>
      import(
        /* webpackChunkName: "module-marketing-page" */
        '~/components/marketing/ModuleMarketingPage.vue'
      ),
  },
  meta: { acl: ACL_USER },
  // Reject unknown moduleId values so the marketing page can't be rendered
  // for arbitrary slugs (which would otherwise leak raw i18n keys and create
  // bogus indexable URLs).
  validate({ params }) {
    return KNOWN_MODULE_IDS.includes(params.moduleId);
  },
  head() {
    return {
      title: this.$t(`${this.moduleKey}.marketing.title`),
    };
  },
  computed: {
    moduleId() {
      return this.$route.params.moduleId;
    },
    moduleKey() {
      return this.moduleId.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    },
  },
};
</script>
