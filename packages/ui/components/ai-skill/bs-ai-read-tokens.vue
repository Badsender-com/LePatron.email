<script>
import { mapMutations } from 'vuex';
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import { Plus, Trash2, KeyRound, Check, Copy, AlertTriangle } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import copyToClipboard from '~/helpers/copy-to-clipboard.js';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextField from '~/components/form/bs-text-field';

// Production's read tokens (ADR 0019): a copy (staging, development) follows
// this instance's skills and expertises with one. A token is shown once, at
// its creation, and kept nowhere in the page after: its dialog closes once
// the token is copied, or once the admin says it is saved, for a browser that
// cannot copy. A copy is no source: it creates none, and revokes what it has.
export default {
  name: 'BsAiReadTokens',
  components: {
    BsModalForm,
    BsModalConfirm,
    BsTextField,
    LucidePlus: Plus,
    LucideTrash2: Trash2,
    LucideKeyRound: KeyRound,
    LucideCheck: Check,
    LucideCopy: Copy,
    LucideAlertTriangle: AlertTriangle,
  },
  mixins: [validationMixin],
  props: {
    // This instance follows a production: tokens are created there.
    isCopy: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: false,
      loadError: false,
      tokens: [],
      name: '',
      creating: false,
      created: null,
      tokenCopied: false,
      tokenSaved: false,
      toRevoke: null,
    };
  },
  validations: {
    name: { required, maxLength: maxLength(100) },
  },
  computed: {
    nameErrors() {
      if (!this.$v.name.$dirty) return [];
      if (!this.$v.name.required)
        return [this.$t('global.errors.nameRequired')];
      if (!this.$v.name.maxLength) {
        return [this.$t('aiSkills.readTokens.nameTooLong')];
      }
      return [];
    },
    canClose() {
      return this.tokenCopied || this.tokenSaved;
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async fetchData() {
      this.loading = true;
      try {
        const { items } = await this.$axios.$get(api.aiSkillsReadTokens());
        this.tokens = items;
        this.loadError = false;
      } catch (error) {
        console.error(error);
        this.loadError = true;
      } finally {
        this.loading = false;
      }
    },
    dateOf(value) {
      return this.$options.filters.preciseDateTime(value, this.$i18n.locale);
    },
    metaOf(token) {
      return this.$t('aiSkills.readTokens.meta', {
        date: this.dateOf(token.createdAt),
        lastUse: token.lastUsedAt
          ? this.$t('aiSkills.readTokens.lastUsed', {
              date: this.dateOf(token.lastUsedAt),
            })
          : this.$t('aiSkills.readTokens.neverUsed'),
      });
    },
    openCreate() {
      this.name = '';
      this.$v.$reset();
      this.$refs.createModal.open();
    },
    async createToken() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.creating = true;
      try {
        const { token, ...listed } = await this.$axios.$post(
          api.aiSkillsReadTokens(),
          {
            name: this.name.trim(),
          }
        );
        this.tokens = [listed, ...this.tokens];
        this.$refs.createModal.close();
        this.created = { ...listed, token };
        this.tokenCopied = false;
        this.tokenSaved = false;
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.creating = false;
      }
    },
    // On a browser that cannot copy, the token stays on screen to select,
    // and the box lets the admin close once it is saved.
    async copyToken() {
      if (await copyToClipboard(this.created.token)) {
        this.tokenCopied = true;
      } else {
        this.showSnackbar({
          text: this.$t('aiSkills.readTokens.copyFailed'),
          color: 'error',
        });
      }
    },
    closeCreated() {
      if (this.canClose) this.created = null;
    },
    askRevoke(token) {
      this.toRevoke = token;
      this.$refs.revokeModal.open();
    },
    async revokeToken() {
      const token = this.toRevoke;
      try {
        await this.$axios.$delete(api.aiSkillsReadToken(token.id));
        this.tokens = this.tokens.filter(({ id }) => id !== token.id);
        this.showSnackbar({
          text: this.$t('aiSkills.readTokens.revoked'),
          color: 'success',
        });
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.toRevoke = null;
      }
    },
    notifyError(error) {
      if (error) console.error(error);
      this.showSnackbar({
        text: this.$t('global.errors.errorOccured'),
        color: 'error',
      });
    },
  },
};
</script>

