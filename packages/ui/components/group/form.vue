<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapGetters, mapMutations } from 'vuex';
import { groupsItem } from '~/helpers/api-routes.js';
import { IS_ADMIN, USER, IS_GROUP_ADMIN } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { Status } from '~/helpers/constants/status';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';
import { Palette, LineChart, ArrowRight, AlertTriangle } from 'lucide-vue';

export default {
  name: 'BsGroupForm',
  components: {
    BsModalConfirmForm,
    BsTextField,
    BsSelect,
    LucidePalette: Palette,
    LucideLineChart: LineChart,
    LucideArrowRight: ArrowRight,
    LucideAlertTriangle: AlertTriangle,
  },
  mixins: [validationMixin],
  model: { prop: 'group', event: 'update' },
  props: {
    group: { type: Object, default: () => ({}) },
    isEdit: { type: Boolean, default: false },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      useSamlAuthentication: null,
    };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
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
          this.useSamlAuthentication =
            this.group &&
            ((this.group.issuer && this.group.issuer.length > 0) ||
              (this.group.entryPoint && this.group.entryPoint.length > 0));
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
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.group[fieldName]?.$dirty) return errors;
      if (!this.$v.group[fieldName]?.required) {
        errors.push(this.$t('global.errors.required'));
      }
      return errors;
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      const currentGroup = this.group;
      if (!this.useSamlAuthentication) {
        currentGroup.entryPoint = '';
        currentGroup.issuer = '';
      }
      this.$emit('submit', this.group);
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
        <div class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.companyInfo') }}
          </h3>
          <p class="form-section__description">
            {{ $t('forms.group.sections.companyInfoDescription') }}
          </p>
          <v-row>
            <v-col cols="12" md="6">
              <bs-text-field
                v-model="localModel.name"
                :label="$t('global.companyName')"
                required
                :disabled="disabled || isGroupAdmin"
                :error-messages="requiredErrors('name')"
                @blur="$v.group.name.$touch()"
              />
            </v-col>
            <v-col v-if="isAdmin" cols="12" md="6">
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
        </div>

        <!-- ==================== SECTION 2: MODULES ==================== -->
        <div v-if="isAdmin" class="form-section">
          <h3 class="form-section__title">
            {{ $t('groups.modules.title') }}
          </h3>
          <p class="form-section__description">
            {{ $t('groups.modules.description') }}
          </p>

          <!-- Email Builder Module -->
          <div class="module-card">
            <div class="module-card__content">
              <div class="module-card__icon">
                <lucide-palette :size="28" color="#00acdc" />
              </div>
              <div class="module-card__info">
                <div class="module-card__name">
                  {{ $t('groups.modules.emailBuilder.name') }}
                </div>
                <div class="module-card__description">
                  {{ $t('groups.modules.emailBuilder.description') }}
                </div>
              </div>
            </div>
            <v-switch
              v-model="localModel.enableEmailBuilder"
              hide-details
              :disabled="disabled"
              class="module-card__switch"
            />
          </div>

          <!-- CRM Intelligence Module -->
          <div class="module-card">
            <div class="module-card__content">
              <div class="module-card__icon">
                <lucide-line-chart :size="28" color="#00acdc" />
              </div>
              <div class="module-card__info">
                <div class="module-card__name">
                  {{ $t('groups.modules.crmIntelligence.name') }}
                </div>
                <div class="module-card__description">
                  {{ $t('groups.modules.crmIntelligence.description') }}
                </div>
                <div v-if="localModel.enableCrmIntelligence" class="module-card__hint">
                  <lucide-arrow-right :size="14" color="#9e9e9e" />
                  {{ $t('groups.modules.crmIntelligence.configHint') }}
                </div>
              </div>
            </div>
            <v-switch
              v-model="localModel.enableCrmIntelligence"
              hide-details
              :disabled="disabled"
              class="module-card__switch"
            />
          </div>
        </div>

        <!-- ==================== SECTION 3: PERMISSIONS ==================== -->
        <div v-if="isAdmin" class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.permissions') }}
          </h3>
          <p class="form-section__description">
            {{ $t('forms.group.sections.permissionsDescription') }}
          </p>
          <v-switch
            v-model="localModel.userHasAccessToAllWorkspaces"
            :label="$t('forms.group.userHasAccessToAllWorkspaces')"
            hide-details
            :disabled="disabled"
          />
        </div>

        <!-- ==================== SECTION 4: SAML AUTHENTICATION ==================== -->
        <div v-if="isAdmin" class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.authentication') }}
          </h3>
          <p class="form-section__description">
            {{ $t('forms.group.sections.authenticationDescription') }}
          </p>

          <v-switch
            v-model="useSamlAuthentication"
            :label="$t('forms.group.enableSaml')"
            hide-details
            :disabled="disabled"
            class="mb-4"
          />

          <v-expand-transition>
            <div v-if="useSamlAuthentication">
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
              </v-row>
            </div>
          </v-expand-transition>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          elevation="0"
          color="accent"
          :loading="loading"
          :disabled="disabled || loading"
          @click="onSubmit"
        >
          {{ $t('global.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- ==================== DANGER ZONE ==================== -->
    <v-card v-if="isAdmin && isEdit" flat tile class="danger-zone mt-6 mb-6">
      <v-card-text class="pa-6">
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
      </v-card-text>
    </v-card>

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
            name: group.name,
          })
        "
      />
    </bs-modal-confirm-form>
  </div>
</template>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  &__title {
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    margin-bottom: 0.25rem;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 1rem;
  }
}

.module-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background-color: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  transition: border-color 0.2s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: rgba(0, 172, 220, 0.4);
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
    background-color: rgba(0, 172, 220, 0.1);
    border-radius: 8px;
    flex-shrink: 0;
  }

  &__info {
    display: flex;
    flex-direction: column;
  }

  &__name {
    font-weight: 500;
    font-size: 1rem;
    color: rgba(0, 0, 0, 0.87);
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-top: 0.25rem;
  }

  &__hint {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &__switch {
    flex-shrink: 0;
  }
}

.danger-zone {
  border: 1px solid rgba(240, 78, 35, 0.3);
  background-color: rgba(240, 78, 35, 0.02);

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
