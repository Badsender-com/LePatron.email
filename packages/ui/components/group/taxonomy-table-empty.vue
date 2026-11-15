<script>
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import { Tags, AlertTriangle } from 'lucide-vue';

/**
 * What the values table shows with no row: a read that failed, or a
 * dimension with no value yet. Emits `retry`, `create` and `restore-defaults`.
 */
export default {
  name: 'BsTaxonomyTableEmpty',
  components: { LucideTags: Tags, LucideAlertTriangle: AlertTriangle },
  mixins: [mixinTaxonomyManage],
  props: {
    loadError: { type: Boolean, default: false },
    isEmailType: { type: Boolean, default: true },
    wording: { type: String, default: 'taxonomy' },
    // A deactivated dimension takes no new value.
    canCreate: { type: Boolean, default: true },
  },
};
</script>

<template>
  <div>
    <div v-if="loadError" class="text-center pa-6">
      <lucide-alert-triangle :size="48" class="error--text" />
      <p class="text-body-1 grey--text text--darken-2 mt-4 mb-1">
        {{ $t(`${wording}.loadError.title`) }}
      </p>
      <p class="text-body-2 grey--text text--darken-1">
        {{ $t('taxonomy.loadError.description') }}
      </p>
      <v-btn color="accent" elevation="0" @click="$emit('retry')">
        {{ $t('taxonomy.loadError.action') }}
      </v-btn>
    </div>
    <div v-else class="text-center pa-6">
      <lucide-tags :size="48" class="grey--text text--lighten-1" />
      <p class="text-body-1 grey--text mt-4 mb-1">
        {{ $t(`${wording}.empty.title`) }}
      </p>
      <p class="text-body-2 grey--text text--darken-1">
        {{ $t(`${wording}.empty.description`) }}
      </p>
      <div
        v-if="canManageTaxonomy && canCreate"
        class="d-flex justify-center flex-wrap"
        style="gap: 0.5rem"
      >
        <v-btn color="accent" elevation="0" @click="$emit('create')">
          {{ $t(`${wording}.empty.action`) }}
        </v-btn>
        <!-- The likeliest reason this screen is empty: a company created
           before the defaults were seeded. Offering the rebuild here, where
           the user actually is, rather than only in the page header. -->
        <v-btn
          v-if="isEmailType"
          color="accent"
          outlined
          @click="$emit('restore-defaults')"
        >
          {{ $t('taxonomy.defaults.action') }}
        </v-btn>
      </div>
    </div>
  </div>
</template>
