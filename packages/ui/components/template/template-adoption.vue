<script>
import { Replace } from 'lucide-vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';
import * as apiRoutes from '~/helpers/api-routes.js';
import { adoptionRows, gapReasonKey } from '~/helpers/template-adoption.js';

// The adoption of the template's emails in bulk (ADR-0024): what each email
// would take from its content, and what it cannot. A preview writes nothing;
// applying writes the taxonomy values of the empty dimensions, never the
// content, and the report then says what was done.
export default {
  name: 'BsTemplateAdoption',
  components: {
    BsFormSection,
    BsDataTable,
    BsModalConfirm,
    LucideReplace: Replace,
  },
  props: {
    templateId: { type: String, required: true },
  },
  data: () => ({
    report: null,
    // Whether the report is what was done rather than what would be.
    applied: false,
    loading: false,
    failed: false,
  }),
  computed: {
    rows() {
      return adoptionRows(this.report);
    },
    canApply() {
      return Boolean(this.report) && !this.applied && this.rows.length > 0;
    },
    headers() {
      return [
        { text: this.$t('templates.adoption.email'), value: 'name' },
        { text: this.$t('templates.adoption.adopted'), value: 'adopted' },
        { text: this.$t('templates.adoption.gaps'), value: 'gaps' },
      ];
    },
  },
  methods: {
    gapReasonKey,
    preview() {
      return this.run('$get', false);
    },
    apply() {
      return this.run('$post', true);
    },
    async run(method, applied) {
      this.loading = true;
      this.failed = false;
      try {
        this.report = await this.$axios[method](
          apiRoutes.templatesItemAdoption({ templateId: this.templateId })
        );
        this.applied = applied;
      } catch (error) {
        this.failed = true;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <v-card flat tile class="template-adoption mt-4">
    <v-card-text>
      <bs-form-section last>
        <template #icon>
          <lucide-replace :size="20" />
        </template>
        <template #title>
          {{ $t('templates.adoption.title') }}
        </template>
        <template #description>
          {{ $t('templates.adoption.description') }}
        </template>
        <div class="template-adoption__actions mb-4">
          <v-btn color="accent" outlined :loading="loading" @click="preview">
            {{ $t('templates.adoption.preview') }}
          </v-btn>
          <v-btn
            v-if="canApply"
            color="accent"
            elevation="0"
            :disabled="loading"
            @click="$refs.confirm.open()"
          >
            {{ $t('templates.adoption.apply') }}
          </v-btn>
        </div>
        <p v-if="failed" class="error--text mb-0">
          {{ $t('templates.adoption.failed') }}
        </p>
        <template v-if="report">
          <p class="mb-3">
            {{
              $t(
                applied
                  ? 'templates.adoption.appliedCounts'
                  : 'templates.adoption.counts',
                report.counts
              )
            }}
          </p>
          <bs-data-table
            v-if="rows.length > 0"
            :headers="headers"
            :items="rows"
          >
            <template #item.adopted="{ item }">
              <div v-for="entry in item.adopted" :key="entry.dimension">
                <code>{{ entry.dimension }}</code> → {{ entry.identifier }}
              </div>
            </template>
            <template #item.gaps="{ item }">
              <div
                v-for="gap in item.gaps"
                :key="gap.dimension"
                class="error--text"
              >
                <code>{{ gap.dimension }}</code> «&nbsp;{{
                  gap.identifier
                }}&nbsp;» :
                {{ $t(gapReasonKey(gap.reason)) }}
              </div>
            </template>
          </bs-data-table>
        </template>
      </bs-form-section>
    </v-card-text>
    <bs-modal-confirm
      ref="confirm"
      :title="$t('templates.adoption.confirmTitle')"
      :action-label="$t('templates.adoption.apply')"
      action-button-color="accent"
      @confirm="apply"
    >
      <p class="black--text mb-0">
        {{ $t('templates.adoption.confirm', report ? report.counts : {}) }}
      </p>
    </bs-modal-confirm>
  </v-card>
</template>

<style scoped>
.template-adoption__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
