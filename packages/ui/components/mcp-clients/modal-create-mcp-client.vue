<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field';
import BsTextarea from '~/components/form/bs-textarea';
import BsSelect from '~/components/form/bs-select';
import { ChevronDown, ChevronRight } from 'lucide-vue';

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

// One redirect URI a line, as the assistant's set-up screen gives them.
const urisOf = (text) =>
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function isRedirectUri(value) {
  try {
    const url = new URL(value);
    return (
      !url.hash &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && LOOPBACK.includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

const emptyClient = () => ({
  name: '',
  redirectUris: '',
  tokenEndpointAuthMethod: 'client_secret_post',
});

export default {
  name: 'BsModalCreateMcpClient',
  components: {
    BsModalForm,
    BsTextField,
    BsTextarea,
    BsSelect,
    LucideChevronDown: ChevronDown,
    LucideChevronRight: ChevronRight,
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return { client: emptyClient(), advanced: false };
  },
  validations() {
    return {
      client: {
        name: { required, maxLength: maxLength(100) },
        redirectUris: {
          required,
          valid: (text) => {
            const uris = urisOf(text);
            return uris.length <= 10 && uris.every(isRedirectUri);
          },
        },
      },
    };
  },
  computed: {
    authMethods() {
      return [
        {
          text: this.$t('mcpClients.authMethods.client_secret_post'),
          value: 'client_secret_post',
        },
        {
          text: this.$t('mcpClients.authMethods.client_secret_basic'),
          value: 'client_secret_basic',
        },
      ];
    },
    nameErrors() {
      const { name } = this.$v.client;
      if (!name.$dirty) return [];
      if (!name.required) return [this.$t('global.errors.nameRequired')];
      if (!name.maxLength) return [this.$t('mcpClients.errors.nameTooLong')];
      return [];
    },
    // The first address refused, for the error to name it (ADR 0012).
    refusedUri() {
      return urisOf(this.client.redirectUris).find(
        (uri) => !isRedirectUri(uri)
      );
    },
    redirectUrisErrors() {
      const { redirectUris } = this.$v.client;
      if (!redirectUris.$dirty) return [];
      if (!redirectUris.required) {
        return [this.$t('mcpClients.errors.redirectUrisRequired')];
      }
      if (!redirectUris.valid && this.refusedUri) {
        return [
          this.$t('mcpClients.errors.redirectUriRefused', {
            uri: this.refusedUri,
          }),
        ];
      }
      if (!redirectUris.valid) {
        return [this.$t('mcpClients.errors.redirectUrisInvalid')];
      }
      return [];
    },
  },
  methods: {
    open() {
      this.client = emptyClient();
      this.advanced = false;
      this.$v.$reset();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', {
        name: this.client.name.trim(),
        redirectUris: urisOf(this.client.redirectUris),
        tokenEndpointAuthMethod: this.client.tokenEndpointAuthMethod,
      });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="$t('mcpClients.add')"
    :submit-label="$t('global.create')"
    :loading="loading"
    width="600"
    @submit="onSubmit"
  >
    <p class="text-caption text--secondary">
      {{ $t('mcpClients.addDescription') }}
    </p>
    <bs-text-field
      v-model="client.name"
      :label="$t('mcpClients.name')"
      :hint="$t('mcpClients.nameHint')"
      required
      :error-messages="nameErrors"
      :disabled="loading"
      autofocus
      @input="$v.client.name.$touch()"
      @blur="$v.client.name.$touch()"
    />
    <bs-textarea
      v-model="client.redirectUris"
      :label="$t('mcpClients.redirectUris')"
      :hint="$t('mcpClients.redirectUrisHint')"
      required
      monospace
      :rows="3"
      :error-messages="redirectUrisErrors"
      :disabled="loading"
      @input="$v.client.redirectUris.$touch()"
      @blur="$v.client.redirectUris.$touch()"
    />
    <!-- The default suits nearly every assistant: folded away. -->
    <v-btn
      text
      small
      class="text-none px-1"
      :aria-expanded="String(advanced)"
      aria-controls="mcp-client-advanced"
      @click="advanced = !advanced"
    >
      <lucide-chevron-down v-if="advanced" :size="16" class="mr-1" />
      <lucide-chevron-right v-else :size="16" class="mr-1" />
      {{ $t('mcpClients.advanced') }}
    </v-btn>
    <div v-show="advanced" id="mcp-client-advanced" class="mt-3">
      <bs-select
        v-model="client.tokenEndpointAuthMethod"
        :label="$t('mcpClients.authMethod')"
        :hint="$t('mcpClients.authMethodHint')"
        :items="authMethods"
        :disabled="loading"
      />
    </div>
  </bs-modal-form>
</template>
