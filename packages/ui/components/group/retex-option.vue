<script>
import { mapMutations } from 'vuex';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

// Retex (ADR 0012): whether a summary of an assistant session, sent with a
// feedback, may be kept for Badsender. Each user is still asked every time.
// Saved on its own, like the two-factor option.
export default {
  name: 'BsGroupRetexOption',
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return { loading: false };
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
  <section class="bs-group-retex-option">
    <h3 class="text-subtitle-1 font-weight-medium">
      {{ $t('retex.title') }}
    </h3>
    <p class="text-body-2 text--secondary">
      {{ $t('retex.description') }}
    </p>
    <v-switch
      :input-value="group.allowRetex === true"
      :label="$t('retex.switch')"
      :loading="loading"
      :disabled="loading"
      inset
      @change="save"
    />
  </section>
</template>
