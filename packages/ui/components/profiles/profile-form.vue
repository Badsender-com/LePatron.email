<script>
import { validationMixin } from 'vuelidate';
import { groupsItem } from '~/helpers/api-routes';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import BsSelect from '~/components/form/bs-select.vue';
import SENDINBLUEComponent from './esp/SENDINBLUEComponent.vue';
import ACTITOComponent from './esp/ACTITOComponent.vue';
import DSCComponent from './esp/DSCComponent.vue';
import ADOBEComponent from './esp/ADOBEComponent.vue';
import { Send, AlertTriangle } from 'lucide-vue';

export default {
  name: 'ProfileForm',
  components: {
    BsSelect,
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
    handleCancel() {
      this.$emit('cancel');
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

    <!-- ESP Type Selection Section -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-send :size="20" class="form-section__icon" />
        <div>
          <h3 class="form-section__title">
            {{ $t('profiles.espType') }}
          </h3>
          <p class="form-section__description">
            {{ $t('profiles.espTypeDescription') }}
          </p>
        </div>
      </div>
      <div class="form-section__content">
        <bs-select
          v-model="selectedEsp"
          :items="authorizedEsps"
          :label="$t('profiles.selectEsp')"
          :disabled="isEdit"
          @change="handleEspChange"
        />
      </div>
    </div>

    <!-- ESP-specific Configuration (rendered dynamically) -->
    <client-only>
      <component
        :is="selectedEspName"
        :profile-data="profile"
        :disabled="showFtpWarning"
        :is-loading="isLoading"
        :is-edit="isEdit"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </client-only>
  </form>
</template>

<style lang="scss" scoped>
.profile-form {
  max-width: 800px;

  &__alert {
    margin-bottom: 1.5rem;
  }
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  &:last-of-type {
    border-bottom: none;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  &__icon {
    color: var(--v-accent-base);
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  &__content {
    padding-left: 2rem;
  }
}
</style>
