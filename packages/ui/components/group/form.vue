<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapGetters } from 'vuex';
import { IS_ADMIN, USER } from '~/store/user';
import { Status } from '~/helpers/constants/status';

export default {
  name: 'BsGroupForm',
  mixins: [validationMixin],
  model: { prop: 'group', event: 'update' },
  props: {
    group: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  httpOptions: ['http://', 'https://'],
  ftpOptions: ['sftp'],
  data() {
    return {
      useSamlAuthentication: null,
    };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
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
        defaultWorkspaceName: {},
        ...(this.group.downloadMailingWithCdnImages && cdnValidations),
        ...(this.group.downloadMailingWithFtpImages && ftpValidations),
      },
    };
  },
  methods: {
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.group[fieldName].$dirty) return errors;
      !this.$v.group[fieldName].required &&
        errors.push(this.$t('global.errors.required'));
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
  },
};
</script>

<template>
  <v-card :flat="flat" :tile="flat" tag="form">
    <v-card-text>
      <v-row>
        <v-col cols="12">
          <v-row>
            <v-col cols="4">
              <v-text-field
                id="name"
                v-model="localModel.name"
                :label="$t('global.name')"
                name="name"
                required
                :disabled="disabled"
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
                :label="$t('forms.group.status.label')"
                name="status"
                :items="statusOptions"
              />
            </v-col>
            <v-col v-if="isAdmin" cols="4">
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
          <v-row v-if="isAdmin">
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
                    :label="$t('forms.group.username')"
                    name="ftpUsername"
                    :error-messages="requiredErrors(`ftpUsername`)"
                    :disabled="disabled"
                    @input="$v.group.ftpUsername.$touch()"
                    @blur="$v.group.ftpUsername.$touch()"
                  />
                </v-col>

                <v-col cols="3">
                  <v-text-field
                    id="ftpPassword"
                    v-model="localModel.ftpPassword"
                    type="password"
                    :label="$t('global.password')"
                    name="ftpPassword"
                    :error-messages="requiredErrors(`ftpPassword`)"
                    :disabled="disabled"
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
              <p class="caption ma-0">
                Activer l'authentification SAML
              </p>
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
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn text large color="primary" :disabled="disabled" @click="onSubmit">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
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
