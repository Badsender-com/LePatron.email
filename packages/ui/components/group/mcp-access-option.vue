<script>
import { Plug, KeyRound } from 'lucide-vue';

import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsGroupRetexOption from '~/components/group/retex-option.vue';
import BsGroupConnectedApplicationsOption from '~/components/group/connected-applications-option.vue';

// MCP access (ADR 0012): the company's users connect their AI assistant to
// LePatron. Set by a super admin or the company's tech admin, saved on its
// own, with all that goes with it: the retex, the connected applications and
// the clients registered by hand.
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
  mixins: [
    mixinGroupSwitch({ field: 'enableMcp', updatedKey: 'mcpAccess.updated' }),
  ],
  data() {
    // A new key redraws the switch from `switchValue`: a confirmation
    // cancelled leaves it as saved.
    return { switchKey: 0 };
  },
  methods: {
    // Turning it off ends every assistant of the company at once: asked first.
    change(value) {
      if (value) return this.save(true);
      return this.$refs.offModal.open();
    },
    restore() {
      this.switchKey += 1;
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
      :input-value="switchValue"
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
