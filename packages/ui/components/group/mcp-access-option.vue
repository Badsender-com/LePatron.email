<script>
import { Plug, KeyRound } from 'lucide-vue';

import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';

// MCP access (ADR 0012): the company's users connect their AI assistant to
// LePatron. Set by a super admin or the company's tech admin, saved on its
// own.
export default {
  name: 'BsGroupMcpAccessOption',
  components: {
    BsFormSection,
    LucidePlug: Plug,
    LucideKeyRound: KeyRound,
  },
  mixins: [
    mixinGroupSwitch({ field: 'enableMcp', updatedKey: 'mcpAccess.updated' }),
  ],
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
      :input-value="switchValue"
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
