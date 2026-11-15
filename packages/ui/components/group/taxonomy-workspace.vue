<script>
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import mixinTaxonomyDimensionActions from '~/helpers/mixins/mixin-taxonomy-dimension-actions.js';
import mixinTaxonomyWorkspaceData from '~/helpers/mixins/mixin-taxonomy-workspace-data.js';
import { Plus } from 'lucide-vue';
import BsTaxonomyDimensionFormDialog from '~/components/group/taxonomy-dimension-form-dialog.vue';
import BsTaxonomyDimensionMoveDialog from '~/components/group/taxonomy-dimension-move-dialog.vue';
import BsModalConfirm from '~/components/modal-confirm';
import BsTaxonomyWorkspaceTree from '~/components/group/taxonomy-workspace-tree.vue';
import BsTaxonomyWorkspaceDetail from '~/components/group/taxonomy-workspace-detail.vue';
import BsTaxonomyTemplatePreview from '~/components/group/taxonomy-template-preview.vue';
import {
  dimensionTree,
  segmentsOf,
  workspaceSelection,
} from '~/helpers/taxonomy-tree.js';
import {
  DIMENSIONS_PER_COMPANY,
  sortDimensions,
  resolutionOrder,
} from '~/helpers/taxonomy-builder.js';

// The segments the workspace shows so far; the others come with their
// tickets of epic #1547 (crossings, defaults, tokens, templates).
const IMPLEMENTED_SEGMENTS = [
  'values',
  'crossings',
  'defaults',
  'templates',
  'settings',
];

/**
 * The taxonomy workspace (ADR-0026): the tree of dimensions on the left, the
 * selected dimension on the right, in segments. The dimension and the segment
 * live in the URL (`?dimension=language&tab=settings`).
 */
export default {
  name: 'BsTaxonomyWorkspace',
  components: {
    BsTaxonomyWorkspaceTree,
    BsTaxonomyWorkspaceDetail,
    BsTaxonomyTemplatePreview,
    BsTaxonomyDimensionFormDialog,
    BsTaxonomyDimensionMoveDialog,
    BsModalConfirm,
    LucidePlus: Plus,
  },
  mixins: [
    mixinTaxonomyManage,
    mixinTaxonomyDimensionActions,
    mixinTaxonomyWorkspaceData,
  ],
  data() {
    return {
      treeOpen: false,
    };
  },
  computed: {
    isPreview() {
      return this.$route.query.view === 'preview';
    },
    treeRows() {
      return dimensionTree({
        dimensions: this.dimensions,
        values: Object.values(this.valuesByType).flat(),
      });
    },
    selection() {
      return workspaceSelection({
        dimensions: this.dimensions,
        query: this.$route.query,
        available: IMPLEMENTED_SEGMENTS,
      });
    },
    selected() {
      return this.byName[this.selection.dimension] || null;
    },
    segments() {
      return segmentsOf(this.selected).filter((segment) =>
        IMPLEMENTED_SEGMENTS.includes(segment)
      );
    },
    groupId() {
      return this.$route.params.groupId;
    },
    byName() {
      return Object.fromEntries(
        sortDimensions(this.dimensions).map((dimension) => [
          dimension.name,
          dimension,
        ])
      );
    },
    // Told before the click rather than by a refusal: the standard dimensions
    // count, as the server counts them.
    isFull() {
      return this.dimensions.length >= DIMENSIONS_PER_COMPANY;
    },
    // What the template receives when two chosen values carry one token.
    resolution() {
      const labels = Object.fromEntries(
        this.dimensions.map((dimension) => [dimension.name, dimension.label])
      );
      return resolutionOrder(this.dimensions).map((name) => labels[name]);
    },
    dimensionLimit() {
      return DIMENSIONS_PER_COMPANY;
    },
  },
  watch: {
    // A super admin switching company keeps this component mounted.
    groupId() {
      this.fetchDimensions();
      this.fetchTemplates();
    },
  },
  mounted() {
    this.fetchDimensions();
    this.fetchTemplates();
  },
  methods: {
    openPreview(template) {
      if (this.$refs.detail && !this.$refs.detail.confirmLeave()) return;
      this.treeOpen = false;
      this.$router.push({ query: { view: 'preview', template } });
    },

    select(name, tab = 'values') {
      if (this.$refs.detail && !this.$refs.detail.confirmLeave()) return;
      this.treeOpen = false;
      if (name === this.selection.dimension && tab === this.selection.tab) {
        return;
      }
      this.$router.push({
        query: { dimension: name, tab },
      });
    },
  },
};
</script>

