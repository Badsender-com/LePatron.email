<script>
import { mapMutations } from 'vuex';
import { Plug, KeyRound } from 'lucide-vue';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsGroupRetexOption from '~/components/group/retex-option.vue';
import BsGroupConnectedApplicationsOption from '~/components/group/connected-applications-option.vue';

// MCP access (ADR 0012): the group's users connect their AI assistant to
// LePatron. Set by a super admin or the group's tech admin, saved on its own,
// with all that goes with it: the retex, the connected applications and the
// clients registered by hand.
export default {
  name: 'BsGroupMcpAccessOption',
  components: {
    BsFormSection,
    BsModalConfirm,
    BsGroupRetexOption,
    BsGroupConnectedApplicationsOption,
    LucidePlug: Plug,
    LucideKeyRound: KeyRound,
  },
  props: {
    group: { type: Object, required: true },
  },
  data() {
    // A new key redraws the switch from the group: a save refused or a
    // confirmation cancelled leaves it as saved.
    return { loading: false, switchKey: 0 };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    // Turning it off ends every assistant of the group at once: asked first.
    change(value) {
      if (value) return this.save(true);
      return this.$refs.offModal.open();
    },
    restore() {
      this.switchKey += 1;
    },
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
        this.restore();
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
      :key="switchKey"
      :input-value="group.enableMcp === true"
      :label="$t('mcpAccess.switch')"
      :loading="loading"
      :disabled="loading"
      color="accent"
      hide-details
      class="mt-0"
      @change="change"
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
    <bs-group-retex-option
      v-if="group.enableMcp === true"
      class="mt-6"
      :group="group"
      @update="$emit('update', $event)"
    />
    <bs-group-connected-applications-option class="mt-6" :group="group" />
    <bs-modal-confirm
      ref="offModal"
      :title="$t('mcpAccess.offTitle')"
      :action-label="$t('mcpAccess.off')"
      @confirm="save(false)"
      @cancel="restore"
    >
      <p>{{ $t('mcpAccess.offConfirm', { group: group.name }) }}</p>
    </bs-modal-confirm>
  </bs-form-section>
</template>
