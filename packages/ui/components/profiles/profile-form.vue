<script>
import { validationMixin } from 'vuelidate';
import SENDINBLUEComponent from '../../components/profiles/esp/SENDINBLUEComponent';
import ACTITOComponent from '../../components/profiles/esp/ACTITOComponent';
import DSCComponent from '../../components/profiles/esp/DSCComponent';
import { groupsItem, groupAssets } from '~/helpers/api-routes';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import ADOBEComponent from '../../components/profiles/esp/ADOBEComponent';

export default {
  name: 'ProfileForm',
  components: {
    SENDINBLUEComponent,
    ACTITOComponent,
    DSCComponent,
    ADOBEComponent,
  },
  mixins: [validationMixin],
  props: {
    title: { type: String, default: '' },
    profile: { type: Object, default: () => ({}) },
  },
  data: () => {
    return {
      group: {},
      assets: [],
      authorizedEsps: [
        {
          text: 'SendinBlue',
          value: ESP_TYPES.SENDINBLUE,
        },
        {
          text: 'Actito',
          value: ESP_TYPES.ACTITO,
        },
        {
          text: 'DSC',
          value: ESP_TYPES.DSC,
        },
        {
          text: 'Adobe',
          value: ESP_TYPES.ADOBE,
        },
      ],
      selectedEsp: ESP_TYPES.SENDINBLUE,
      loading: false,
    };
  },
  computed: {
    selectedEspName() {
      return this.selectedEsp + 'Component';
    },
    needsImageHosting() {
      return this.selectedEsp !== ESP_TYPES.ADOBE;
    },
    hasActiveAssets() {
      return this.assets.some((asset) => asset.isActive);
    },
    hasImageHosting() {
      return this.group.downloadMailingWithFtpImages || this.hasActiveAssets;
    },
    isFormDisabled() {
      return this.needsImageHosting && !this.hasImageHosting;
    },
  },
  async mounted() {
    if (this.profile.type) {
      this.selectedEsp = this.profile.type;
    }
    await Promise.all([this.fetchGroup(), this.fetchAssets()]);
  },
  methods: {
    handleEspChange(value) {
      this.selectedEsp = value;
    },
    async fetchGroup() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.group = await $axios.$get(groupsItem(params));
      } catch (error) {
        console.log(error);
      }
    },
    async fetchAssets() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        const response = await $axios.$get(groupAssets(params));
        this.assets = response.result || [];
      } catch (error) {
        console.log(error);
        this.assets = [];
      }
    },
    handleSubmit(newProfile) {
      this.$emit('submit', newProfile);
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row v-if="isFormDisabled">
        <v-col cols="12">
          <v-alert
            dense
            border="left"
            type="warning"
            class="d-flex flex-row p-3"
          >
            {{ $t('profiles.warningNoImageHosting') }}
          </v-alert>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="selectedEsp"
            :items="authorizedEsps"
            label="Esp"
            solo
            outlined
            flat
            @change="handleEspChange($event)"
          />
          <client-only>
            <component
              :is="selectedEspName"
              :profile-data="profile"
              :disabled="isFormDisabled"
              :loading="loading"
              @submit="handleSubmit"
            />
          </client-only>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
