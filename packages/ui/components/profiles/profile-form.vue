<script>
import { validationMixin } from 'vuelidate';
import { groupsItem } from '~/helpers/api-routes';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import BsSelect from '~/components/form/bs-select.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import SENDINBLUEComponent from './esp/SENDINBLUEComponent.vue';
import ACTITOComponent from './esp/ACTITOComponent.vue';
import DSCComponent from './esp/DSCComponent.vue';
import ADOBEComponent from './esp/ADOBEComponent.vue';
import { Send, AlertTriangle } from 'lucide-vue';

export default {
  name: 'ProfileForm',
  components: {
    BsSelect,
    BsFormSection,
    SENDINBLUEComponent,
    ACTITOComponent,
    DSCComponent,
    ADOBEComponent,
    LucideSend: Send,
    LucideAlertTriangle: AlertTriangle,
  },
  mixins: [validationMixin],
  props: {
    profile: { type: Object, default: () => ({}) },
    isLoading: { type: Boolean, default: false },
    isEdit: { type: Boolean, default: false },
  },
  data: () => {
    return {
      group: {},
      authorizedEsps: [
        {
          text: 'Brevo (ex-SendinBlue)',
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
          text: 'Adobe Campaign',
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
    needsFtpConfig() {
      return this.selectedEsp !== ESP_TYPES.ADOBE;
    },
    showFtpWarning() {
      return this.needsFtpConfig && !this.group.downloadMailingWithFtpImages;
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
        this.group = await $axios.$get(groupsItem(params));
      } catch (error) {
        console.error(error);
      }
    },
    handleSubmit(newProfile) {
      this.$emit('submit', newProfile);
    },
  },
};
</script>

<template>
  <form class="profile-form" @submit.prevent>
    <!-- FTP Warning Alert -->
    <v-alert
      v-if="showFtpWarning"
      type="warning"
      border="left"
      colored-border
      class="profile-form__alert"
    >
      <div class="d-flex align-center">
        <lucide-alert-triangle :size="20" class="mr-3" />
        <span>{{ $t('profiles.warningNoFTP') }}</span>
      </div>
    </v-alert>

    <!-- ESP Type Selection (own card so it visually anchors above the ESP-specific card) -->
    <v-card flat tile>
      <v-card-text>
        <bs-form-section last>
          <template #icon>
            <lucide-send :size="20" />
          </template>
          <template #title>
            {{ $t('profiles.espType') }}
          </template>
          <template #description>
            {{ $t('profiles.espTypeDescription') }}
          </template>
          <bs-select
            v-model="selectedEsp"
            :items="authorizedEsps"
            :label="$t('profiles.selectEsp')"
            :disabled="isEdit"
            @change="handleEspChange"
          />
        </bs-form-section>
      </v-card-text>
    </v-card>

    <!-- ESP-specific Configuration (rendered dynamically) -->
    <client-only>
      <component
        :is="selectedEspName"
        :profile-data="profile"
        :disabled="showFtpWarning"
        :is-loading="isLoading"
        :is-edit="isEdit"
        class="mt-4"
        @submit="handleSubmit"
      />
    </client-only>
  </form>
</template>

<style lang="scss" scoped>
.profile-form {
  &__alert {
    margin-bottom: 1.5rem;
  }
}
</style>
