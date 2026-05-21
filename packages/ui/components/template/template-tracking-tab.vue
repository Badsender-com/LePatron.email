<script>
import { mapMutations } from 'vuex';
import { templatesItemTrackingConfig } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import { Trash2 } from 'lucide-vue';

function emptyConfig() {
  return {
    overrideGroupTracking: false,
    enabled: false,
    restrictValues: false,
    params: [],
  };
}

export default {
  name: 'TemplateTrackingTab',
  components: {
    BsTextField,
    LucideTrash2: Trash2,
  },
  props: {
    template: { type: Object, required: true },
    groupTrackingConfig: {
      type: Object,
      default: () => null,
    },
  },
  data() {
    return {
      localConfig: emptyConfig(),
      loading: false,
      valuesInputs: [],
    };
  },
  computed: {
    // Map the two persisted booleans (overrideGroupTracking + enabled) to a
    // single 3-way mode: easier to reason about UX-side. Backend storage is
    // unchanged; the setter writes both booleans according to the chosen mode.
    cascadeMode: {
      get() {
        const cfg = this.localConfig || {};
        if (cfg.enabled && cfg.overrideGroupTracking) return 'replace';
        if (cfg.enabled) return 'extend';
        return 'inherit';
      },
      set(mode) {
        if (mode === 'inherit') {
          this.localConfig.enabled = false;
          this.localConfig.overrideGroupTracking = false;
        } else if (mode === 'extend') {
          this.localConfig.enabled = true;
          this.localConfig.overrideGroupTracking = false;
        } else if (mode === 'replace') {
          this.localConfig.enabled = true;
          this.localConfig.overrideGroupTracking = true;
        }
      },
    },
    duplicateKeys() {
      const counts = {};
      (this.localConfig.params || []).forEach((p) => {
        const k = (p.key || '').trim().toLowerCase();
        if (!k) return;
        counts[k] = (counts[k] || 0) + 1;
      });
      return Object.entries(counts)
        .filter(([, n]) => n > 1)
        .map(([k]) => k);
    },
    hasInvalidKey() {
      return (this.localConfig.params || []).some(
        (p) => !p.key || !p.key.trim().length
      );
    },
    canSave() {
      return !this.hasInvalidKey && this.duplicateKeys.length === 0;
    },
    hasGroupConfig() {
      return !!(
        this.groupTrackingConfig &&
        this.groupTrackingConfig.enabled &&
        (this.groupTrackingConfig.params || []).length > 0
      );
    },
  },
  watch: {
    template: {
      immediate: true,
      handler(t) {
        const incoming = (t && t.trackingConfig) || emptyConfig();
        this.localConfig = JSON.parse(JSON.stringify(incoming));
        if (!Array.isArray(this.localConfig.params)) {
          this.localConfig.params = [];
        }
        this.syncValuesInputs();
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    syncValuesInputs() {
      this.valuesInputs = (this.localConfig.params || []).map((p) =>
        (p.values || []).join(', ')
      );
    },
    onRestrictValuesChange(value) {
      this.localConfig.restrictValues = Boolean(value);
    },
    addParam() {
      this.localConfig.params.push({
        key: '',
        values: [],
        required: false,
      });
      this.valuesInputs.push('');
    },
    removeParam(index) {
      this.localConfig.params.splice(index, 1);
      this.valuesInputs.splice(index, 1);
    },
    onKeyInput(index, value) {
      this.localConfig.params[index].key = value;
    },
    onValuesInput(index, raw) {
      this.valuesInputs[index] = raw;
      const cleaned = raw
        .split(/[,\n]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      this.localConfig.params[index].values = Array.from(new Set(cleaned));
    },
    onRequiredChange(index, value) {
      this.localConfig.params[index].required = Boolean(value);
    },
    keyError(index) {
      const p = this.localConfig.params[index];
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
          templatesItemTrackingConfig({ templateId: this.template.id }),
          this.localConfig
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
  <div class="template-tracking">
    <p class="template-tracking__description">
      {{ $t('trackingConfig.description') }}
    </p>

    <!-- Inherited group config preview -->
    <div v-if="hasGroupConfig" class="template-tracking__inherited">
      <div class="template-tracking__inherited-title">
        {{ $t('trackingConfig.inheritedFromGroup') }}
      </div>
      <div class="template-tracking__inherited-list">
        <span
          v-for="p in groupTrackingConfig.params"
          :key="p.key"
          class="template-tracking__inherited-tag"
        >
          {{ p.key }}<span v-if="p.required">*</span>
        </span>
      </div>
    </div>

    <v-radio-group
      v-model="cascadeMode"
      class="template-tracking__mode"
      hide-details
      :label="$t('trackingConfig.cascade.label')"
    >
      <v-radio value="inherit" color="accent">
        <template #label>
          <div class="template-tracking__mode-option">
            <span class="template-tracking__mode-title">
              {{ $t('trackingConfig.cascade.inherit') }}
            </span>
            <span class="template-tracking__mode-description">
              {{ $t('trackingConfig.cascade.inheritDescription') }}
            </span>
          </div>
        </template>
      </v-radio>
      <v-radio value="extend" color="accent">
        <template #label>
          <div class="template-tracking__mode-option">
            <span class="template-tracking__mode-title">
              {{ $t('trackingConfig.cascade.extend') }}
            </span>
            <span class="template-tracking__mode-description">
              {{ $t('trackingConfig.cascade.extendDescription') }}
            </span>
          </div>
        </template>
      </v-radio>
      <v-radio value="replace" color="accent">
        <template #label>
          <div class="template-tracking__mode-option">
            <span class="template-tracking__mode-title">
              {{ $t('trackingConfig.cascade.replace') }}
            </span>
            <span class="template-tracking__mode-description">
              {{ $t('trackingConfig.cascade.replaceDescription') }}
            </span>
          </div>
        </template>
      </v-radio>
    </v-radio-group>

    <v-switch
      :input-value="localConfig.restrictValues"
      :label="$t('trackingConfig.restrictValues')"
      :disabled="!localConfig.enabled"
      color="accent"
      inset
      hide-details
      class="mt-2"
      @change="onRestrictValuesChange"
    />

    <div v-if="localConfig.enabled" class="params-table mt-4">
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

      <div v-if="localConfig.params.length === 0" class="params-table__empty">
        {{ $t('trackingConfig.empty') }}
      </div>

      <div
        v-for="(param, index) in localConfig.params"
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
.template-tracking {
  &__description {
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
    margin-bottom: 16px;
  }

  &__inherited {
    background: rgba(0, 172, 220, 0.06);
    border: 1px solid rgba(0, 172, 220, 0.2);
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 16px;

    &-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 6px;
    }

    &-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    &-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      background: white;
      border: 1px solid rgba(0, 172, 220, 0.4);
      color: #0277bd;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
    }
  }

  &__mode {
    margin-top: 0;
    margin-bottom: 16px;

    /deep/ legend.v-label {
      font-size: 11px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }

    /deep/ .v-radio {
      margin-bottom: 8px;
      align-items: flex-start;
    }
  }

  &__mode-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__mode-title {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.87);
    line-height: 1.3;
  }

  &__mode-description {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    line-height: 1.4;
  }
}

.params-table {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;

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
