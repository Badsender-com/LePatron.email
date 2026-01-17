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
  data() {
    return {
      useSamlAuthentication: null,
      isReadOnlyActive: true,
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
    const ftpValidations = {
      ftpHost: { required },
      ftpUsername: { required },
      ftpPassword: { required },
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
  },
};
</script>

<template>
  <div>
    <v-card flat tile tag="form">
      <v-card-text>
        <v-row>
          <v-col cols="12">
            <v-row>
              <v-col cols="4">
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
                <v-text-field
                  v-if="isGroupCreationPage"
                  id="name"
                  v-model="localModel.defaultWorkspaceName"
                  :label="$t('forms.group.defaultWorkspace.label')"
                  name="defaultWorkspaceName"
                  required
                  :disabled="disabled"
                  @input="$v.group.defaultWorkspaceName.$touch()"
                  @blur="$v.group.defaultWorkspaceName.$touch()"
                />
              </v-col>
              <v-col v-if="isAdmin" cols="4">
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
              <v-col v-if="isGroupAdmin" cols="4">
                {{ $t('forms.group.color.label') }}
                <bs-color-scheme v-model="localModel.colorScheme" />
              </v-col>
              <!-- ZIP format option - only visible in legacy mode -->
              <v-col v-if="isAdmin && !localModel.useExportProfiles" cols="4">
                <v-select
                  id="downloadMailingWithoutEnclosingFolder"
                  v-model="localModel.downloadMailingWithoutEnclosingFolder"
                  :label="
                    $t('forms.group.downloadWithoutEnclosingFolder.label')
                  "
                  name="downloadMailingWithoutEnclosingFolder"
                  :disabled="disabled"
                  :items="folderOptions"
                />
              </v-col>
            </v-row>
            <!-- Export Mode Section -->
            <v-row v-if="isAdmin && isEdit">
              <v-col cols="12">
                <v-card outlined class="mb-4">
                  <v-card-title class="subtitle-1">
                    {{ $t('forms.group.exportMode.label') }}
                  </v-card-title>
                  <v-card-text>
                    <p class="body-2 grey--text text--darken-1 mb-4">
                      {{ $t('forms.group.exportMode.description') }}
                    </p>
                    <v-radio-group
                      v-model="localModel.useExportProfiles"
                      :disabled="disabled"
                      class="mt-0"
                    >
                      <v-radio :value="false">
                        <template #label>
                          <div>
                            <span class="font-weight-medium">
                              {{ $t('forms.group.exportMode.legacy.label') }}
                            </span>
                            <p class="body-2 grey--text mb-0">
                              {{ $t('forms.group.exportMode.legacy.description') }}
                            </p>
                          </div>
                        </template>
                      </v-radio>
                      <v-radio :value="true" class="mt-2">
                        <template #label>
                          <div>
                            <span class="font-weight-medium">
                              {{ $t('forms.group.exportMode.advanced.label') }}
                            </span>
                            <p class="body-2 grey--text mb-0">
                              {{ $t('forms.group.exportMode.advanced.description') }}
                            </p>
                          </div>
                        </template>
                      </v-radio>
                    </v-radio-group>
                    <v-alert
                      v-if="localModel.useExportProfiles"
                      type="info"
                      dense
                      text
                      class="mt-2 mb-0"
                    >
                      {{ $t('forms.group.exportMode.warning') }}
                    </v-alert>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Legacy FTP Section - only shown when NOT using export profiles -->
            <v-row v-if="isAdmin && !localModel.useExportProfiles">
              <v-col cols="12">
                <p class="caption ma-0">
                  {{ $t('forms.group.exportFtp') }}
                </p>
                <v-switch
                  v-model="localModel.downloadMailingWithFtpImages"
                  :label="$t('global.enable')"
                  class="ma-0"
                  :disabled="disabled"
                />
                <v-row v-if="localModel.downloadMailingWithFtpImages">
                  <v-col cols="2">
                    <v-select
                      id="ftpProtocol"
                      v-model="localModel.ftpProtocol"
                      :label="$t('forms.group.ftpProtocol')"
                      name="ftpProtocol"
                      :disabled="disabled"
                      :items="$options.ftpOptions"
                    />
                  </v-col>

                  <v-col cols="3">
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

                  <v-col cols="3">
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

                  <v-col cols="3">
                    <v-text-field
                      id="ftpPassword"
                      v-model="localModel.ftpPassword"
                      :readonly="isReadOnlyActive"
                      autocomplete="username"
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

                  <v-col cols="1">
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

                  <v-col cols="3">
                    <v-text-field
                      id="ftpPathOnServer"
                      v-model="localModel.ftpPathOnServer"
                      :label="$t('forms.group.path')"
                      placeholder="ex: ./mailing/"
                      name="ftpPathOnServer"
                      :error-messages="requiredErrors(`ftpPathOnServer`)"
                      :disabled="disabled"
                      @input="$v.group.ftpPathOnServer.$touch()"
                      @blur="$v.group.ftpPathOnServer.$touch()"
                    />
                  </v-col>

                  <v-col cols="2">
                    <v-select
                      id="ftpEndPointProtocol"
                      v-model="localModel.ftpEndPointProtocol"
                      :label="$t('forms.group.httpProtocol')"
                      name="ftpEndPointProtocol"
                      :disabled="disabled"
                      :items="$options.httpOptions"
                    />
                  </v-col>

                  <v-col cols="4">
                    <v-text-field
                      id="ftpEndPoint"
                      v-model="localModel.ftpEndPoint"
                      :label="$t('forms.group.endpoint')"
                      placeholder="ex: images.example.com"
                      name="ftpEndPoint"
                      :error-messages="requiredErrors(`ftpEndPoint`)"
                      :disabled="disabled"
                      @input="$v.group.ftpEndPoint.$touch()"
                      @blur="$v.group.ftpEndPoint.$touch()"
                    />
                  </v-col>

                  <v-col cols="3">
                    <v-text-field
                      id="ftpButtonLabel"
                      v-model="localModel.ftpButtonLabel"
                      :label="$t('forms.group.editorLabel')"
                      placeholder="ex: FTP Download"
                      name="ftpButtonLabel"
                      :error-messages="requiredErrors(`ftpButtonLabel`)"
                      :disabled="disabled"
                      @input="$v.group.ftpButtonLabel.$touch()"
                      @blur="$v.group.ftpButtonLabel.$touch()"
                    />
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
            <v-row v-if="isAdmin">
              <v-col cols="12">
                <p class="caption ma-0">
                  {{ $t('forms.group.exportCdn') }}
                </p>
                <v-switch
                  v-model="localModel.downloadMailingWithCdnImages"
                  :label="$t('global.enable')"
                  class="ma-0"
                  :disabled="disabled"
                />
                <div
                  v-if="localModel.downloadMailingWithCdnImages"
                  class="cdn-options"
                >
                  <v-select
                    id="cdnProtocol"
                    v-model="localModel.cdnProtocol"
                    :label="$t('forms.group.httpProtocol')"
                    name="cdnProtocol"
                    :disabled="disabled"
                    :items="$options.httpOptions"
                  />
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
                  <v-text-field
                    id="cdnButtonLabel"
                    v-model="localModel.cdnButtonLabel"
                    class="cdn-options__button-label"
                    :label="$t('forms.group.editorLabel')"
                    placeholder="ex: Amazon S3"
                    name="cdnButtonLabel"
                    :error-messages="requiredErrors(`cdnButtonLabel`)"
                    :disabled="disabled"
                    @input="$v.group.cdnButtonLabel.$touch()"
                    @blur="$v.group.cdnButtonLabel.$touch()"
                  />
                </div>
              </v-col>
            </v-row>

            <v-row v-if="isAdmin">
              <v-col cols="12">
                <p class="caption ma-0">Activer l'authentification SAML</p>
                <v-switch
                  v-model="useSamlAuthentication"
                  :label="$t('global.enable')"
                  class="ma-0"
                  :disabled="disabled"
                />
                <div v-if="useSamlAuthentication">
                  <v-text-field
                    id="entryPoint"
                    v-model="localModel.entryPoint"
                    :label="$t('forms.group.entryPoint')"
                    name="entryPoint"
                    :disabled="disabled"
                  />
                  <v-text-field
                    id="issuer"
                    v-model="localModel.issuer"
                    :label="$t('forms.group.issuer')"
                    name="issuer"
                    :disabled="disabled"
                  />
                </div>
                <v-checkbox
                  v-model="localModel.userHasAccessToAllWorkspaces"
                  :label="$t('forms.group.userHasAccessToAllWorkspaces')"
                />
              </v-col>
            </v-row>
          </v-col>
        </v-row>
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
.cdn-options {
  display: grid;
  grid-template-columns: 6rem 1fr;
}
.cdn-options__button-label {
  grid-column: span 2;
}
</style>
