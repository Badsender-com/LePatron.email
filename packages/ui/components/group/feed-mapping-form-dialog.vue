<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';

const MAX_COLUMNS = 4;
// The feed item properties this app's RSS provider actually normalizes
// (packages/server/integration-providers/data-feed/rss-provider.js) — these
// are the only real sources a block field can be filled from. `ctaLabel` is
// the one exception: it's not a feed property, it's a sentinel meaning
// "use the static default CTA label typed in below".
const FEED_PROPERTIES = ['title', 'link', 'description', 'image', 'pubDate'];

function emptyForm() {
  return {
    integrationId: '',
    templateId: '',
    blockName: '',
    columnCount: 1,
    fieldMapping: [{}],
    ctaDefaultLabel: '',
    isActive: true,
  };
}

export default {
  name: 'BsFeedMappingFormDialog',
  components: { BsTextField, BsSelect },
  mixins: [validationMixin],
  props: {
    feedMapping: { type: Object, default: null },
    integrations: { type: Array, default: () => [] },
    groupId: { type: String, required: true },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      form: emptyForm(),
      templates: [],
      blocks: [],
      // Every block's field paths, keyed by block name, fetched in one shot
      // with the block list. Selecting a block then reads from here instead of
      // firing a per-block request — parsing the template markup is expensive
      // server-side, so we parse it once per template rather than once per block.
      fieldsByBlock: {},
      blockFields: [],
      loadingBlocks: false,
    };
  },
  computed: {
    isEdit() {
      return !!this.feedMapping;
    },
    // A block was picked but has no mappable field: a feed item has nowhere to
    // land, so saving would produce an empty mapping that imports nothing.
    hasNoFieldsForBlock() {
      return !!this.form.blockName && !this.blockFields.length;
    },
    title() {
      return this.isEdit
        ? this.$t('feedMappings.edit')
        : this.$t('feedMappings.add');
    },
    integrationOptions() {
      return this.integrations.map((integration) => ({
        value: integration._id,
        text: integration.name,
      }));
    },
    templateOptions() {
      return this.templates.map((template) => ({
        value: template._id,
        text: template.name,
      }));
    },
    blockOptions() {
      return this.blocks.map((block) => ({ value: block, text: block }));
    },
    // What each row's dropdown offers: "ignore this field" (empty), every
    // real feed property, and the static-CTA-label sentinel.
    feedPropertyOptions() {
      return [
        { value: '', text: this.$t('feedMappings.roleNone') },
        ...FEED_PROPERTIES.map((property) => ({
          value: property,
          text: this.$t(`feedMappings.feedFields.${property}`),
        })),
        {
          value: 'ctaLabel',
          text: this.$t('feedMappings.feedFields.ctaLabel'),
        },
      ];
    },
    columnCountOptions() {
      return Array.from({ length: MAX_COLUMNS }, (_, i) => ({
        value: i + 1,
        text: String(i + 1),
      }));
    },
  },
  watch: {
    // Populating the form for edit and reacting to the user picking a new
    // template/block are deliberately NOT both driven by a single reactive
    // watcher on `form.templateId`/`form.blockName` — that would fire on both
    // the initial (edit) population AND on user interaction, with no way to
    // tell them apart, so a "reset block on template change" rule would wipe
    // out the block we just restored for editing. Explicit change handlers
    // (below) own the "user changed the dropdown" side effects instead.
    feedMapping: {
      immediate: true,
      async handler(val) {
        this.blocks = [];
        this.fieldsByBlock = {};
        this.blockFields = [];
        if (val) {
          const columns = Array.isArray(val.fieldMapping)
            ? val.fieldMapping
            : [];
          this.form = {
            integrationId: val._integration,
            templateId: val._template,
            blockName: val.blockName,
            columnCount: columns.length || 1,
            fieldMapping: columns.length
              ? columns.map((column) => ({ ...column }))
              : [{}],
            ctaDefaultLabel: val.ctaDefaultLabel || '',
            isActive: val.isActive !== false,
          };
          if (val._template) {
            await this.fetchBlocks(val._template);
            // Field paths for the block being edited now come straight from the
            // batch payload — no extra request.
            if (val.blockName) {
              this.blockFields = this.fieldsByBlock[val.blockName] || [];
            }
          }
        } else {
          this.resetForm();
        }
      },
    },
  },
  mounted() {
    this.fetchTemplates();
  },
  validations: {
    form: {
      integrationId: { required },
      templateId: { required },
      blockName: { required },
    },
  },
  methods: {
    resetForm() {
      this.form = emptyForm();
      this.blocks = [];
      this.fieldsByBlock = {};
      this.blockFields = [];
      this.$v.$reset();
    },

    async fetchTemplates() {
      const { items } = await this.$axios.$get(
        apiRoutes.groupsItemTemplates({ groupId: this.groupId })
      );
      this.templates = items || [];
    },

    // One request per template: the block list AND every block's field paths.
    // The server parses the (expensive-to-parse) markup a single time; picking
    // a block afterwards is a pure client-side lookup with no further request.
    async fetchBlocks(templateId) {
      this.loadingBlocks = true;
      try {
        const { blocks, fieldsByBlock } = await this.$axios.$get(
          apiRoutes.templatesItemBlocksWithFields({ templateId })
        );
        this.blocks = blocks || [];
        this.fieldsByBlock = fieldsByBlock || {};
      } finally {
        this.loadingBlocks = false;
      }
    },

    onTemplateChange(templateId) {
      this.form.templateId = templateId;
      this.form.blockName = '';
      this.blocks = [];
      this.fieldsByBlock = {};
      this.blockFields = [];
      if (templateId) this.fetchBlocks(templateId);
    },

    onBlockChange(blockName) {
      this.form.blockName = blockName;
      // Field paths are specific to the previous block — a mapping carried
      // over from it wouldn't make sense for a different one.
      this.form.columnCount = 1;
      this.form.fieldMapping = [{}];
      // Already fetched with the block list — no request needed.
      this.blockFields = blockName ? this.fieldsByBlock[blockName] || [] : [];
    },

    // Multi-column blocks (e.g. a 3-across article block) need one field
    // mapping per column — grows/shrinks the array to match, keeping
    // whatever's already filled in for columns that stay.
    onColumnCountChange(count) {
      this.form.columnCount = count;
      const current = this.form.fieldMapping;
      if (count > current.length) {
        this.form.fieldMapping = [
          ...current,
          ...Array.from({ length: count - current.length }, () => ({})),
        ];
      } else if (count < current.length) {
        this.form.fieldMapping = current.slice(0, count);
      }
    },

    // Each column is a plain { [blockFieldPath]: feedProperty } map, keyed
    // directly by the block field itself — no fixed set of roles, so any
    // number of fields can be mapped (including none), and nothing stops
    // two different fields sharing the same feed property.
    roleForField(column, field) {
      return column[field] || '';
    },

    // Vue 2 can't observe plain property addition/deletion on an object, so
    // $set/$delete are required here — `column[field] = role` would silently
    // fail to trigger the select's reactive update.
    setFieldRole(column, field, role) {
      if (role) {
        this.$set(column, field, role);
      } else {
        this.$delete(column, field);
      }
    },

    fieldErrors(fieldName) {
      const field = this.$v.form[fieldName];
      if (!field || !field.$dirty) return [];
      if (!field.required) return [this.$t('global.errors.required')];
      return [];
    },

    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid || this.hasNoFieldsForBlock) return;

      const { columnCount: _columnCount, ...payload } = this.form;
      this.$emit('save', payload);
    },

    onCancel() {
      this.resetForm();
      this.$emit('cancel');
    },
  },
};
</script>

