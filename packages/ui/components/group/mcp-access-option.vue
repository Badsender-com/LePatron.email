<script>
import { Plug, Copy, Check, ChevronRight } from 'lucide-vue';
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import copyToClipboard from '~/helpers/copy-to-clipboard.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';
import BsGroupRetexOption from '~/components/group/retex-option.vue';
import BsGroupConnectedApplicationsOption from '~/components/group/connected-applications-option.vue';

// MCP access (ADR 0012): the company's users connect their AI assistant to
// LePatron. Set by a super admin or the company's tech admin, saved on its
// own, with all that goes with it: the address to give the users, the connected
// applications, the retex and the clients registered by hand.
export default {
  name: 'BsGroupMcpAccessOption',
  components: {
    BsFormSection,
    BsModalConfirm,
    BsSettingsRow,
    BsGroupFeatureSwitch,
    BsGroupRetexOption,
    BsGroupConnectedApplicationsOption,
    LucidePlug: Plug,
    LucideCopy: Copy,
    LucideCheck: Check,
    LucideChevronRight: ChevronRight,
  },
  mixins: [
    mixinGroupSwitch({ field: 'enableMcp', updatedKey: 'mcpAccess.updated' }),
  ],
  data() {
    // A new key redraws the switch from `switchValue`: a confirmation
    // cancelled leaves it as saved.
    return { switchKey: 0, origin: '', copied: false };
  },
  computed: {
    enabled() {
      return this.group.enableMcp === true;
    },
    mcpUrl() {
      return this.origin && `${this.origin}/mcp`;
    },
  },
  mounted() {
    this.origin = window.location.origin;
  },
  beforeDestroy() {
    clearTimeout(this.copiedTimer);
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
    // On a browser that cannot copy, the address stays in its field to select.
    async copyUrl() {
      if (!(await copyToClipboard(this.mcpUrl))) {
        this.showSnackbar({
          text: this.$t('mcpClients.copyFailed'),
          color: 'error',
        });
        return;
      }
      this.copied = true;
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copied = false;
      }, 2000);
    },
  },
};
</script>

<template>
  <bs-form-section class="bs-group-mcp-access-option" :folded="!enabled">
    <template #icon>
      <lucide-plug :size="20" />
    </template>
    <template #title>
      {{ $t('mcpAccess.title') }}
    </template>
    <template #description>
      {{ $t('mcpAccess.description') }}
    </template>
    <template #header-actions>
      <bs-group-feature-switch
        :key="switchKey"
        :value="switchValue"
        :label="$t('mcpAccess.switch')"
        :on-text="$t('mcpAccess.on')"
        :off-text="$t('mcpAccess.off')"
        :loading="loading"
        :disabled="loading"
        @change="change"
      />
    </template>

    <template v-if="enabled">
      <div class="bs-group-mcp-access-option__address">
        <label
          for="mcp-address"
          class="bs-group-mcp-access-option__address-label"
        >
          {{ $t('mcpAccess.address') }}
        </label>
        <div class="bs-group-mcp-access-option__address-field">
          <input
            id="mcp-address"
            :value="mcpUrl"
            readonly
            @focus="$event.target.select()"
          />
          <v-btn
            text
            class="text-none"
            :color="copied ? 'success' : undefined"
            :aria-label="$t('mcpAccess.copyAddress')"
            @click="copyUrl"
          >
            <lucide-check v-if="copied" :size="16" class="mr-2" />
            <lucide-copy v-else :size="16" class="mr-2" />
            {{ copied ? $t('mcpClients.copied') : $t('mcpClients.copy') }}
          </v-btn>
        </div>
        <p class="bs-group-mcp-access-option__hint">
          {{ $t('mcpAccess.addressHint') }}
        </p>
      </div>

      <ul class="bs-group-mcp-access-option__rows">
        <bs-group-connected-applications-option :group="group" />
        <bs-group-retex-option
          :group="group"
          @update="$emit('update', $event)"
        />
        <bs-settings-row>
          <template #title>{{ $t('mcpAccess.clientsTitle') }}</template>
          <template #description>
            {{ $t('mcpAccess.clientsDescription') }}
          </template>
          <v-btn
            text
            color="accent"
            class="text-none"
            :to="`/groups/${group.id}/settings/mcp-clients`"
          >
            {{ $t('mcpAccess.manageClients') }}
            <lucide-chevron-right :size="16" class="ml-1" />
          </v-btn>
        </bs-settings-row>
      </ul>
    </template>

    <bs-modal-confirm
      ref="offModal"
      :title="$t('mcpAccess.offTitle')"
      :action-label="$t('mcpAccess.turnOff')"
      @confirm="save(false)"
      @cancel="restore"
    >
      <p>{{ $t('mcpAccess.offConfirm', { group: group.name }) }}</p>
    </bs-modal-confirm>
  </bs-form-section>
</template>

<style lang="scss" scoped>
.bs-group-mcp-access-option {
  &__address {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-radius: 7px;
    background: var(--surface-muted);
    border: 1px solid var(--gray-200);
  }

  &__address-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--gray-900);
  }

  &__address-field {
    display: flex;
    align-items: center;
    border: 1px solid var(--field-border);
    border-radius: 5px;
    background: var(--surface);
    overflow: hidden;

    input {
      flex: 1;
      min-width: 0;
      height: 36px;
      padding: 0 0.75rem;
      border: none;
      outline: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8125rem;
      color: var(--gray-900);
    }

    .v-btn {
      border-left: 1px solid var(--field-border);
      border-radius: 0;
      height: 36px !important;
    }
  }

  &__hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__rows {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
  }
}
</style>
