<script>
import { validationMixin } from 'vuelidate';
import { required, requiredIf } from 'vuelidate/lib/validators';
import { groupAssets, groupsProfiles } from '~/helpers/api-routes.js';

const DELIVERY_METHODS = {
  ESP: 'esp',
  DOWNLOAD: 'download',
};

const ASSET_METHODS = {
  ASSET: 'asset',
  ZIP: 'zip',
  ESP_API: 'esp_api',
};

export default {
  name: 'ExportProfileForm',
  mixins: [validationMixin],
  props: {
    title: { type: String, default: '' },
    exportProfile: { type: Object, default: () => ({}) },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      form: {
        name: '',
        deliveryMethod: DELIVERY_METHODS.ESP,
        _espProfile: null,
        assetMethod: ASSET_METHODS.ASSET,
        _asset: null,
        zipWithoutEnclosingFolder: false,
      },
      espProfiles: [],
      assets: [],
      loadingData: true,
    };
  },
  validations: {
    form: {
      name: { required },
      deliveryMethod: { required },
      assetMethod: { required },
      _espProfile: {
        required: requiredIf(function () {
          return this.form.deliveryMethod === 'esp';
        }),
      },
      _asset: {
        required: requiredIf(function () {
          return this.form.assetMethod === 'asset';
        }),
      },
    },
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    deliveryMethodOptions() {
      return [
        { text: this.$t('exportProfiles.form.deliveryMethods.esp'), value: DELIVERY_METHODS.ESP },
        { text: this.$t('exportProfiles.form.deliveryMethods.download'), value: DELIVERY_METHODS.DOWNLOAD },
      ];
    },
    assetMethodOptions() {
      const options = [
        { text: this.$t('exportProfiles.form.assetMethods.asset'), value: ASSET_METHODS.ASSET },
        { text: this.$t('exportProfiles.form.assetMethods.zip'), value: ASSET_METHODS.ZIP },
      ];

      // ESP API is only available when delivery method is ESP
      if (this.form.deliveryMethod === DELIVERY_METHODS.ESP) {
        options.push({
          text: this.$t('exportProfiles.form.assetMethods.esp_api'),
          value: ASSET_METHODS.ESP_API,
        });
      }

      return options;
    },
    espProfileOptions() {
      return this.espProfiles.map((profile) => ({
        text: profile.name,
        value: profile.id,
      }));
    },
    assetOptions() {
      return this.assets
        .filter((asset) => asset.isActive)
        .map((asset) => ({
          text: `${asset.name} (${asset.type.toUpperCase()})`,
          value: asset.id,
        }));
    },
    isEspDelivery() {
      return this.form.deliveryMethod === DELIVERY_METHODS.ESP;
    },
    needsAsset() {
      return this.form.assetMethod === ASSET_METHODS.ASSET;
    },
    isZipMethod() {
      return this.form.assetMethod === ASSET_METHODS.ZIP;
    },
    zipFormatOptions() {
      return [
        {
          text: this.$t('exportProfiles.form.zipFormat.wrapped'),
          value: false,
        },
        {
          text: this.$t('exportProfiles.form.zipFormat.unwrapped'),
          value: true,
        },
      ];
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.form.name.$dirty) return errors;
      !this.$v.form.name.required && errors.push(this.$t('exportProfiles.form.nameRequired'));
      return errors;
    },
    deliveryMethodErrors() {
      const errors = [];
      if (!this.$v.form.deliveryMethod.$dirty) return errors;
      !this.$v.form.deliveryMethod.required && errors.push(this.$t('exportProfiles.form.deliveryMethodRequired'));
      return errors;
    },
    espProfileErrors() {
      const errors = [];
      if (!this.isEspDelivery || !this.$v.form._espProfile.$dirty) return errors;
      !this.$v.form._espProfile.required && errors.push(this.$t('exportProfiles.form.espProfileRequired'));
      return errors;
    },
    assetMethodErrors() {
      const errors = [];
      if (!this.$v.form.assetMethod.$dirty) return errors;
      !this.$v.form.assetMethod.required && errors.push(this.$t('exportProfiles.form.assetMethodRequired'));
      return errors;
    },
    assetErrors() {
      const errors = [];
      if (!this.needsAsset || !this.$v.form._asset.$dirty) return errors;
      !this.$v.form._asset.required && errors.push(this.$t('exportProfiles.form.assetRequired'));
      return errors;
    },
  },
  watch: {
    'form.deliveryMethod'(newValue) {
      // If switching to download, reset esp_api asset method to asset
      if (newValue === DELIVERY_METHODS.DOWNLOAD && this.form.assetMethod === ASSET_METHODS.ESP_API) {
        this.form.assetMethod = ASSET_METHODS.ASSET;
      }
      // Clear ESP profile if switching to download
      if (newValue === DELIVERY_METHODS.DOWNLOAD) {
        this.form._espProfile = null;
      }
    },
    'form.assetMethod'(newValue) {
      // Clear asset if not using asset method
      if (newValue !== ASSET_METHODS.ASSET) {
        this.form._asset = null;
      }
    },
  },
  async mounted() {
    await this.fetchData();
    if (this.exportProfile && Object.keys(this.exportProfile).length > 0) {
      this.populateForm();
    }
  },
  methods: {
    async fetchData() {
      try {
        this.loadingData = true;
        const [espProfilesResponse, assetsResponse] = await Promise.all([
          this.$axios.$get(groupsProfiles({ groupId: this.groupId })),
          this.$axios.$get(groupAssets({ groupId: this.groupId })),
        ]);
        // ESP profiles endpoint returns { items: [] }, assets endpoint returns { result: [] }
        this.espProfiles = espProfilesResponse.items || espProfilesResponse.result || [];
        this.assets = assetsResponse.result || [];
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        this.loadingData = false;
      }
    },
    populateForm() {
      this.form.name = this.exportProfile.name || '';
      this.form.deliveryMethod = this.exportProfile.deliveryMethod || DELIVERY_METHODS.ESP;
      this.form._espProfile = this.exportProfile._espProfile?.id || this.exportProfile._espProfile || null;
      this.form.assetMethod = this.exportProfile.assetMethod || ASSET_METHODS.ASSET;
      this.form._asset = this.exportProfile._asset?.id || this.exportProfile._asset || null;
      this.form.zipWithoutEnclosingFolder = this.exportProfile.zipWithoutEnclosingFolder ?? false;
    },
    handleSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }

      // Additional validation as safety net
      if (this.isEspDelivery && !this.form._espProfile) {
        return;
      }
      if (this.needsAsset && !this.form._asset) {
        return;
      }

      const payload = {
        name: this.form.name,
        deliveryMethod: this.form.deliveryMethod,
        assetMethod: this.form.assetMethod,
      };

      if (this.isEspDelivery) {
        payload.espProfileId = this.form._espProfile;
      }

      if (this.needsAsset) {
        payload.assetId = this.form._asset;
      }

      if (this.isZipMethod) {
        payload.zipWithoutEnclosingFolder = this.form.zipWithoutEnclosingFolder;
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
      <v-skeleton-loader v-if="loadingData" type="article" />
      <template v-else>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="form.name"
              :label="$t('exportProfiles.form.name')"
              :error-messages="nameErrors"
              outlined
              required
              @blur="$v.form.name.$touch()"
            />
          </v-col>
        </v-row>

        <!-- Delivery Method Section -->
        <v-card outlined class="mb-4">
          <v-card-title class="subtitle-1">
            {{ $t('exportProfiles.form.deliveryMethod') }}
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12">
                <v-radio-group
                  v-model="form.deliveryMethod"
                  :error-messages="deliveryMethodErrors"
                  row
                  @blur="$v.form.deliveryMethod.$touch()"
                >
                  <v-radio
                    v-for="option in deliveryMethodOptions"
                    :key="option.value"
                    :label="option.text"
                    :value="option.value"
                  />
                </v-radio-group>
              </v-col>
            </v-row>

            <v-row v-if="isEspDelivery">
              <v-col cols="12">
                <v-alert v-if="espProfiles.length === 0" type="warning" dense>
                  {{ $t('exportProfiles.form.noEspProfiles') }}
                </v-alert>
                <v-select
                  v-else
                  v-model="form._espProfile"
                  :items="espProfileOptions"
                  :label="$t('exportProfiles.form.espProfile')"
                  :hint="$t('exportProfiles.form.espProfileHelper')"
                  :error-messages="espProfileErrors"
                  persistent-hint
                  outlined
                  clearable
                  @blur="$v.form._espProfile.$touch()"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Asset Method Section -->
        <v-card outlined>
          <v-card-title class="subtitle-1">
            {{ $t('exportProfiles.form.assetMethod') }}
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12">
                <v-radio-group
                  v-model="form.assetMethod"
                  :error-messages="assetMethodErrors"
                  row
                  @blur="$v.form.assetMethod.$touch()"
                >
                  <v-radio
                    v-for="option in assetMethodOptions"
                    :key="option.value"
                    :label="option.text"
                    :value="option.value"
                  />
                </v-radio-group>
              </v-col>
            </v-row>

            <v-row v-if="needsAsset">
              <v-col cols="12">
                <v-alert v-if="assets.length === 0" type="warning" dense>
                  {{ $t('exportProfiles.form.noAssets') }}
                </v-alert>
                <v-select
                  v-else
                  v-model="form._asset"
                  :items="assetOptions"
                  :label="$t('exportProfiles.form.asset')"
                  :hint="$t('exportProfiles.form.assetHelper')"
                  :error-messages="assetErrors"
                  persistent-hint
                  outlined
                  clearable
                  @blur="$v.form._asset.$touch()"
                />
              </v-col>
            </v-row>

            <!-- ZIP Format options (only visible when assetMethod is 'zip') -->
            <v-row v-if="isZipMethod">
              <v-col cols="12">
                <v-select
                  v-model="form.zipWithoutEnclosingFolder"
                  :items="zipFormatOptions"
                  :label="$t('exportProfiles.form.zipFormat.label')"
                  :hint="$t('exportProfiles.form.zipFormat.hint')"
                  persistent-hint
                  outlined
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </template>
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn
        color="primary"
        type="submit"
        :loading="loading"
        :disabled="loading || loadingData"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
