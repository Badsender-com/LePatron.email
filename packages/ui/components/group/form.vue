<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapGetters, mapMutations } from 'vuex';
import { groupsItem } from '~/helpers/api-routes.js';
import { CAN, USER } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { Status } from '~/helpers/constants/status';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsSelect from '~/components/form/bs-select';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsGroupMcpModuleOption from '~/components/group/mcp-module-option.vue';
import BsGroupSettingCard from '~/components/group/setting-card.vue';
import BsSaveOutcome from '~/components/layout/bs-save-outcome.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';
import { escapeHtml } from '~/helpers/escape-html';
import {
  Palette,
  LineChart,
  Link,
  ArrowRight,
  AlertTriangle,
  Building2,
  Boxes,
  ShieldCheck,
  Users,
  KeyRound,
} from 'lucide-vue';
import { CAPABILITIES } from '../../../shared/access/roles.js';

export default {
  name: 'BsGroupForm',
  components: {
    BsModalConfirmForm,
    BsModalConfirm,
    BsTextField,
    BsTextarea,
    BsSelect,
    BsFormSection,
    BsGroupMcpModuleOption,
    BsGroupSettingCard,
    BsSaveOutcome,
    BsGroupFeatureSwitch,
    LucidePalette: Palette,
    LucideLineChart: LineChart,
    LucideLink: Link,
    LucideArrowRight: ArrowRight,
    LucideAlertTriangle: AlertTriangle,
    LucideBuilding2: Building2,
    LucideBoxes: Boxes,
    LucideShieldCheck: ShieldCheck,
    LucideUsers: Users,
    LucideKeyRound: KeyRound,
  },
  mixins: [validationMixin],
  model: { prop: 'group', event: 'update' },
  props: {
    group: { type: Object, default: () => ({}) },
    isEdit: { type: Boolean, default: false },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    // The outcome of the last save, read at the foot of the form.
    outcome: { type: String, default: null },
    outcomeDetail: { type: String, default: '' },
  },
  data() {
    return {
      useSamlAuthentication: null,
      // The MCP module's card counts the connections a closing would end.
      checkingMcp: false,
      // Re-renders the preview links switch when turning it off is cancelled:
      // the switch keeps its own state, which the unchanged model cannot reset.
      shareLinksSwitchKey: 0,
    };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    // The company's name, status, modules, permissions, SAML, this form's save
    // and the deletion are the platform's: a company admin sees the name
    // read-only and the rest not at all.
    canManagePlatform() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE);
    },
    localModel: {
      get() {
        return this.group;
      },
      set(updatedGroup) {
        this.$emit('update', updatedGroup);
      },
    },
    isGroupCreationPage() {
      return this.$route.path === '/groups/new';
    },
    statusOptions() {
      return [
        {
          text: this.$t('forms.group.status.demo'),
          value: Status.DEMO,
        },
        {
          text: this.$t('forms.group.status.active'),
          value: Status.ACTIVE,
        },
        {
          text: this.$t('forms.group.status.inactive'),
          value: Status.INACTIVE,
        },
      ];
    },
  },
  watch: {
    useSamlAuthentication: {
      immediate: true,
      handler(newVal) {
        if (newVal === null) {
          // A real boolean: the empty string of an empty issuer would read as
          // "on" to a Boolean prop.
          this.useSamlAuthentication = Boolean(
            this.group &&
              ((this.group.issuer && this.group.issuer.length > 0) ||
                (this.group.entryPoint && this.group.entryPoint.length > 0))
          );
        }
      },
    },
  },
  validations() {
    return {
      group: {
        name: { required },
        status: { required },
        defaultWorkspaceName: {},
      },
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    escapeHtml,
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.group[fieldName]?.$dirty) return errors;
      if (!this.$v.group[fieldName]?.required) {
        errors.push(this.$t('global.errors.required'));
      }
      return errors;
    },
    async onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid || this.checkingMcp) return;
      // Closing an open MCP module revokes the company's connections
      // (ADR 0017): its card asks first, then lets the save go on (`save`).
      const mcpModule = this.$refs.mcpModule;
      if (!mcpModule) return this.save();
      this.checkingMcp = true;
      try {
        await mcpModule.requestSave();
      } finally {
        this.checkingMcp = false;
      }
    },
    save() {
      const currentGroup = this.group;
      if (!this.useSamlAuthentication) {
        currentGroup.entryPoint = '';
        currentGroup.issuer = '';
        currentGroup.idpCert = '';
      }
      this.$emit('submit', this.group);
    },
    // Turning preview links off asks first: the links already shared stop
    // opening for everyone, and the admin should know they come back with the
    // switch.
    onShareLinksChange(enabled) {
      if (enabled) {
        this.localModel = { ...this.localModel, enableShareLinks: true };
        return;
      }
      this.$refs.shareLinksOffDialog.open();
    },
    confirmShareLinksOff() {
      this.localModel = { ...this.localModel, enableShareLinks: false };
    },
    cancelShareLinksOff() {
      this.shareLinksSwitchKey += 1;
    },
    openDeleteGroup() {
      this.$refs.deleteDialog.open({
        name: this.group?.name,
        id: this.group?.id,
      });
    },
    async deleteGroup() {
      try {
        await this.$axios.delete(groupsItem({ groupId: this.group?.id }));
        this.showSnackbar({
          text: this.$t('groups.delete.successful'),
          color: 'success',
        });
        this.$router.push('/groups/');
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
  <div>
    <v-card flat tile tag="form">
      <v-card-text>
        <!-- ==================== SECTION 1: COMPANY INFORMATION ==================== -->
        <bs-form-section>
          <template #icon>
            <lucide-building2 :size="20" />
          </template>
          <template #title>
            {{ $t('forms.group.sections.companyInfo') }}
          </template>
          <template #description>
            {{ $t('forms.group.sections.companyInfoDescription') }}
          </template>
          <v-row>
            <v-col cols="12" md="6">
              <bs-text-field
                v-model="localModel.name"
                :label="$t('global.companyName')"
                required
                :disabled="disabled || !canManagePlatform"
                :error-messages="requiredErrors('name')"
                @blur="$v.group.name.$touch()"
              />
            </v-col>
            <v-col v-if="canManagePlatform" cols="12" md="6">
              <bs-select
                v-model="localModel.status"
                :label="$t('forms.group.status.label')"
                :items="statusOptions"
                required
                :error-messages="requiredErrors('status')"
                @blur="$v.group.status.$touch()"
              />
            </v-col>
          </v-row>
          <v-row v-if="isGroupCreationPage">
            <v-col cols="12" md="6">
              <bs-text-field
                v-model="localModel.defaultWorkspaceName"
                :label="$t('forms.group.defaultWorkspace.label')"
                :hint="$t('forms.group.defaultWorkspace.hint')"
                :disabled="disabled"
              />
            </v-col>
          </v-row>
        </bs-form-section>

        <!-- ==================== SECTION 2: MODULES ==================== -->
        <bs-form-section v-if="canManagePlatform">
          <template #icon>
            <lucide-boxes :size="20" />
          </template>
          <template #title>
            {{ $t('groups.modules.title') }}
          </template>
          <template #description>
            {{ $t('groups.modules.description') }}
          </template>

          <bs-group-setting-card>
            <template #icon><lucide-palette :size="28" /></template>
            <template #name>
              {{ $t('groups.modules.emailBuilder.name') }}
            </template>
            <template #description>
              {{ $t('groups.modules.emailBuilder.description') }}
            </template>
            <template #control>
              <bs-group-feature-switch
                v-model="localModel.enableEmailBuilder"
                :label="$t('groups.modules.emailBuilder.name')"
                :on-text="$t('global.states.on')"
                :off-text="$t('global.states.off')"
                :disabled="disabled"
              />
            </template>
          </bs-group-setting-card>

          <!-- Share Links Module (public preview links of the emails) -->
          <bs-group-setting-card>
            <template #icon><lucide-link :size="28" /></template>
            <template #name>
              {{ $t('groups.modules.shareLinks.name') }}
            </template>
            <template #description>
              {{ $t('groups.modules.shareLinks.description') }}
            </template>
            <template #control>
              <bs-group-feature-switch
                :key="shareLinksSwitchKey"
                :value="localModel.enableShareLinks !== false"
                :label="$t('groups.modules.shareLinks.name')"
                :on-text="$t('global.states.on')"
                :off-text="$t('global.states.off')"
                :disabled="disabled"
                @change="onShareLinksChange"
              />
            </template>
          </bs-group-setting-card>

          <bs-group-setting-card>
            <template #icon><lucide-line-chart :size="28" /></template>
            <template #name>
              {{ $t('groups.modules.crmIntelligence.name') }}
            </template>
            <template #description>
              {{ $t('groups.modules.crmIntelligence.description') }}
            </template>
            <template v-if="localModel.enableCrmIntelligence" #hint>
              <lucide-arrow-right :size="14" color="#9e9e9e" />
              {{ $t('groups.modules.crmIntelligence.configHint') }}
            </template>
            <template #control>
              <bs-group-feature-switch
                v-model="localModel.enableCrmIntelligence"
                :label="$t('groups.modules.crmIntelligence.name')"
                :on-text="$t('global.states.on')"
                :off-text="$t('global.states.off')"
                :disabled="disabled"
              />
            </template>
          </bs-group-setting-card>

          <bs-group-mcp-module-option
            ref="mcpModule"
            :group="group"
            :disabled="disabled"
            @change="$set(localModel, 'enableMcpModule', $event)"
            @save="save"
          />
        </bs-form-section>

        <!-- ==================== SECTION 3: SECURITY ====================
             Permissions, SAML and two-factor authentication read alike, as
             the modules do. The first two are saved with the form; the
             two-factor one saves on its own (the slot). -->
        <bs-form-section
          v-if="canManagePlatform || $slots['security-rows']"
          last
          class="group-form__security"
        >
          <template #icon>
            <lucide-shield-check :size="20" />
          </template>
          <template #title>
            {{ $t('forms.group.sections.security') }}
          </template>
          <template #description>
            {{ $t('forms.group.sections.securityDescription') }}
          </template>

          <bs-group-setting-card v-if="canManagePlatform">
            <template #icon><lucide-users :size="28" /></template>
            <template #name>
              {{ $t('forms.group.sections.permissions') }}
            </template>
            <template #description>
              {{ $t('forms.group.userHasAccessToAllWorkspaces') }}
            </template>
            <template #control>
              <bs-group-feature-switch
                v-model="localModel.userHasAccessToAllWorkspaces"
                :label="$t('forms.group.sections.permissions')"
                :on-text="$t('global.states.on')"
                :off-text="$t('global.states.off')"
                :disabled="disabled"
              />
            </template>
          </bs-group-setting-card>

          <bs-group-setting-card v-if="canManagePlatform">
            <template #icon><lucide-key-round :size="28" /></template>
            <template #name>{{ $t('forms.group.saml.name') }}</template>
            <template #description>
              {{ $t('forms.group.sections.authenticationDescription') }}
            </template>
            <template #control>
              <bs-group-feature-switch
                v-model="useSamlAuthentication"
                :label="$t('forms.group.enableSaml')"
                :on-text="$t('forms.group.saml.on')"
                :off-text="$t('forms.group.saml.off')"
                :disabled="disabled"
              />
            </template>
            <template v-if="useSamlAuthentication" #body>
              <div>
                <v-row>
                  <v-col cols="12" md="6">
                    <bs-text-field
                      v-model="localModel.entryPoint"
                      :label="$t('forms.group.entryPoint')"
                      :hint="$t('forms.group.entryPointHint')"
                      :disabled="disabled"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <bs-text-field
                      v-model="localModel.issuer"
                      :label="$t('forms.group.issuer')"
                      :hint="$t('forms.group.issuerHint')"
                      :disabled="disabled"
                    />
                  </v-col>
                  <!-- Required for SSO to be offered at all: without the identity
                     provider's certificate, no response signature can be
                     checked, so the login page falls back to the password. -->
                  <v-col cols="12">
                    <bs-textarea
                      v-model="localModel.idpCert"
                      :label="$t('forms.group.idpCert')"
                      :hint="$t('forms.group.idpCertHint')"
                      :disabled="disabled"
                      rows="6"
                      class="group-form__idp-cert"
                    />
                  </v-col>
                </v-row>
              </div>
            </template>
          </bs-group-setting-card>

          <slot name="security-rows" />
        </bs-form-section>
      </v-card-text>

      <template v-if="canManagePlatform">
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <bs-save-outcome
            :outcome="outcome"
            :detail="outcomeDetail"
            class="mr-4"
            @retry="onSubmit"
          />
          <v-btn
            elevation="0"
            color="accent"
            :loading="loading || checkingMcp"
            :disabled="disabled || loading || checkingMcp"
            @click="onSubmit"
          >
            {{ $t('global.save') }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>

    <!-- ==================== DANGER ZONE ==================== -->
    <v-card
      v-if="canManagePlatform && isEdit"
      flat
      tile
      class="danger-zone mt-6 mb-6"
    >
      <div class="danger-zone__content">
        <div class="danger-zone__header">
          <lucide-alert-triangle :size="20" color="#F04E23" />
          <h3 class="danger-zone__title">
            {{ $t('forms.group.dangerZone.title') }}
          </h3>
        </div>
        <p class="danger-zone__description">
          {{ $t('forms.group.dangerZone.description') }}
        </p>
        <v-btn
          outlined
          color="error"
          :disabled="loading"
          @click="openDeleteGroup"
        >
          {{ $t('forms.group.dangerZone.deleteCompany') }}
        </v-btn>
      </div>
    </v-card>

    <bs-modal-confirm
      ref="shareLinksOffDialog"
      :title="$t('groups.modules.shareLinks.confirmOffTitle')"
      :action-label="$t('groups.modules.shareLinks.confirmOffAction')"
      action-button-color="primary"
      @confirm="confirmShareLinksOff"
      @close="cancelShareLinksOff"
      @click-outside="cancelShareLinksOff"
    >
      <p class="black--text">
        {{ $t('groups.modules.shareLinks.confirmOffMessage') }}
      </p>
    </bs-modal-confirm>

    <bs-modal-confirm-form
      ref="deleteDialog"
      :title="$t('forms.group.dangerZone.deleteTitle')"
      :action-label="$t('global.delete')"
      :confirmation-input-label="$t('groups.delete.confirmationField')"
      :confirm-check-box="true"
      :confirm-check-box-message="$t('groups.delete.deleteNotice')"
      @confirm="deleteGroup"
    >
      <p
        class="black--text"
        v-html="
          $t('groups.delete.deleteWarningMessage', {
            name: escapeHtml(group.name),
          })
        "
      />
    </bs-modal-confirm-form>
  </div>
</template>

<style lang="scss" scoped>
// The last section of the card keeps a gap above the divider of the save bar
// (the layout zeroes the padding of `.v-card__text`, and `last` the margin).
.group-form__security.bs-form-section--last {
  margin-bottom: 1.5rem;
}

// A PEM certificate is read line by line: monospace keeps it recognisable.
.group-form__idp-cert ::v-deep textarea {
  font-family: monospace;
  font-size: 0.75rem;
}

.danger-zone {
  border: 1px solid rgba(240, 78, 35, 0.3);
  background-color: rgba(240, 78, 35, 0.02);

  &__content {
    padding: 24px;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__title {
    font-size: 1rem;
    font-weight: 500;
    color: #f04e23;
    margin: 0;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 1rem;
  }
}
</style>
