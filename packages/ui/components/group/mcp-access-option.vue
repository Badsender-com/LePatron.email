<script>
import { mapGetters, mapMutations } from 'vuex';
import { Plug, Copy, Check, ChevronRight } from 'lucide-vue';
import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';
import BsGroupRetexOption from '~/components/group/retex-option.vue';
import BsGroupConnectedApplicationsOption from '~/components/group/connected-applications-option.vue';

// MCP access (ADR 0012): the group's users connect their AI assistant to
// LePatron. Set by a super admin or the group's tech admin, saved on its own,
// with all that goes with it: the address to give the users, the connected
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
  props: {
    group: { type: Object, required: true },
  },
  data() {
    // A new key redraws the switch from the group: a save refused or a
    // confirmation cancelled leaves it as saved.
    return { loading: false, switchKey: 0, origin: '', copied: false };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    // Sold apart (ADR 0017): without the MCP module, MCP access cannot be
    // used, and the section says who may open it.
    hasModule() {
      return this.group.enableMcpModule === true;
    },
    enabled() {
      return this.hasModule && this.group.enableMcp === true;
    },
    canOpenModule() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE);
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
    async copyUrl() {
      try {
        await navigator.clipboard.writeText(this.mcpUrl);
        this.copied = true;
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <bs-form-section
    class="bs-group-mcp-access-option"
    :folded="hasModule && !enabled"
  >
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
        :value="enabled"
        :label="$t('mcpAccess.switch')"
        :on-text="$t('mcpAccess.on')"
        :off-text="
          hasModule ? $t('mcpAccess.off') : $t('mcpAccess.notIncluded')
        "
        :loading="loading"
        :disabled="loading || !hasModule"
        @change="change"
      />
    </template>

    <p v-if="!hasModule" class="bs-group-mcp-access-option__no-module">
      {{ $t('mcpAccess.noModule', { group: group.name }) }}
      <nuxt-link
        v-if="canOpenModule"
        :to="`/groups/${group.id}/settings/general`"
      >
        {{ $t('mcpAccess.openModule') }}
      </nuxt-link>
    </p>

    <template v-else-if="enabled">
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
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  &__address-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
  }

  &__address-field {
    display: flex;
    align-items: center;
    border: 1px solid rgba(0, 0, 0, 0.16);
    border-radius: 5px;
    background: #fff;
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
      color: rgba(0, 0, 0, 0.87);
    }

    .v-btn {
      border-left: 1px solid rgba(0, 0, 0, 0.16);
      border-radius: 0;
      height: 36px !important;
    }
  }

  &__no-module {
    margin: 0;
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
  }

  &__hint {
    margin: 0;
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
  }

  &__rows {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
  }
}
</style>
