<script>
import { Replace } from 'lucide-vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import * as apiRoutes from '~/helpers/api-routes.js';
import { adoptionRows, gapReasonKey } from '~/helpers/template-adoption.js';

// The adoption of the template's emails in bulk (ADR-0024): what each email
// would take from its content, and what it cannot. A preview writes nothing.
export default {
  name: 'BsTemplateAdoption',
  components: { BsFormSection, BsDataTable, LucideReplace: Replace },
  props: {
    templateId: { type: String, required: true },
  },
  data: () => ({ report: null, loading: false, failed: false }),
  computed: {
    rows() {
      return adoptionRows(this.report);
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
    async preview() {
      this.loading = true;
      this.failed = false;
      try {
        this.report = await this.$axios.$get(
          apiRoutes.templatesItemAdoption({ templateId: this.templateId })
        );
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
        <v-btn
          color="accent"
          outlined
          :loading="loading"
          class="mb-4"
          @click="preview"
        >
          {{ $t('templates.adoption.preview') }}
        </v-btn>
        <p v-if="failed" class="error--text mb-0">
          {{ $t('templates.adoption.failed') }}
        </p>
        <template v-if="report">
          <p class="mb-3">
            {{ $t('templates.adoption.counts', report.counts) }}
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
  </v-card>
</template>
