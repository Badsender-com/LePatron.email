<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapGetters, mapMutations } from 'vuex';
import { groupsItem, groupTestFtpConnection } from '~/helpers/api-routes.js';
import { IS_ADMIN, USER, IS_GROUP_ADMIN } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { Status } from '~/helpers/constants/status';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import BsColorScheme from '~/components/group/color-scheme';

export default {
  name: 'BsGroupForm',
  components: {
    BsModalConfirmForm,
    BsColorScheme,
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
  ftpOptions: ['sftp'],
  ftpAuthOptions: [
    { text: 'Password', value: 'password' },
    { text: 'SSH Key', value: 'ssh_key' },
  ],
  data() {
    return {
      useSamlAuthentication: null,
      isReadOnlyActive: true,
      testingFtpConnection: false,
      ftpConnectionResult: null,
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
    // Conditional validation based on auth type
    const ftpCredentialValidation =
      this.group.ftpAuthType === 'ssh_key'
        ? { ftpSshKey: { required } }
        : { ftpPassword: { required } };
    const ftpValidations = {
      ftpHost: { required },
      ftpUsername: { required },
      ...ftpCredentialValidation,
      ftpPort: { required },
      ftpPathOnServer: { required },
      ftpEndPoint: { required },
      ftpButtonLabel: { required },
    };
    return {
      group: {
        name: { required },
        status: { required },
        defaultWorkspaceName: {},
        ...(this.group.downloadMailingWithCdnImages && cdnValidations),
        ...(this.group.downloadMailingWithFtpImages && ftpValidations),
      },
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.group[fieldName].$dirty) return errors;
      !this.$v.group[fieldName].required &&
        errors.push(this.$t('global.errors.required'));
      return errors;
    },
    disableReadOnlyAttribute() {
      this.isReadOnlyActive = false;
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
    async testFtpConnection() {
      this.testingFtpConnection = true;
      this.ftpConnectionResult = null;
      try {
        const response = await this.$axios.$post(
          groupTestFtpConnection({ groupId: this.group?.id })
        );
        this.ftpConnectionResult = response;
      } catch (error) {
        this.ftpConnectionResult = {
          success: false,
          message:
            error.response?.data?.message ||
            this.$t('global.errors.errorOccured'),
        };
      } finally {
        this.testingFtpConnection = false;
      }
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
              <!-- Row 1: Server Connection -->
              <v-row>
                <v-col cols="12" md="2">
                  <v-select
                    id="ftpProtocol"
                    v-model="localModel.ftpProtocol"
                    :label="$t('forms.group.ftpProtocol')"
                    name="ftpProtocol"
                    :disabled="disabled"
                    :items="$options.ftpOptions"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    id="ftpHost"
                    v-model="localModel.ftpHost"
                    :label="$t('forms.group.host')"
                    placeholder="ex: 127.0.0.1"
                    name="ftpHost"
                    :error-messages="requiredErrors(`ftpHost`)"
                    :disabled="disabled"
                    @input="$v.group.ftpHost.$touch()"
                    @blur="$v.group.ftpHost.$touch()"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-text-field
                    id="ftpPort"
                    v-model="localModel.ftpPort"
                    :label="$t('forms.group.port')"
                    placeholder="ex: 22"
                    name="ftpPort"
                    :error-messages="requiredErrors(`ftpPort`)"
                    :disabled="disabled"
                    @input="$v.group.ftpPort.$touch()"
                    @blur="$v.group.ftpPort.$touch()"
                  />
                </v-col>
              </v-row>

              <!-- Row 2: Authentication -->
              <v-row>
                <v-col cols="12" md="3">
                  <v-text-field
                    id="ftpUsername"
                    v-model="localModel.ftpUsername"
                    autocomplete="username"
                    :label="$t('forms.group.username')"
                    name="ftpUsername"
                    :error-messages="requiredErrors(`ftpUsername`)"
                    :disabled="disabled"
                    :readonly="isReadOnlyActive"
                    @focus="disableReadOnlyAttribute"
                    @input="$v.group.ftpUsername.$touch()"
                    @blur="$v.group.ftpUsername.$touch()"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    id="ftpAuthType"
                    v-model="localModel.ftpAuthType"
                    :label="$t('forms.group.ftpAuthType')"
                    name="ftpAuthType"
                    :disabled="disabled"
                    :items="$options.ftpAuthOptions"
                  />
                </v-col>
                <v-col
                  v-if="!localModel.ftpAuthType || localModel.ftpAuthType === 'password'"
                  cols="12"
                  md="6"
                >
                  <v-text-field
                    id="ftpPassword"
                    v-model="localModel.ftpPassword"
                    :readonly="isReadOnlyActive"
                    autocomplete="new-password"
                    type="password"
                    :label="$t('global.password')"
                    name="ftpPassword"
                    :error-messages="requiredErrors(`ftpPassword`)"
                    :disabled="disabled"
                    @focus="disableReadOnlyAttribute"
                    @input="$v.group.ftpPassword.$touch()"
                    @blur="$v.group.ftpPassword.$touch()"
                  />
                </v-col>
                <v-col
                  v-if="localModel.ftpAuthType === 'ssh_key'"
                  cols="12"
                  md="6"
                >
                  <v-textarea
                    id="ftpSshKey"
                    v-model="localModel.ftpSshKey"
                    :label="$t('forms.group.ftpSshKey')"
                    :placeholder="$t('forms.group.ftpSshKeyPlaceholder')"
                    name="ftpSshKey"
                    rows="3"
                    :error-messages="requiredErrors(`ftpSshKey`)"
                    :disabled="disabled"
                    @input="$v.group.ftpSshKey && $v.group.ftpSshKey.$touch()"
                    @blur="$v.group.ftpSshKey && $v.group.ftpSshKey.$touch()"
                  />
                </v-col>
              </v-row>

              <!-- Row 3: Paths & URLs -->
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    id="ftpPathOnServer"
                    v-model="localModel.ftpPathOnServer"
                    :label="$t('forms.group.path')"
                    placeholder="ex: ./uploads/"
                    name="ftpPathOnServer"
                    :error-messages="requiredErrors(`ftpPathOnServer`)"
                    :disabled="disabled"
                    @input="$v.group.ftpPathOnServer.$touch()"
                    @blur="$v.group.ftpPathOnServer.$touch()"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-select
                    id="ftpEndPointProtocol"
                    v-model="localModel.ftpEndPointProtocol"
                    :label="$t('forms.group.httpProtocol')"
                    name="ftpEndPointProtocol"
                    :disabled="disabled"
                    :items="$options.httpOptions"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    id="ftpEndPoint"
                    v-model="localModel.ftpEndPoint"
                    :label="$t('forms.group.endpoint')"
                    placeholder="ex: images.example.com/uploads"
                    name="ftpEndPoint"
                    :error-messages="requiredErrors(`ftpEndPoint`)"
                    :disabled="disabled"
                    @input="$v.group.ftpEndPoint.$touch()"
                    @blur="$v.group.ftpEndPoint.$touch()"
                  />
                </v-col>
              </v-row>

              <!-- Row 4: Display Settings -->
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    id="ftpButtonLabel"
                    v-model="localModel.ftpButtonLabel"
                    :label="$t('forms.group.editorLabel')"
                    placeholder="ex: HTML avec images"
                    name="ftpButtonLabel"
                    :error-messages="requiredErrors(`ftpButtonLabel`)"
                    :disabled="disabled"
                    @input="$v.group.ftpButtonLabel.$touch()"
                    @blur="$v.group.ftpButtonLabel.$touch()"
                  />
                </v-col>
              </v-row>

              <!-- Row 5: Test Connection -->
              <v-row v-if="isEdit">
                <v-col cols="12">
                  <v-btn
                    outlined
                    color="primary"
                    :loading="testingFtpConnection"
                    :disabled="!localModel.ftpHost || !localModel.ftpUsername"
                    @click="testFtpConnection"
                  >
                    <v-icon left>
                      mdi-connection
                    </v-icon>
                    {{ $t('forms.group.testFtpConnection') }}
                  </v-btn>
                  <span
                    v-if="ftpConnectionResult"
                    :class="ftpConnectionResult.success ? 'success--text' : 'error--text'"
                    class="ml-3"
                  >
                    {{ ftpConnectionResult.message }}
                  </span>
                </v-col>
              </v-row>
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
