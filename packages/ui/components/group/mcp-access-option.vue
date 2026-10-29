<script>
import { mapMutations } from 'vuex';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

// MCP access (ADR 0012): the group's users connect their AI assistant to
// LePatron. Set by a super admin or the group's tech admin, saved on its own.
export default {
  name: 'BsGroupMcpAccessOption',
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
          { enableMcp: Boolean(value) }
        );
        this.$emit('update', group);
        this.showSnackbar({
          text: this.$t('mcpAccess.updated'),
          color: 'success',
        });
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
  <section class="bs-group-mcp-access-option">
    <h3 class="text-subtitle-1 font-weight-medium">
      {{ $t('mcpAccess.title') }}
    </h3>
    <p class="text-body-2 text--secondary">
      {{ $t('mcpAccess.description') }}
    </p>
    <v-switch
      :input-value="group.enableMcp === true"
      :label="$t('mcpAccess.switch')"
      :loading="loading"
      :disabled="loading"
      inset
      @change="save"
    />
  </section>
</template>
