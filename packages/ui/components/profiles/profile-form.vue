<script>
import { validationMixin } from 'vuelidate';
import SENDINBLUEComponent from '../../components/profiles/esp/SENDINBLUEComponent';
import ACTITOComponent from '../../components/profiles/esp/ACTITOComponent';
import { groupsItem } from '~/helpers/api-routes';
import { ESP_TYPES } from '~/helpers/constants/esp-type';

export default {
  name: 'ProfileForm',
  components: {
    SENDINBLUEComponent,
    ACTITOComponent,
  },
  mixins: [validationMixin],
  props: {
    title: { type: String, default: '' },
    profile: { type: Object, default: () => ({}) },
  },
  data: () => {
    return {
      group: {},
      authorizedEsps: [
        {
          text: 'SendinBlue',
          value: ESP_TYPES.SENDINBLUE,
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
  },
  async mounted() {
    if (this.profile.type) {
      this.selectedEsp = this.profile.type;
    }
    await this.fetchGroup();
  },
  methods: {
    handleEspChange(value) {
      this.selectedEsp = value;
    },
    async fetchGroup() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        const groupResponse = await $axios.$get(groupsItem(params));
        this.group = groupResponse;
      } catch (error) {
        console.log(error);
      }
    },
    handleSubmit(newProfile) {
      this.$emit('submit', newProfile);
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="12">
          <v-card
            v-if="!group.downloadMailingWithFtpImages"
            class="d-flex flex-row p-3"
            elevation="0"
          >
            <v-icon color="warning" class="mr-3">
              error_outline
            </v-icon>
            <div color="grey lighten-2" class="mr-3">
              {{ $t('profiles.warningNoFTP') }}
            </div>
          </v-card>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="4">
          <v-select
            v-model="selectedEsp"
            :items="authorizedEsps"
            label="Esp"
            solo
            :disabled="!group.downloadMailingWithFtpImages"
            @change="handleEspChange($event)"
          />
        </v-col>
        <v-col cols="8">
          <client-only>
            <component
              :is="selectedEspName"
              :profile-data="profile"
              :disabled="!group.downloadMailingWithFtpImages"
              :loading="loading"
              @submit="handleSubmit"
            />
          </client-only>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
