<script>
import { mapMutations } from 'vuex';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';

// Retex (ADR 0012): whether a summary of an assistant session, sent with a
// feedback, may be kept for Badsender. Each user is still asked every time.
// Saved on its own, like the two-factor option.
export default {
  name: 'BsGroupRetexOption',
  components: { BsSettingsRow },
  props: {
    group: { type: Object, required: true },
  },
  data() {
    // A new key redraws the switch from the group when a save is refused.
    return { loading: false, switchKey: 0 };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async save(value) {
      this.loading = true;
      try {
        const group = await this.$axios.$put(
          groupsItem({ groupId: this.group.id }),
          { allowRetex: Boolean(value) }
        );
        this.$emit('update', group);
        this.showSnackbar({ text: this.$t('retex.updated'), color: 'success' });
      } catch (error) {
        this.switchKey += 1;
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <bs-settings-row class="bs-group-retex-option" title-id="retex-option-title">
    <template #title>{{ $t('retex.title') }}</template>
    <template #description>{{ $t('retex.description') }}</template>
    <v-switch
      :key="switchKey"
      :input-value="group.allowRetex === true"
      aria-labelledby="retex-option-title"
      :loading="loading"
      :disabled="loading"
      color="accent"
      hide-details
      class="mt-0 pt-0"
      @change="save"
    />
  </bs-settings-row>
</template>
