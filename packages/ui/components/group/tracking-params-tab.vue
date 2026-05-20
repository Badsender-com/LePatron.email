<script>
import { mapMutations } from 'vuex';
import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import { Trash2 } from 'lucide-vue';

function emptyConfig() {
  return {
    enabled: false,
    restrictValues: false,
    params: [],
  };
}

export default {
  name: 'TrackingParamsTab',
  components: {
    BsTextField,
    LucideTrash2: Trash2,
  },
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return {
      localGroup: {},
      loading: false,
      valuesInputs: [],
    };
  },
  computed: {
    config() {
      return this.localGroup.trackingConfig || emptyConfig();
    },
    duplicateKeys() {
      const counts = {};
      (this.config.params || []).forEach((p) => {
        const k = (p.key || '').trim().toLowerCase();
        if (!k) return;
        counts[k] = (counts[k] || 0) + 1;
      });
      return Object.entries(counts)
        .filter(([, n]) => n > 1)
        .map(([k]) => k);
    },
    hasInvalidKey() {
      return (this.config.params || []).some(
        (p) => !p.key || !p.key.trim().length
      );
    },
    canSave() {
      return !this.hasInvalidKey && this.duplicateKeys.length === 0;
    },
  },
  watch: {
    group: {
      immediate: true,
      handler(g) {
        this.localGroup = JSON.parse(JSON.stringify(g || {}));
        if (!this.localGroup.trackingConfig) {
          this.$set(this.localGroup, 'trackingConfig', emptyConfig());
        }
        this.syncValuesInputs();
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    syncValuesInputs() {
      this.valuesInputs = (this.config.params || []).map((p) =>
        (p.values || []).join(', ')
      );
    },
    addParam() {
      this.config.params.push({
        key: '',
        values: [],
        required: false,
      });
      this.valuesInputs.push('');
      this.$nextTick(() => {
        const rows = this.$el.querySelectorAll('.params-table__row');
        const last = rows[rows.length - 1];
        if (last) {
          const input = last.querySelector('input');
          if (input) input.focus();
        }
      });
    },
    removeParam(index) {
      this.config.params.splice(index, 1);
      this.valuesInputs.splice(index, 1);
    },
    onKeyInput(index, value) {
      this.config.params[index].key = value;
    },
    onValuesInput(index, raw) {
      this.valuesInputs[index] = raw;
      // split on comma or newline, strip whitespace, dedupe
      const cleaned = raw
        .split(/[,\n]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      this.config.params[index].values = Array.from(new Set(cleaned));
    },
    onRequiredChange(index, value) {
      this.config.params[index].required = Boolean(value);
    },
    onEnabledChange(value) {
      this.config.enabled = Boolean(value);
    },
    onRestrictValuesChange(value) {
      this.config.restrictValues = Boolean(value);
    },
    keyError(index) {
      const p = this.config.params[index];
      if (!p) return null;
      if (!p.key || !p.key.trim()) {
        return this.$t('trackingConfig.validation.emptyKey');
      }
      if (this.duplicateKeys.includes(p.key.trim().toLowerCase())) {
        return this.$t('trackingConfig.validation.duplicateKey');
      }
      return null;
    },
    async onSubmit() {
      if (!this.canSave) return;
      this.loading = true;
      try {
        await this.$axios.$put(
          groupsItem({ groupId: this.localGroup.id }),
          this.localGroup
        );
        this.showSnackbar({
          text: this.$t('trackingConfig.snackbars.updated'),
          color: 'success',
        });
        this.$emit('update');
      } catch (error) {
        this.showSnackbar({
          text: this.$t('trackingConfig.snackbars.error'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="tracking-params">
    <p class="tracking-params__description">
      {{ $t('trackingConfig.description') }}
    </p>

    <div class="tracking-params__toggles">
      <v-switch
        :input-value="config.enabled"
        :label="$t('trackingConfig.enabled')"
        color="accent"
        inset
        hide-details
        @change="onEnabledChange"
      />
      <v-switch
        :input-value="config.restrictValues"
        :label="$t('trackingConfig.restrictValues')"
        :disabled="!config.enabled"
        color="accent"
        inset
        hide-details
        class="tracking-params__restrict-switch"
        @change="onRestrictValuesChange"
      />
    </div>

    <div v-if="config.enabled" class="params-table">
      <div class="params-table__header">
        <div class="params-table__col params-table__col--key">
          {{ $t('trackingConfig.key') }}
        </div>
        <div class="params-table__col params-table__col--values">
          {{ $t('trackingConfig.values') }}
        </div>
        <div class="params-table__col params-table__col--required">
          {{ $t('trackingConfig.required') }}
        </div>
        <div class="params-table__col params-table__col--actions">
          {{ $t('global.actions') }}
        </div>
      </div>

      <div v-if="config.params.length === 0" class="params-table__empty">
        {{ $t('trackingConfig.empty') }}
      </div>

      <div
        v-for="(param, index) in config.params"
        v-else
        :key="index"
        class="params-table__row"
      >
        <div class="params-table__col params-table__col--key">
          <bs-text-field
            :value="param.key"
            :error-messages="keyError(index) ? [keyError(index)] : []"
            placeholder="utm_source"
            hide-label
            dense
            @input="onKeyInput(index, $event)"
          />
        </div>
        <div class="params-table__col params-table__col--values">
          <bs-text-field
            :value="valuesInputs[index]"
            :placeholder="$t('trackingConfig.valuesHint')"
            hide-label
            dense
            @input="onValuesInput(index, $event)"
          />
        </div>
        <div class="params-table__col params-table__col--required">
          <v-checkbox
            :input-value="param.required"
            color="accent"
            hide-details
            class="ma-0 pa-0"
            @change="onRequiredChange(index, $event)"
          />
        </div>
        <div class="params-table__col params-table__col--actions">
          <v-btn
            icon
            small
            class="error--text"
            :disabled="loading"
            @click="removeParam(index)"
          >
            <lucide-trash2 :size="18" />
          </v-btn>
        </div>
      </div>

      <div class="params-table__add">
        <v-btn text small color="accent" @click="addParam">
          + {{ $t('trackingConfig.addParam') }}
        </v-btn>
      </div>
    </div>

    <v-divider class="mt-4" />
    <div class="form-actions">
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="loading || !canSave"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tracking-params {
  &__description {
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
    margin-bottom: 16px;
  }

  &__toggles {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 24px;
  }

  &__restrict-switch {
    margin-top: 4px;
  }
}

.params-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;

  &__header,
  &__row {
    display: flex;
    align-items: flex-start;
    padding: 8px 16px;
  }

  &__header {
    background: rgba(0, 0, 0, 0.02);
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    font-size: 11px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    height: 40px;
    align-items: center;
  }

  &__row {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    &:last-child {
      border-bottom: none;
    }
    &:hover {
      background: rgba(0, 172, 220, 0.05);
    }
  }

  &__col {
    &--key {
      width: 200px;
      flex-shrink: 0;
      padding-right: 16px;
    }
    &--values {
      flex: 1;
      padding-right: 16px;
    }
    &--required {
      width: 100px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 4px;
    }
    &--actions {
      width: 64px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 4px;
    }
  }

  &__empty {
    padding: 32px;
    text-align: center;
    color: rgba(0, 0, 0, 0.4);
    font-style: italic;
    font-size: 13px;
  }

  &__add {
    padding: 8px 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
}
</style>
