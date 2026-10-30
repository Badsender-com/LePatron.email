import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';

// The AI feature configuration of a group and its AI integrations: loaded
// together, saved one feature at a time. Shared by the translation section and
// the generic engine section, which each render a part of the same document.
//
// The host component must provide `groupId`.
export default {
  data() {
    return {
      loading: false,
      saving: false,
      config: null,
      integrations: [],
    };
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    showError() {
      this.showSnackbar({
        text: this.$t('global.errors.errorOccured'),
        color: 'error',
      });
    },

    async fetchData() {
      try {
        this.loading = true;
        const [configRes, integrationsRes] = await Promise.all([
          this.$axios.$get(apiRoutes.aiFeatures(this.groupId)),
          this.$axios.$get(apiRoutes.integrations(this.groupId, 'ai')),
        ]);
        this.config = configRes;
        this.integrations = integrationsRes.items || [];
      } catch (error) {
        // The section shows nothing to edit; the snackbar says why.
        this.showError();
      } finally {
        this.loading = false;
      }
    },

    async saveFeature(featureType, data) {
      try {
        this.saving = true;
        this.config = await this.$axios.$put(
          apiRoutes.aiFeaturesItem(this.groupId, featureType),
          data
        );
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
      } catch (error) {
        // Reload, so the switches and selects show what is actually saved.
        this.showError();
        await this.fetchData();
      } finally {
        this.saving = false;
      }
    },
  },
};