<template>
  <div class="bs-ai-read-tokens">
    <div class="bs-ai-read-tokens__header">
      <div>
        <h2 class="bs-ai-read-tokens__title">
          {{ $t('aiSkills.readTokens.title') }}
        </h2>
        <p class="bs-ai-read-tokens__intro">
          {{
            isCopy
              ? $t('aiSkills.readTokens.descriptionOnCopy')
              : $t('aiSkills.readTokens.description')
          }}
        </p>
      </div>
      <v-btn
        v-if="!isCopy"
        color="accent"
        elevation="0"
        class="text-none bs-ai-read-tokens__add"
        :disabled="loadError"
        @click="openCreate"
      >
        <lucide-plus :size="18" class="mr-2" />
        {{ $t('aiSkills.readTokens.add') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="accent" />
    <v-alert v-else-if="loadError" type="error" outlined text>
      {{ $t('aiSkills.readTokens.loadError') }}
    </v-alert>
    <section
      v-else-if="tokens.length"
      class="bs-ai-read-tokens__card"
      :aria-label="$t('aiSkills.readTokens.listLabel')"
    >
      <ul class="bs-ai-read-tokens__list">
        <li
          v-for="token in tokens"
          :key="token.id"
          class="bs-ai-read-tokens__token"
        >
          <span class="bs-ai-read-tokens__token-icon" aria-hidden="true">
            <lucide-key-round :size="18" />
          </span>
          <div class="bs-ai-read-tokens__token-text">
            <span class="bs-ai-read-tokens__token-name">{{ token.name }}</span>
            <span class="bs-ai-read-tokens__token-meta">{{
              metaOf(token)
            }}</span>
          </div>
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                small
                class="bs-ai-read-tokens__revoke"
                :aria-label="
                  $t('aiSkills.readTokens.revokeNamed', { name: token.name })
                "
                v-bind="attrs"
                @click="askRevoke(token)"
                v-on="on"
              >
                <lucide-trash-2 :size="18" />
              </v-btn>
            </template>
            <span>{{
              $t('aiSkills.readTokens.revokeNamed', { name: token.name })
            }}</span>
          </v-tooltip>
        </li>
      </ul>
      <p class="bs-ai-read-tokens__footnote">
        {{ $t('aiSkills.readTokens.footnote') }}
      </p>
    </section>
    <section v-else class="bs-ai-read-tokens__empty">
      <span class="bs-ai-read-tokens__empty-title">
        {{ $t('aiSkills.readTokens.empty') }}
      </span>
      <span class="bs-ai-read-tokens__empty-text">
        {{
          isCopy
            ? $t('aiSkills.readTokens.emptyOnCopy')
            : $t('aiSkills.readTokens.emptyHint')
        }}
      </span>
    </section>

    <bs-modal-form
      ref="createModal"
      :title="$t('aiSkills.readTokens.add')"
      :submit-label="$t('global.create')"
      :loading="creating"
      width="520"
      @submit="createToken"
    >
      <p class="text-caption text--secondary">
        {{ $t('aiSkills.readTokens.addDescription') }}
      </p>
      <bs-text-field
        v-model="name"
        :label="$t('aiSkills.readTokens.name')"
        :hint="$t('aiSkills.readTokens.nameHint')"
        required
        :error-messages="nameErrors"
        :disabled="creating"
        autofocus
        @input="$v.name.$touch()"
        @blur="$v.name.$touch()"
      />
    </bs-modal-form>

    <!-- Closed only by its button: the token is shown this once. -->
    <v-dialog :value="!!created" width="560" persistent>
      <v-card v-if="created" flat tile class="bs-ai-read-tokens__created">
        <v-card-title class="bs-ai-read-tokens__created-title">
          <v-chip small color="success" dark label>
            <lucide-check :size="14" class="mr-1" />
            {{ $t('aiSkills.readTokens.createdBadge') }}
          </v-chip>
          <span>{{
            $t('aiSkills.readTokens.createdTitle', { name: created.name })
          }}</span>
        </v-card-title>
        <v-card-text>
          <div class="bs-ai-read-tokens__secret">
            <span class="bs-ai-read-tokens__secret-label">
              {{ $t('aiSkills.readTokens.token') }}
            </span>
            <code>{{ created.token }}</code>
            <v-btn
              text
              small
              class="text-none bs-ai-read-tokens__copy"
              :color="tokenCopied ? 'success' : undefined"
              :aria-label="$t('aiSkills.readTokens.copyToken')"
              @click="copyToken"
            >
              <lucide-check v-if="tokenCopied" :size="14" class="mr-1" />
              <lucide-copy v-else :size="14" class="mr-1" />
              {{
                tokenCopied
                  ? $t('aiSkills.readTokens.copied')
                  : $t('aiSkills.readTokens.copy')
              }}
            </v-btn>
          </div>
          <p class="bs-ai-read-tokens__secret-warning">
            <lucide-alert-triangle :size="14" />
            {{ $t('aiSkills.readTokens.once') }}
          </p>
          <v-checkbox
            :input-value="tokenSaved"
            :label="$t('aiSkills.readTokens.savedConfirm')"
            color="accent"
            hide-details
            class="bs-ai-read-tokens__saved"
            @change="tokenSaved = $event === true"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <span v-if="!canClose" class="bs-ai-read-tokens__footnote mr-3">
            {{ $t('aiSkills.readTokens.copyFirst') }}
          </span>
          <v-btn
            color="accent"
            elevation="0"
            class="text-none bs-ai-read-tokens__done"
            :disabled="!canClose"
            @click="closeCreated"
          >
            {{ $t('aiSkills.readTokens.saved') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <bs-modal-confirm
      ref="revokeModal"
      :title="$t('aiSkills.readTokens.revokeTitle')"
      :action-label="$t('aiSkills.readTokens.revoke')"
      @confirm="revokeToken"
    >
      <p v-if="toRevoke">
        {{ $t('aiSkills.readTokens.revokeConfirm', { name: toRevoke.name }) }}
      </p>
    </bs-modal-confirm>
  </div>
</template>

<style lang="scss" scoped>
// Neutral at rest, the error tint on hover: revoking is not the row's state.
.bs-ai-read-tokens__revoke.v-btn {
  color: var(--gray-600);

  &:hover,
  &:focus-visible {
    color: var(--color-error);
    background: var(--color-error-bg);
  }
}

.bs-ai-read-tokens {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  &__intro {
    margin: 0.25rem 0 0;
    max-width: 640px;
    font-size: 0.875rem;
    color: var(--gray-800);
  }

  &__card {
    background: var(--surface);
    border: 1px solid var(--gray-300);
    border-radius: var(--r-md);
    overflow: hidden;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__token {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1rem 1rem 1.5rem;

    & + & {
      border-top: 1px solid var(--gray-200);
    }
  }

  &__token-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--v-accent-base);
    background: var(--accent-tint-tile);
  }

  &__token-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__token-name {
    font-weight: 600;
  }

  &__token-meta {
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__footnote {
    margin: 0;
    font-size: 0.75rem;
    color: var(--gray-700);
  }

  &__card > &__footnote {
    padding: 0.625rem 1.5rem;
    background: var(--surface-muted);
    border-top: 1px solid var(--gray-200);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 2rem;
    text-align: center;
    border: 1px dashed var(--field-border);
    border-radius: var(--r-md);
    background: var(--surface);
  }

  &__empty-title {
    font-weight: 600;
  }

  &__empty-text {
    max-width: 440px;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__created-title {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    word-break: normal;
  }

  // The one value that is never shown again.
  &__secret {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 5px;
    border: 1px solid var(--v-warning-base);
    background: var(--v-warning-lighten5);

    code {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      background: transparent;
      padding: 0;
      font-size: 0.8125rem;
      color: var(--gray-900);
    }
  }

  &__secret-label {
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__secret-warning {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0.75rem 0 0.5rem;
    font-size: 0.75rem;
    color: var(--v-warning-darken3);
  }

  &__saved {
    margin-top: 0.75rem;
    padding-top: 0;
  }
}
</style>