<template>
  <v-card>
    <v-card-title>
      <span class="headline">{{ title }}</span>
    </v-card-title>

    <v-card-text>
      <v-form @submit.prevent="onSubmit">
        <bs-select
          v-model="form.integrationId"
          :items="integrationOptions"
          :label="$t('feedMappings.integration')"
          :error-messages="fieldErrors('integrationId')"
          :disabled="loading"
          required
          @blur="$v.form.integrationId.$touch()"
        />

        <bs-select
          :value="form.templateId"
          :items="templateOptions"
          :label="$t('feedMappings.template')"
          :error-messages="fieldErrors('templateId')"
          :disabled="loading"
          required
          @input="onTemplateChange"
          @blur="$v.form.templateId.$touch()"
        />

        <bs-select
          :value="form.blockName"
          :items="blockOptions"
          :label="$t('feedMappings.block')"
          :hint="loadingBlocks ? $t('feedMappings.loadingBlocks') : ''"
          :error-messages="fieldErrors('blockName')"
          :disabled="loading || !form.templateId"
          required
          @input="onBlockChange"
          @blur="$v.form.blockName.$touch()"
        />

        <v-alert
          v-if="hasNoFieldsForBlock"
          type="warning"
          text
          dense
          class="feed-mapping-no-fields"
        >
          {{ $t('feedMappings.noBlockFields') }}
        </v-alert>

        <template v-if="form.blockName && blockFields.length">
          <bs-select
            :value="form.columnCount"
            :items="columnCountOptions"
            :label="$t('feedMappings.columnCount')"
            :hint="$t('feedMappings.columnCountHint')"
            :disabled="loading"
            @input="onColumnCountChange"
          />

          <div
            v-for="(column, index) in form.fieldMapping"
            :key="index"
            class="feed-mapping-column"
          >
            <div
              v-if="form.fieldMapping.length > 1"
              class="feed-mapping-column__label"
            >
              {{ $t('feedMappings.column', { n: index + 1 }) }}
            </div>

            <table class="feed-mapping-fields-table">
              <thead>
                <tr>
                  <th>{{ $t('feedMappings.fieldColumnHeader') }}</th>
                  <th>{{ $t('feedMappings.roleColumnHeader') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="field in blockFields"
                  :key="field"
                  :class="{ 'is-mapped': roleForField(column, field) }"
                >
                  <td class="feed-mapping-fields-table__field">
                    {{ field }}
                  </td>
                  <td>
                    <bs-select
                      :value="roleForField(column, field)"
                      :items="feedPropertyOptions"
                      :disabled="loading"
                      @input="(role) => setFieldRole(column, field, role)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <bs-text-field
            v-model="form.ctaDefaultLabel"
            :label="$t('feedMappings.ctaDefaultLabel')"
            :hint="$t('feedMappings.ctaDefaultLabelHint')"
            :disabled="loading"
          />
        </template>

        <v-switch
          v-model="form.isActive"
          :label="$t('feedMappings.active')"
          :disabled="loading"
          color="accent"
        />
      </v-form>
    </v-card-text>

    <v-divider />
    <div class="modal-actions">
      <v-btn text color="primary" :disabled="loading" @click="onCancel">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        color="accent"
        elevation="0"
        :loading="loading"
        :disabled="hasNoFieldsForBlock"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </v-card>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
}

.feed-mapping-no-fields {
  margin-top: 0.5rem;
}

.feed-mapping-column {
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 4px;

  &__label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.5rem;
  }
}

.feed-mapping-fields-table {
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  display: block;
  border-collapse: collapse;

  thead,
  tbody {
    display: block;
  }

  tr {
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  th,
  td {
    padding: 6px 8px;
  }

  th {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.5);
  }

  &__field {
    flex: 1 1 auto;
    font-family: monospace;
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  td:last-child,
  th:last-child {
    flex: 0 0 220px;
  }

  tr.is-mapped {
    background: rgba(0, 172, 220, 0.06);
  }
}
</style>
