<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

export default {
  name: `bs-group-form`,
  mixins: [validationMixin],
  model: { prop: `group`, event: `update` },
  props: {
    group: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  httpOptions: [`http://`, `https://`],
  ftpOptions: [`sftp`],
  data() {
    return {
      useSamlAuthentication: null
    }
  },
  computed: {
    localModel: {
      get() {
        return this.group;
      },
      set(updatedGroup) {
        this.$emit(`update`, updatedGroup);
      },
    },
    folderOptions() {
      return [
        {
          text: this.$t(`forms.group.downloadWithoutEnclosingFolder.wrapped`),
          value: false,
        },
        {
          text: this.$t(`forms.group.downloadWithoutEnclosingFolder.unwrapped`),
          value: true,
        },
      ];
    },
  },
  watch: {
    useSamlAuthentication: {
      immediate: true,
      handler(newVal) {
        if (newVal === null) {
          this.useSamlAuthentication = this.group.issuer.length > 0 || this.group.entryPoint.length > 0
        }
      }
    }
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
      this.$emit(`submit`, this.group);
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
            <v-col cols="7">
              <v-text-field
                v-model="localModel.name"
                id="name"
                :label="$t('global.name')"
                name="name"
                required
                :disabled="disabled"
                :error-messages="requiredErrors(`name`)"
                @input="$v.group.name.$touch()"
                @blur="$v.group.name.$touch()"
              />
            </v-col>

            <v-col cols="5">
              <v-select
                v-model="localModel.downloadMailingWithoutEnclosingFolder"
                id="downloadMailingWithoutEnclosingFolder"
                :label="$t('forms.group.downloadWithoutEnclosingFolder.label')"
                name="downloadMailingWithoutEnclosingFolder"
                :disabled="disabled"
                :items="folderOptions"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <p class="caption ma-0">{{ $t('forms.group.exportFtp') }}</p>
              <v-switch
                :label="$t('global.enable')"
                class="ma-0"
                v-model="localModel.downloadMailingWithFtpImages"
                :disabled="disabled"
              />
              <v-row v-if="localModel.downloadMailingWithFtpImages">
                <v-col cols="2">
                  <v-select
                    v-model="localModel.ftpProtocol"
                    id="ftpProtocol"
                    :label="$t('forms.group.ftpProtocol')"
                    name="ftpProtocol"
                    :disabled="disabled"
                    :items="$options.ftpOptions"
                  />
                </v-col>

                <v-col cols="3">
                  <v-text-field
                    v-model="localModel.ftpHost"
                    id="ftpHost"
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
                    v-model="localModel.ftpUsername"
                    id="ftpUsername"
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
                    v-model="localModel.ftpPassword"
                    type="password"
                    id="ftpPassword"
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
                    v-model="localModel.ftpPort"
                    id="ftpPort"
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
                    v-model="localModel.ftpPathOnServer"
                    id="ftpPathOnServer"
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
                    v-model="localModel.ftpEndPointProtocol"
                    id="ftpEndPointProtocol"
                    :label="$t('forms.group.httpProtocol')"
                    name="ftpEndPointProtocol"
                    :disabled="disabled"
                    :items="$options.httpOptions"
                  />
                </v-col>

                <v-col cols="4">
                  <v-text-field
                    v-model="localModel.ftpEndPoint"
                    id="ftpEndPoint"
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
                    v-model="localModel.ftpButtonLabel"
                    id="ftpButtonLabel"
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
          <v-row>
            <v-col cols="12">
              <p class="caption ma-0">{{ $t('forms.group.exportCdn') }}</p>
              <v-switch
                :label="$t('global.enable')"
                class="ma-0"
                v-model="localModel.downloadMailingWithCdnImages"
                :disabled="disabled"
              />
              <div
                class="cdn-options"
                v-if="localModel.downloadMailingWithCdnImages"
              >
                <v-select
                  v-model="localModel.cdnProtocol"
                  id="cdnProtocol"
                  :label="$t('forms.group.httpProtocol')"
                  name="cdnProtocol"
                  :disabled="disabled"
                  :items="$options.httpOptions"
                />
                <v-text-field
                  v-model="localModel.cdnEndPoint"
                  id="cdnEndPoint"
                  :label="$t('forms.group.endpoint')"
                  placeholder="ex: cdn.example.com"
                  name="cdnEndPoint"
                  :error-messages="requiredErrors(`cdnEndPoint`)"
                  :disabled="disabled"
                  @input="$v.group.cdnEndPoint.$touch()"
                  @blur="$v.group.cdnEndPoint.$touch()"
                />
                <v-text-field
                  class="cdn-options__button-label"
                  v-model="localModel.cdnButtonLabel"
                  id="cdnButtonLabel"
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

          <v-row>
            <v-col cols="12">
              <p class="caption ma-0">Activer l'authentification SAML</p>
              <v-switch
                :label="$t('global.enable')"
                class="ma-0"
                v-model="useSamlAuthentication"
                :disabled="disabled"
              />
              <div v-if="useSamlAuthentication">
                <v-text-field
                  v-model="localModel.entryPoint"
                  id="entryPoint"
                  :label="$t('forms.group.entryPoint')"
                  name="entryPoint"
                  :disabled="disabled"
                />
                <v-text-field
                  v-model="localModel.issuer"
                  id="issuer"
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
      <v-btn
        text
        large
        color="primary"
        @click="onSubmit"
        :disabled="disabled"
        >{{ $t('global.save') }}</v-btn
      >
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
