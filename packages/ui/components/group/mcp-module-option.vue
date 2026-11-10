<script>
import { Plug, ArrowRight } from 'lucide-vue';
import { groupConnectedApplications } from '~/helpers/api-routes.js';
import BsModalConfirm from '~/components/modal-confirm.vue';

// The MCP module of a company (ADR 0017), a card of the company's Modules:
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
    <div class="bs-group-mcp-module-option__content">
      <div class="bs-group-mcp-module-option__icon">
        <lucide-plug :size="28" />
      </div>
      <div>
        <div class="bs-group-mcp-module-option__name">
          {{ $t('groups.modules.mcp.name') }}
        </div>
        <div class="bs-group-mcp-module-option__description">
          {{ $t('groups.modules.mcp.description') }}
        </div>
        <div
          v-if="group.enableMcpModule"
          class="bs-group-mcp-module-option__hint"
        >
          <lucide-arrow-right :size="14" />
          {{ $t('groups.modules.mcp.configHint') }}
        </div>
      </div>
    </div>
    <v-switch
      :input-value="group.enableMcpModule"
      :aria-label="$t('groups.modules.mcp.name')"
      hide-details
      :disabled="disabled"
      class="bs-group-mcp-module-option__switch"
      @change="$emit('change', $event)"
    />

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
// The card of a module, drawn with the theme's tokens (white-label).
.bs-group-mcp-module-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background-color: var(--surface);
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  transition: border-color 0.2s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: var(--accent-tint-resize-active);
  }

  &__content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  &__icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 8px;
    background-color: var(--accent-tint-selected-hover);
    color: var(--v-accent-base);
  }

  &__name {
    font-weight: 500;
    font-size: 1rem;
    color: var(--gray-900);
  }

  &__description {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--gray-700);
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--gray-600);
  }

  &__switch {
    flex-shrink: 0;
  }
}
</style>
