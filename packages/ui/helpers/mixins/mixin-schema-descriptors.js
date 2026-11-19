import { aiSkillSchemaDescriptor } from '~/helpers/ai-skill-routes.js';

// The input-schema descriptors of a skill's feature versions, which power the
// placeholder helper of the feature fields (§C2). Loaded once per schema id,
// as soon as the panel mounts or a draft switches its input schema, so the
// helper is ready when a version is opened.
//
// The host component uses mixin-version-drafts: it reads `sortedVersions`
// and `draftFor`.
export default {
  data() {
    return {
      // schemaId → descriptor|null. Null means "unknown / failed to load".
      descriptorCache: {},
    };
  },
  computed: {
    // Watched as a stable string so a change to any version's input schema
    // triggers a descriptor (re)load. Reads the drafts, not the server
    // documents: switching the schema in the select must load its descriptor
    // before the draft is saved.
    inputSchemaIds() {
      return this.sortedVersions
        .map((v) => this.draftInputSchemaId(v) || '')
        .join(',');
    },
  },
  watch: {
    inputSchemaIds() {
      this.ensureDescriptors();
    },
  },
  mounted() {
    this.ensureDescriptors();
  },
  methods: {
    // The schema id currently shown for a version: its draft value while the
    // panel is open, the server value otherwise.
    draftInputSchemaId(v) {
      const draft = this.draftFor(v);
      return draft ? draft.inputSchemaId : v.inputSchemaId;
    },
    ensureDescriptors() {
      const ids = new Set(
        this.sortedVersions
          .map((v) => this.draftInputSchemaId(v))
          .filter(Boolean)
      );
      ids.forEach((id) => this.loadDescriptor(id));
    },
    async loadDescriptor(schemaId) {
      if (!schemaId || schemaId in this.descriptorCache) return;
      // Reserve the slot so concurrent expansions don't double-fetch.
      this.$set(this.descriptorCache, schemaId, null);
      try {
        const d = await this.$axios.$get(aiSkillSchemaDescriptor(schemaId));
        this.$set(this.descriptorCache, schemaId, d);
      } catch (e) {
        this.$set(this.descriptorCache, schemaId, null);
      }
    },
    // A version's input-schema descriptor, null while loading or unknown.
    descriptorFor(v) {
      const schemaId = this.draftInputSchemaId(v);
      return (schemaId && this.descriptorCache[schemaId]) || null;
    },
  },
};
