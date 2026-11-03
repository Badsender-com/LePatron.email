<script>
import { mapMutations } from 'vuex';
import { Plug, KeyRound } from 'lucide-vue';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';

// MCP access (ADR 0012): the group's users connect their AI assistant to
// LePatron. Set by a super admin or the group's tech admin, saved on its own.
export default {
  name: 'BsGroupMcpAccessOption',
  components: {
    BsFormSection,
    LucidePlug: Plug,
    LucideKeyRound: KeyRound,
  },
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
  <bs-form-section class="bs-group-mcp-access-option">
    <template #icon>
      <lucide-plug :size="20" />
    </template>
    <template #title>
      {{ $t('mcpAccess.title') }}
    </template>
    <template #description>
      {{ $t('mcpAccess.description') }}
    </template>
    <v-switch
      :input-value="group.enableMcp === true"
      :label="$t('mcpAccess.switch')"
      :loading="loading"
      :disabled="loading"
      color="accent"
      hide-details
      class="mt-0"
      @change="save"
    />
    <v-btn
      v-if="group.enableMcp === true"
      text
      small
      color="accent"
      class="mt-4 px-0"
      :to="`/groups/${group.id}/settings/mcp-clients`"
    >
      <lucide-key-round :size="16" class="mr-2" />
      {{ $t('mcpAccess.manageClients') }}
    </v-btn>
  </bs-form-section>
</template>
