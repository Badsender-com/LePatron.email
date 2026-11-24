<script>
import { AlertTriangle } from 'lucide-vue';
import * as apiRoutes from '~/helpers/api-routes.js';

/**
 * Shown in a value's panel while its identifier differs from the saved one
 * (ADR-0026): the emails carrying the value, the templates comparing the old
 * identifier. With neither, the change is free. Otherwise the admin confirms
 * it (`input` true) or keeps the old one (`keep`). An impact that could not be
 * worked out is offered again, never taken as free.
 */
export default {
  name: 'BsTaxonomyIdentifierImpact',
  components: { LucideAlertTriangle: AlertTriangle },
  props: {
    itemId: { type: String, required: true },
    label: { type: String, default: '' },
    previous: { type: String, default: '' },
    next: { type: String, default: '' },
    // Whether the change is confirmed.
    value: { type: Boolean, default: false },
  },
  data() {
    return { impact: null, loading: false, failed: false, request: 0 };
  },
  computed: {
    needsConfirmation() {
      return (
        !!this.impact &&
        (this.impact.emails > 0 || this.impact.templates.length > 0)
      );
    },
  },
  watch: {
    itemId: 'fetch',
  },
  mounted() {
    this.fetch();
  },
  methods: {
    async fetch() {
      // A late answer for another value is dropped.
      const request = ++this.request;
      this.loading = true;
      this.failed = false;
      try {
        const impact = await this.$axios.$get(
          apiRoutes.taxonomyItemIdentifierImpact(this.itemId)
        );
        if (request !== this.request) return;
        this.impact = impact;
        if (!this.needsConfirmation) this.$emit('input', true);
      } catch (error) {
        if (request !== this.request) return;
        this.impact = null;
        this.failed = true;
      } finally {
        if (request === this.request) this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="identifier-impact">
    <strong class="identifier-impact__title">
      <lucide-alert-triangle :size="16" />
      {{ $t('taxonomy.workspace.impact.title', { label }) }}
    </strong>
    <p v-if="loading" class="mb-0" role="status">
      {{ $t('taxonomy.workspace.impact.checking') }}
    </p>
    <div v-else-if="failed" class="identifier-impact__actions" role="alert">
      <span class="identifier-impact__failed">
        {{ $t('taxonomy.workspace.impact.failed') }}
      </span>
      <v-btn text small color="accent" @click="fetch">
        {{ $t('taxonomy.workspace.impact.retry') }}
      </v-btn>
    </div>
    <template v-else-if="impact">
      <p v-if="!needsConfirmation" class="mb-0">
        {{ $t('taxonomy.workspace.impact.free', { label, previous }) }}
      </p>
      <template v-else>
        <p class="mb-1">
          {{
            $tc('taxonomy.workspace.impact.emails', impact.emails, {
              label,
              next,
              n: impact.emails,
            })
          }}
        </p>
        <p v-if="impact.templates.length" class="mb-1">
          {{ $t('taxonomy.workspace.impact.templates', { previous }) }}
        </p>
        <p v-else class="mb-1">
          {{ $t('taxonomy.workspace.impact.noTemplate', { previous }) }}
        </p>
        <ul v-if="impact.templates.length">
          <li v-for="template in impact.templates" :key="template.id">
            {{ template.name }} ·
            {{
              $tc(
                'taxonomy.workspace.impact.comparisons',
                template.comparisons,
                { n: template.comparisons }
              )
            }}
          </li>
        </ul>
        <p v-if="value" class="identifier-impact__confirmed mb-0">
          {{ $t('taxonomy.workspace.impact.confirmed') }}
        </p>
        <div v-else class="identifier-impact__actions" role="alert">
          <v-btn text small @click="$emit('keep')">
            {{ $t('taxonomy.workspace.impact.keep', { previous }) }}
          </v-btn>
          <v-btn
            small
            color="error"
            elevation="0"
            @click="$emit('input', true)"
          >
            {{ $t('taxonomy.workspace.impact.confirm') }}
          </v-btn>
        </div>
      </template>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.identifier-impact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 16px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 180, 0, 0.6);
  background: rgba(255, 180, 0, 0.08);
  border-radius: 7px;
  font-size: 13px;

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__confirmed {
    font-weight: 600;
  }

  &__failed {
    flex: 1;
    align-self: center;
  }
}
</style>