<template>
  <div
    class="taxonomy-workspace"
    :class="{ 'taxonomy-workspace--tree-open': treeOpen }"
  >
    <bs-taxonomy-workspace-tree
      class="taxonomy-workspace__tree"
      :rows="treeRows"
      :selected="isPreview ? null : selection.dimension"
      :preview-on="isPreview"
      :reorderable="canManageTaxonomy && !saving"
      @preview="openPreview(null)"
      @select="select"
      @reorder="reorderDimensions"
    >
      <template #foot>
        <v-btn
          v-if="canManageTaxonomy"
          text
          small
          color="accent"
          :disabled="isFull || saving"
          @click="openDeclareForm()"
        >
          <lucide-plus :size="16" class="mr-1" />
          {{ $t('taxonomy.dimensions.declare') }}
        </v-btn>
        <p v-if="isFull" class="taxonomy-workspace__hint">
          {{ $t('taxonomy.dimensions.full', { limit: dimensionLimit }) }}
        </p>
        <p v-if="resolution.length > 1" class="taxonomy-workspace__hint">
          {{
            $t('taxonomy.dimensions.resolution', {
              order: resolution.join(' → '),
            })
          }}
        </p>
      </template>
    </bs-taxonomy-workspace-tree>

    <bs-taxonomy-template-preview
      v-if="isPreview"
      class="taxonomy-workspace__detail"
      :templates="templates"
      :template-id="$route.query.template || null"
      :dimensions="dimensions"
      :values="Object.values(valuesByType).flat()"
      @select-template="openPreview"
    />
    <bs-taxonomy-workspace-detail
      v-else-if="selected"
      ref="detail"
      :templates="templates"
      :values-by-type="valuesByType"
      class="taxonomy-workspace__detail"
      :dimension="selected"
      :parent="byName[selected.parentName] || null"
      :segments="segments"
      :tab="selection.tab"
      :tree-open="treeOpen"
      @preview="openPreview"
      @saved="fetchValues"
      @error="reportError"
      @toggle-tree="treeOpen = !treeOpen"
      @select-tab="select(selected.name, $event)"
      @edit="openEditForm"
      @move="openMoveForm"
      @add-child="openDeclareForm($event.name)"
      @toggle-active="toggleActive"
      @delete="confirmDelete"
      @count="setCount(selected.name, $event)"
    />

    <bs-modal-confirm
      ref="deleteModal"
      :title="$t('taxonomy.dimensions.deleteConfirmTitle')"
      :action-label="$t('global.delete')"
      @confirm="deleteDimension"
    >
      <p v-if="deletingDimension">
        {{
          $t('taxonomy.dimensions.deleteConfirmMessage', {
            label: deletingDimension.label,
          })
        }}
      </p>
    </bs-modal-confirm>

    <bs-taxonomy-dimension-move-dialog
      ref="moveDialog"
      :loading="saving"
      :dimensions="dimensions"
      @save="moveDimension"
    />

    <bs-taxonomy-dimension-form-dialog
      ref="formDialog"
      :loading="saving"
      :dimensions="dimensions"
      @save="saveDimension"
    />
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-workspace {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  align-items: start;

  &__tree {
    position: sticky;
    top: 16px;
    padding: 8px;
    background: #fff;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
  }

  &__detail {
    min-width: 0;
  }

  &__hint {
    margin: 8px 0 0;
    padding: 0 10px;
    color: var(--gray-700);
    font-size: 12px;
  }

  // Under 960 px the tree folds into a drawer, opened from the bar.
  @media (max-width: 959px) {
    grid-template-columns: minmax(0, 1fr);

    &__tree {
      display: none;
      position: static;
    }

    &--tree-open &__tree {
      display: flex;
    }
  }
}
</style>
