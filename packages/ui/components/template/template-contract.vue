<script>
import { Braces } from 'lucide-vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import { contractSummary } from '~/helpers/template-contract.js';

// What the template declares and reads at its root (ADR-0024): the dimensions
// of the same names are offered on its emails, and the values of renamed
// properties are adopted from their declared source.
export default {
  name: 'BsTemplateContract',
  components: { BsFormSection, LucideBraces: Braces },
  props: {
    contract: { type: Object, default: null },
  },
  computed: {
    summary() {
      return contractSummary(this.contract);
    },
  },
};
</script>

<template>
  <v-card flat tile class="template-contract mt-4">
    <v-card-text>
      <bs-form-section last>
        <template #icon>
          <lucide-braces :size="20" />
        </template>
        <template #title>
          {{ $t('templates.contract.title') }}
        </template>
        <template #description>
          {{ $t('templates.contract.description') }}
        </template>
        <p v-if="summary.names.length === 0" class="text--secondary mb-0">
          {{ $t('templates.contract.empty') }}
        </p>
        <div v-else class="template-contract__names">
          <code v-for="name in summary.names" :key="name">{{ name }}</code>
        </div>
        <p
          v-for="adoption in summary.adopted"
          :key="adoption.name"
          class="text--secondary mt-3 mb-0"
        >
          {{
            $t('templates.contract.adopted', {
              name: adoption.name,
              source: adoption.source,
            })
          }}
        </p>
      </bs-form-section>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.template-contract__names {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
