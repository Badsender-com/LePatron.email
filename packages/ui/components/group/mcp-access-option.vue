<script>
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';

// MCP access (ADR 0012): the company's users connect their AI assistant to
// LePatron. Set by a super admin or the company's tech admin, saved on its
// own.
export default {
  name: 'BsGroupMcpAccessOption',
  mixins: [
    mixinGroupSwitch({ field: 'enableMcp', updatedKey: 'mcpAccess.updated' }),
  ],
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
      :input-value="switchValue"
      :label="$t('mcpAccess.switch')"
      :loading="loading"
      :disabled="loading"
      color="accent"
      hide-details
      class="mt-0"
      @change="save"
    />
  </section>
</template>
