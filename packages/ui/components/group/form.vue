<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapGetters, mapMutations } from 'vuex';
import { groupsItem } from '~/helpers/api-routes.js';
import { IS_ADMIN, USER, IS_GROUP_ADMIN } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { Status } from '~/helpers/constants/status';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import BsColorScheme from '~/components/group/color-scheme';
import BsFtpSettings from '~/components/group/ftp-settings';

export default {
  name: 'BsGroupForm',
  components: {
    BsModalConfirmForm,
    BsColorScheme,
    BsFtpSettings,
  },
  mixins: [validationMixin],
  model: { prop: 'group', event: 'update' },
  props: {
    group: { type: Object, default: () => ({}) },
    isEdit: { type: Boolean, default: false },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  httpOptions: ['http://', 'https://'],
  data() {
    return {
      useSamlAuthentication: null,
      colorScheme: [
        '#F44336',
        '#E91E63',
        '#9C27B0',
        '#673AB7',
        '#3F51B5',
        '#2196F3',
        '#03A9F4',
        '#00BCD4',
        '#009688',
        '#4CAF50',
        '#8BC34A',
        '#CDDC39',
        '#FFEB3B',
        '#FFC107',
        '#FF9800',
        '#FF5722',
        '#795548',
        '#9E9E9E',
        '#607D8B',
      ],
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
    folderOptions() {
      return [
        {
          text: this.$t('forms.group.downloadWithoutEnclosingFolder.wrapped'),
          value: false,
        },
        {
          text: this.$t('forms.group.downloadWithoutEnclosingFolder.unwrapped'),
          value: true,
        },
      ];
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
    const cdnValidations = {
      cdnEndPoint: { required },
      cdnButtonLabel: { required },
    };
    return {
      group: {
        name: { required },
        status: { required },
        defaultWorkspaceName: {},
        ...(this.group.downloadMailingWithCdnImages && cdnValidations),
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
      // Validate FTP settings component if FTP is enabled
      let ftpValid = true;
      if (this.group.downloadMailingWithFtpImages && this.$refs.ftpSettings) {
        ftpValid = this.$refs.ftpSettings.validate();
      }
      if (this.$v.$invalid || !ftpValid) return;
      const currentGroup = this.group;
      if (!this.useSamlAuthentication) {
        currentGroup.entryPoint = '';
        currentGroup.issuer = '';
      }
      this.$emit('submit', this.group);
    },
    closeDelete() {
      this.dialogDelete = false;
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
      this.closeDelete();
    },
  },
};
</script>

<template>
  <div>
    <v-card flat tile tag="form">
      <v-card-text>
        <!-- ==================== SECTION 1: GENERAL INFORMATION ==================== -->
        <div class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.generalInfo') }}
          </h3>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field
                id="name"
                v-model="localModel.name"
                :label="$t('forms.group.name')"
                name="name"
                required
                :disabled="disabled || isGroupAdmin"
                :error-messages="requiredErrors(`name`)"
                @input="$v.group.name.$touch()"
                @blur="$v.group.name.$touch()"
              />
            </v-col>
            <v-col v-if="isAdmin" cols="12" md="4">
              <v-select
                id="groupStatus"
                v-model="localModel.status"
                :error-messages="requiredErrors('status')"
                :label="$t('forms.group.status.label')"
                name="status"
                required
                :items="statusOptions"
                @input="$v.group.status.$touch()"
                @blur="$v.group.status.$touch()"
              />
            </v-col>
            <v-col v-if="isAdmin" cols="12" md="4">
              <v-select
                id="downloadMailingWithoutEnclosingFolder"
                v-model="localModel.downloadMailingWithoutEnclosingFolder"
                :label="$t('forms.group.downloadWithoutEnclosingFolder.label')"
                name="downloadMailingWithoutEnclosingFolder"
                :disabled="disabled"
                :items="folderOptions"
              />
            </v-col>
          </v-row>
          <v-row v-if="isGroupCreationPage">
            <v-col cols="12" md="4">
              <v-text-field
                id="defaultWorkspaceName"
                v-model="localModel.defaultWorkspaceName"
                :label="$t('forms.group.defaultWorkspace.label')"
                name="defaultWorkspaceName"
                :disabled="disabled"
                @input="$v.group.defaultWorkspaceName.$touch()"
                @blur="$v.group.defaultWorkspaceName.$touch()"
              />
            </v-col>
          </v-row>
          <v-row v-if="isGroupAdmin || isAdmin">
            <v-col cols="12" md="4">
              <label class="v-label theme--light">{{ $t('forms.group.color.label') }}</label>
              <bs-color-scheme v-model="localModel.colorScheme" />
            </v-col>
          </v-row>
        </div>
        <!-- ==================== SECTION 2: IMAGE HOSTING ==================== -->
        <div v-if="isAdmin" class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.imageHosting') }}
          </h3>

          <!-- FTP/SFTP Subsection -->
          <div class="form-subsection">
            <div class="form-subsection__header">
              <span class="form-subsection__label">{{ $t('forms.group.exportFtp') }}</span>
              <v-switch
                v-model="localModel.downloadMailingWithFtpImages"
                :label="$t('forms.group.enable')"
                class="ma-0 ml-4"
                hide-details
                :disabled="disabled"
              />
            </div>

            <div v-if="localModel.downloadMailingWithFtpImages" class="form-subsection__content">
              <bs-ftp-settings
                ref="ftpSettings"
                v-model="localModel"
                :group-id="group.id"
                :disabled="disabled"
                :is-edit="isEdit"
              />
            </div>
          </div>

          <!-- CDN Subsection -->
          <div class="form-subsection">
            <div class="form-subsection__header">
              <span class="form-subsection__label">{{ $t('forms.group.exportCdn') }}</span>
              <v-switch
                v-model="localModel.downloadMailingWithCdnImages"
                :label="$t('forms.group.enable')"
                class="ma-0 ml-4"
                hide-details
                :disabled="disabled"
              />
            </div>

            <div v-if="localModel.downloadMailingWithCdnImages" class="form-subsection__content">
              <v-row>
                <v-col cols="12" md="2">
                  <v-select
                    id="cdnProtocol"
                    v-model="localModel.cdnProtocol"
                    :label="$t('forms.group.httpProtocol')"
                    name="cdnProtocol"
                    :disabled="disabled"
                    :items="$options.httpOptions"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    id="cdnEndPoint"
                    v-model="localModel.cdnEndPoint"
                    :label="$t('forms.group.endpoint')"
                    placeholder="ex: cdn.example.com"
                    name="cdnEndPoint"
                    :error-messages="requiredErrors(`cdnEndPoint`)"
                    :disabled="disabled"
                    @input="$v.group.cdnEndPoint.$touch()"
                    @blur="$v.group.cdnEndPoint.$touch()"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    id="cdnButtonLabel"
                    v-model="localModel.cdnButtonLabel"
                    :label="$t('forms.group.editorLabel')"
                    placeholder="ex: Amazon S3"
                    name="cdnButtonLabel"
                    :error-messages="requiredErrors(`cdnButtonLabel`)"
                    :disabled="disabled"
                    @input="$v.group.cdnButtonLabel.$touch()"
                    @blur="$v.group.cdnButtonLabel.$touch()"
                  />
                </v-col>
              </v-row>
            </div>
          </div>
        </div>

        <!-- ==================== SECTION 3: SAML AUTHENTICATION ==================== -->
        <div v-if="isAdmin" class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.authentication') }}
          </h3>

          <div class="form-subsection">
            <div class="form-subsection__header">
              <span class="form-subsection__label">{{ $t('forms.group.samlAuthentication') }}</span>
              <v-switch
                v-model="useSamlAuthentication"
                :label="$t('forms.group.enable')"
                class="ma-0 ml-4"
                hide-details
                :disabled="disabled"
              />
            </div>

            <div v-if="useSamlAuthentication" class="form-subsection__content">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    id="entryPoint"
                    v-model="localModel.entryPoint"
                    :label="$t('forms.group.entryPoint')"
                    name="entryPoint"
                    :disabled="disabled"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    id="issuer"
                    v-model="localModel.issuer"
                    :label="$t('forms.group.issuer')"
                    name="issuer"
                    :disabled="disabled"
                  />
                </v-col>
              </v-row>
            </div>
          </div>
        </div>

        <!-- ==================== SECTION 4: PERMISSIONS ==================== -->
        <div v-if="isAdmin" class="form-section">
          <h3 class="form-section__title">
            {{ $t('forms.group.sections.permissions') }}
          </h3>
          <v-checkbox
            v-model="localModel.userHasAccessToAllWorkspaces"
            :label="$t('forms.group.userHasAccessToAllWorkspaces')"
            class="mt-0"
          />
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          elevation="0"
          color="accent"
          :disabled="disabled"
          @click="onSubmit"
        >
          {{ $t('global.save') }}
        </v-btn>
        <v-btn
          v-if="isAdmin && isEdit"
          depressed
          outlined
          color="error"
          @click="openDeleteGroup"
        >
          {{ $t('global.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <bs-modal-confirm-form
      ref="deleteDialog"
      :title="`${$t('global.delete')} ?`"
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
    margin-bottom: 1rem;
  }
}

.form-subsection {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);

  &:last-child {
    margin-bottom: 0;
  }

  &__header {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  &__label {
    font-weight: 500;
    color: rgba(0, 0, 0, 0.7);
  }

  &__content {
    padding-top: 0.5rem;
  }
}
</style>
