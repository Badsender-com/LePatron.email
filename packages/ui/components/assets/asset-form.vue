<script>
import { validationMixin } from 'vuelidate';
import { required, minValue } from 'vuelidate/lib/validators';

const ASSET_TYPES = {
  SFTP: 'sftp',
  S3: 's3',
};

const AUTH_TYPES = {
  PASSWORD: 'password',
  SSH_KEY: 'ssh_key',
};

// Mask value used by server - we don't populate with this
const CREDENTIAL_MASK = '••••••••';

export default {
  name: 'AssetForm',
  mixins: [validationMixin],
  props: {
    title: { type: String, default: '' },
    asset: { type: Object, default: () => ({}) },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      form: {
        name: '',
        type: ASSET_TYPES.SFTP,
        publicEndpoint: '',
        sftp: {
          host: '',
          port: 22,
          username: '',
          authType: AUTH_TYPES.PASSWORD,
          password: '',
          sshKey: '',
          pathOnServer: './',
        },
        s3: {
          endpoint: '',
          region: '',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          pathPrefix: '',
          forcePathStyle: false,
        },
      },
      showPassword: false,
      showSecretKey: false,
      assetTypes: [
        { text: 'SFTP', value: ASSET_TYPES.SFTP },
        { text: 'S3', value: ASSET_TYPES.S3 },
      ],
      authTypes: [
        { text: this.$t('assets.form.sftp.password'), value: AUTH_TYPES.PASSWORD },
        { text: this.$t('assets.form.sftp.sshKey'), value: AUTH_TYPES.SSH_KEY },
      ],
    };
  },
  validations() {
    const baseValidations = {
      form: {
        name: { required },
        type: { required },
        publicEndpoint: { required },
      },
    };

    if (this.form.type === ASSET_TYPES.SFTP) {
      baseValidations.form.sftp = {
        host: { required },
        port: { required, minValue: minValue(1) },
        username: { required },
      };
      // In edit mode, credentials are optional (empty = keep current)
      if (!this.isEditMode) {
        if (this.form.sftp.authType === AUTH_TYPES.PASSWORD) {
          baseValidations.form.sftp.password = { required };
        } else {
          baseValidations.form.sftp.sshKey = { required };
        }
      }
    } else if (this.form.type === ASSET_TYPES.S3) {
      baseValidations.form.s3 = {
        region: { required },
        bucket: { required },
        accessKeyId: { required },
      };
      // In edit mode, credentials are optional (empty = keep current)
      if (!this.isEditMode) {
        baseValidations.form.s3.secretAccessKey = { required };
      }
    }

    return baseValidations;
  },
  computed: {
    isEditMode() {
      return this.asset && Object.keys(this.asset).length > 0;
    },
    isSftp() {
      return this.form.type === ASSET_TYPES.SFTP;
    },
    isS3() {
      return this.form.type === ASSET_TYPES.S3;
    },
    isPasswordAuth() {
      return this.form.sftp.authType === AUTH_TYPES.PASSWORD;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.form.name.$dirty) return errors;
      !this.$v.form.name.required && errors.push(this.$t('assets.form.nameRequired'));
      return errors;
    },
    typeErrors() {
      const errors = [];
      if (!this.$v.form.type.$dirty) return errors;
      !this.$v.form.type.required && errors.push(this.$t('assets.form.typeRequired'));
      return errors;
    },
    publicEndpointErrors() {
      const errors = [];
      if (!this.$v.form.publicEndpoint.$dirty) return errors;
      !this.$v.form.publicEndpoint.required && errors.push(this.$t('assets.form.publicEndpointRequired'));
      return errors;
    },
    sftpHostErrors() {
      const errors = [];
      if (!this.isSftp || !this.$v.form.sftp?.host?.$dirty) return errors;
      !this.$v.form.sftp.host.required && errors.push(this.$t('assets.form.sftp.hostRequired'));
      return errors;
    },
    sftpUsernameErrors() {
      const errors = [];
      if (!this.isSftp || !this.$v.form.sftp?.username?.$dirty) return errors;
      !this.$v.form.sftp.username.required && errors.push(this.$t('assets.form.sftp.usernameRequired'));
      return errors;
    },
    sftpPasswordErrors() {
      const errors = [];
      if (!this.isSftp || !this.isPasswordAuth || !this.$v.form.sftp?.password?.$dirty) return errors;
      !this.$v.form.sftp.password.required && errors.push(this.$t('assets.form.sftp.passwordRequired'));
      return errors;
    },
    sftpSshKeyErrors() {
      const errors = [];
      if (!this.isSftp || this.isPasswordAuth || !this.$v.form.sftp?.sshKey?.$dirty) return errors;
      !this.$v.form.sftp.sshKey.required && errors.push(this.$t('assets.form.sftp.sshKeyRequired'));
      return errors;
    },
    s3RegionErrors() {
      const errors = [];
      if (!this.isS3 || !this.$v.form.s3?.region?.$dirty) return errors;
      !this.$v.form.s3.region.required && errors.push(this.$t('assets.form.s3.regionRequired'));
      return errors;
    },
    s3BucketErrors() {
      const errors = [];
      if (!this.isS3 || !this.$v.form.s3?.bucket?.$dirty) return errors;
      !this.$v.form.s3.bucket.required && errors.push(this.$t('assets.form.s3.bucketRequired'));
      return errors;
    },
    s3AccessKeyIdErrors() {
      const errors = [];
      if (!this.isS3 || !this.$v.form.s3?.accessKeyId?.$dirty) return errors;
      !this.$v.form.s3.accessKeyId.required && errors.push(this.$t('assets.form.s3.accessKeyIdRequired'));
      return errors;
    },
    s3SecretAccessKeyErrors() {
      const errors = [];
      if (!this.isS3 || !this.$v.form.s3?.secretAccessKey?.$dirty) return errors;
      !this.$v.form.s3.secretAccessKey.required && errors.push(this.$t('assets.form.s3.secretAccessKeyRequired'));
      return errors;
    },
  },
  mounted() {
    if (this.asset && Object.keys(this.asset).length > 0) {
      this.populateForm();
    }
  },
  methods: {
    populateForm() {
      this.form.name = this.asset.name || '';
      this.form.type = this.asset.type || ASSET_TYPES.SFTP;
      this.form.publicEndpoint = this.asset.publicEndpoint || '';

      if (this.asset.sftp) {
        // Don't populate credentials - they come masked from server
        // Empty field = keep current password
        const password = this.asset.sftp.password;
        const sshKey = this.asset.sftp.sshKey;
        this.form.sftp = {
          host: this.asset.sftp.host || '',
          port: this.asset.sftp.port || 22,
          username: this.asset.sftp.username || '',
          authType: this.asset.sftp.authType || AUTH_TYPES.PASSWORD,
          password: (password && password !== CREDENTIAL_MASK) ? password : '',
          sshKey: (sshKey && sshKey !== CREDENTIAL_MASK) ? sshKey : '',
          pathOnServer: this.asset.sftp.pathOnServer || './',
        };
      }

      if (this.asset.s3) {
        // Don't populate credentials - they come masked from server
        // Empty field = keep current secret key
        const secretKey = this.asset.s3.secretAccessKey;
        this.form.s3 = {
          endpoint: this.asset.s3.endpoint || '',
          region: this.asset.s3.region || '',
          bucket: this.asset.s3.bucket || '',
          accessKeyId: this.asset.s3.accessKeyId || '',
          secretAccessKey: (secretKey && secretKey !== CREDENTIAL_MASK) ? secretKey : '',
          pathPrefix: this.asset.s3.pathPrefix || '',
          forcePathStyle: this.asset.s3.forcePathStyle || false,
        };
      }
    },
    handleSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }

      const payload = {
        name: this.form.name,
        type: this.form.type,
        publicEndpoint: this.form.publicEndpoint,
      };

      if (this.isSftp) {
        payload.sftp = { ...this.form.sftp };
      } else {
        payload.s3 = { ...this.form.s3 };
      }

      this.$emit('submit', payload);
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form" @submit.prevent="handleSubmit">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.name"
            :label="$t('assets.form.name')"
            :error-messages="nameErrors"
            outlined
            required
            @blur="$v.form.name.$touch()"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-select
            v-model="form.type"
            :items="assetTypes"
            :label="$t('assets.form.type')"
            :error-messages="typeErrors"
            outlined
            required
            @blur="$v.form.type.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-text-field
            v-model="form.publicEndpoint"
            :label="$t('assets.form.publicEndpoint')"
            :hint="$t('assets.form.publicEndpointHelper')"
            :error-messages="publicEndpointErrors"
            persistent-hint
            outlined
            required
            @blur="$v.form.publicEndpoint.$touch()"
          />
        </v-col>
      </v-row>

      <!-- SFTP Configuration -->
      <v-card v-if="isSftp" outlined class="mt-4">
        <v-card-title class="subtitle-1">
          {{ $t('assets.form.sftp.title') }}
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="8">
              <v-text-field
                v-model="form.sftp.host"
                :label="$t('assets.form.sftp.host')"
                :error-messages="sftpHostErrors"
                outlined
                required
                @blur="$v.form.sftp && $v.form.sftp.host.$touch()"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model.number="form.sftp.port"
                :label="$t('assets.form.sftp.port')"
                type="number"
                outlined
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.sftp.username"
                :label="$t('assets.form.sftp.username')"
                :error-messages="sftpUsernameErrors"
                outlined
                required
                @blur="$v.form.sftp && $v.form.sftp.username.$touch()"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.sftp.authType"
                :items="authTypes"
                :label="$t('assets.form.sftp.authType')"
                outlined
              />
            </v-col>
          </v-row>

          <v-row v-if="isPasswordAuth">
            <v-col cols="12">
              <v-text-field
                v-model="form.sftp.password"
                :label="$t('assets.form.sftp.password')"
                :error-messages="sftpPasswordErrors"
                :type="showPassword ? 'text' : 'password'"
                :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                :placeholder="isEditMode ? $t('assets.form.keepCurrentPlaceholder') : ''"
                :hint="isEditMode ? $t('assets.form.keepCurrentHint') : ''"
                :persistent-hint="isEditMode"
                outlined
                :required="!isEditMode"
                @click:append="showPassword = !showPassword"
                @blur="$v.form.sftp && $v.form.sftp.password && $v.form.sftp.password.$touch()"
              />
            </v-col>
          </v-row>

          <v-row v-else>
            <v-col cols="12">
              <v-textarea
                v-model="form.sftp.sshKey"
                :label="$t('assets.form.sftp.sshKey')"
                :error-messages="sftpSshKeyErrors"
                :placeholder="isEditMode ? $t('assets.form.keepCurrentPlaceholder') : ''"
                :hint="isEditMode ? $t('assets.form.keepCurrentHint') : ''"
                :persistent-hint="isEditMode"
                outlined
                rows="4"
                :required="!isEditMode"
                @blur="$v.form.sftp && $v.form.sftp.sshKey && $v.form.sftp.sshKey.$touch()"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.sftp.pathOnServer"
                :label="$t('assets.form.sftp.pathOnServer')"
                :hint="$t('assets.form.sftp.pathOnServerHelper')"
                persistent-hint
                outlined
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- S3 Configuration -->
      <v-card v-if="isS3" outlined class="mt-4">
        <v-card-title class="subtitle-1">
          {{ $t('assets.form.s3.title') }}
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.s3.endpoint"
                :label="$t('assets.form.s3.endpoint')"
                :hint="$t('assets.form.s3.endpointHelper')"
                persistent-hint
                outlined
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.s3.region"
                :label="$t('assets.form.s3.region')"
                :error-messages="s3RegionErrors"
                outlined
                required
                @blur="$v.form.s3 && $v.form.s3.region.$touch()"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.s3.bucket"
                :label="$t('assets.form.s3.bucket')"
                :error-messages="s3BucketErrors"
                outlined
                required
                @blur="$v.form.s3 && $v.form.s3.bucket.$touch()"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.s3.accessKeyId"
                :label="$t('assets.form.s3.accessKeyId')"
                :error-messages="s3AccessKeyIdErrors"
                outlined
                required
                @blur="$v.form.s3 && $v.form.s3.accessKeyId.$touch()"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.s3.secretAccessKey"
                :label="$t('assets.form.s3.secretAccessKey')"
                :error-messages="s3SecretAccessKeyErrors"
                :type="showSecretKey ? 'text' : 'password'"
                :append-icon="showSecretKey ? 'mdi-eye' : 'mdi-eye-off'"
                :placeholder="isEditMode ? $t('assets.form.keepCurrentPlaceholder') : ''"
                :hint="isEditMode ? $t('assets.form.keepCurrentHint') : ''"
                :persistent-hint="isEditMode"
                outlined
                :required="!isEditMode"
                @click:append="showSecretKey = !showSecretKey"
                @blur="$v.form.s3 && $v.form.s3.secretAccessKey && $v.form.s3.secretAccessKey.$touch()"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="form.s3.pathPrefix"
                :label="$t('assets.form.s3.pathPrefix')"
                :hint="$t('assets.form.s3.pathPrefixHelper')"
                persistent-hint
                outlined
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-switch
                v-model="form.s3.forcePathStyle"
                :label="$t('assets.form.s3.forcePathStyle')"
                :hint="$t('assets.form.s3.forcePathStyleHelper')"
                persistent-hint
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn color="primary" type="submit" :loading="loading" :disabled="loading">
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
