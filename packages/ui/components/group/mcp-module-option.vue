<script>
import { Plug, ArrowRight } from 'lucide-vue';
import { groupConnectedApplications } from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsGroupSettingCard from '~/components/group/setting-card.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';

// The MCP module of a company (ADR 0017), a card of the company's Modules
// (the setting card and the feature switch of the cards beside it):
// sold apart from MCP access, which the company's tech admin then turns on in
// its AI features. Its switch is saved with the rest of the form. Closing a
// module that was open revokes the company's connections, so the save asks
// first, with the number of connections it ends.
//
// The form binds `@change` to the group's `enableMcpModule`, calls
// `requestSave()` on its save, and saves on `save`.
export default {
  name: 'BsGroupMcpModuleOption',
  components: {
    BsModalConfirm,
    BsGroupSettingCard,
    BsGroupFeatureSwitch,
    LucidePlug: Plug,
    LucideArrowRight: ArrowRight,
  },
  props: {
    group: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return {
      // The module as loaded: only closing an open one is asked.
      loaded: false,
      // The connections a closed module is about to end; Infinity, unknown.
      connections: 0,
    };
  },
  computed: {
    closeMessage() {
      const group = this.group.name;
      if (!Number.isFinite(this.connections)) {
        return this.$t('groups.modules.mcp.closeConfirmUnknown', { group });
      }
      return this.$tc('groups.modules.mcp.closeConfirm', this.connections, {
        count: this.connections,
        group,
      });
    },
  },
  watch: {
    // The page swaps the group for the saved one: what was saved is loaded.
    // The form edits the group in place, which leaves it as loaded.
    group: {
      immediate: true,
      handler(group, previous) {
        if (group !== previous) this.loaded = group?.enableMcpModule === true;
      },
    },
  },
  methods: {
    async requestSave() {
      const closing = this.loaded && this.group.enableMcpModule !== true;
      if (closing) {
        this.connections = await this.connectionsCount();
        if (this.connections > 0) return this.$refs.closeModal.open();
      }
      return this.$emit('save');
    },
    async connectionsCount() {
      try {
        const { count } = await this.$axios.$get(
          groupConnectedApplications({ groupId: this.group.id })
        );
        return count;
      } catch (error) {
        // Unknown: still asked, without a number.
        return Infinity;
      }
    },
    // Not closed after all: the switch goes back to the module as loaded.
    keep() {
      this.$emit('change', this.loaded);
    },
  },
};
</script>

<template>
  <div class="bs-group-mcp-module-option">
    <bs-group-setting-card>
      <template #icon><lucide-plug :size="28" /></template>
      <template #name>{{ $t('groups.modules.mcp.name') }}</template>
      <template #description>
        {{ $t('groups.modules.mcp.description') }}
      </template>
      <template v-if="group.enableMcpModule" #hint>
        <lucide-arrow-right :size="14" color="#9e9e9e" />
        {{ $t('groups.modules.mcp.configHint') }}
      </template>
      <template #control>
        <bs-group-feature-switch
          :value="group.enableMcpModule === true"
          :label="$t('groups.modules.mcp.name')"
          :on-text="$t('global.states.on')"
          :off-text="$t('global.states.off')"
          :disabled="disabled"
          @change="$emit('change', $event)"
        />
      </template>
    </bs-group-setting-card>

    <bs-modal-confirm
      ref="closeModal"
      :title="$t('groups.modules.mcp.closeTitle')"
      :action-label="$t('groups.modules.mcp.close')"
      @confirm="$emit('save')"
      @cancel="keep"
    >
      <p>{{ closeMessage }}</p>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
// The dialog follows the card, which so never reads as the last of the
// Modules: the wrapper says when it is.
.bs-group-mcp-module-option:last-child ::v-deep .bs-group-setting-card {
  margin-bottom: 0;
}
</style>
