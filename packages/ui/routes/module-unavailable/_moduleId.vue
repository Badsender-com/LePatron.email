<template>
  <module-marketing-page :module-id="moduleId" />
</template>

<script>
import ModuleMarketingPage from '~/components/marketing/ModuleMarketingPage.vue';

export default {
  name: 'ModuleUnavailablePage',
  components: {
    ModuleMarketingPage,
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
