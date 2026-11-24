import * as apiRoutes from '~/helpers/api-routes.js';
import { STANDARD_DIMENSIONS } from '~/helpers/taxonomy-builder.js';
import { pointsToCheck, pointsByDimension } from '~/helpers/taxonomy-checks.js';

/**
 * What the taxonomy workspace reads (ADR-0026): the company's dimensions,
 * their values (for the tree's counts, the crossings, the defaults, the
 * preview and the points to check), and its templates with their contract.
 *
 * A late answer is dropped: one for a company the super admin has left, or
 * for a dimension read again since. The points to check wait for all three
 * reads, and are not computed when one failed: a missing answer would read
 * as a missing value.
 */
export default {
  data() {
    return {
      dimensions: [],
      // Values per dimension name.
      valuesByType: {},
      // `{ id, name, contract }`, by name.
      templates: [],
      // Raised on each change of company: answers of an older one are dropped.
      generation: 0,
      // The latest request per dimension name, and for the dimensions.
      requests: {},
      loaded: { dimensions: false, values: false, templates: false },
      loadFailed: false,
    };
  },
  computed: {
    allValues() {
      return Object.values(this.valuesByType).flat();
    },
    isLoaded() {
      const { dimensions, values, templates } = this.loaded;
      return dimensions && values && templates && !this.loadFailed;
    },
    // What the taxonomy lacks, never blocking (ADR-0026).
    points() {
      if (!this.isLoaded) return [];
      return pointsToCheck({
        dimensions: this.dimensions,
        values: this.allValues,
        templates: this.templates,
      });
    },
    pointCounts() {
      return pointsByDimension(this.points);
    },
  },
  watch: {
    points(points) {
      this.$emit('points', points.length);
    },
    dimensions(dimensions) {
      this.$emit('loaded', dimensions);
    },
  },
  methods: {
    // Everything again, for the company in the URL.
    loadAll() {
      this.generation += 1;
      this.requests = {};
      this.dimensions = [];
      this.valuesByType = {};
      this.templates = [];
      this.loaded = { dimensions: false, values: false, templates: false };
      this.loadFailed = false;
      this.fetchDimensions();
      this.fetchTemplates();
    },

    // A function telling whether the answer it started is still the latest.
    track(key) {
      const generation = this.generation;
      const request = (this.requests[key] || 0) + 1;
      this.requests = { ...this.requests, [key]: request };
      return () =>
        generation === this.generation && this.requests[key] === request;
    },

    reportLoadError() {
      this.loadFailed = true;
      this.showSnackbar({
        text: this.$t('taxonomy.dimensions.loadError'),
        color: 'error',
      });
    },

    async fetchDimensions() {
      const isLatest = this.track('dimensions');
      try {
        const response = await this.$axios.$get(
          apiRoutes.taxonomyDimensions(this.groupId, {
            lang: this.$i18n.locale,
          })
        );
        if (!isLatest()) return;
        this.dimensions = response.items || [];
        this.loaded = { ...this.loaded, dimensions: true };
        await this.fetchValues();
      } catch (error) {
        if (isLatest()) this.reportLoadError();
      }
    },

    /**
     * @param {string[]} [names] the dimensions to read again; all by default
     */
    async fetchValues(names = null) {
      const named = this.dimensions
        .map((dimension) => dimension.name)
        .filter((name) => name !== STANDARD_DIMENSIONS.TRIGGER)
        .filter((name) => !names || names.includes(name));
      let failed = false;
      await Promise.all(
        named.map(async (name) => {
          const isLatest = this.track(`values:${name}`);
          try {
            const response = await this.$axios.$get(
              apiRoutes.taxonomyItems(this.groupId, { type: name })
            );
            if (!isLatest()) return;
            this.valuesByType = {
              ...this.valuesByType,
              [name]: response.items || [],
            };
          } catch (error) {
            if (isLatest()) failed = true;
          }
        })
      );
      if (failed) {
        this.reportLoadError();
        return;
      }
      if (!names) {
        // A dimension deleted since keeps no values.
        this.valuesByType = Object.fromEntries(
          named.map((name) => [name, this.valuesByType[name] || []])
        );
        this.loadFailed = false;
        this.loaded = { ...this.loaded, values: true };
      }
    },

    // A section read its values again: the tree counts them.
    setCount(name, count) {
      const known = this.valuesByType[name] || [];
      if (known.length === count) return;
      this.fetchValues([name]);
    },

    async fetchTemplates() {
      const isLatest = this.track('templates');
      try {
        const response = await this.$axios.$get(
          apiRoutes.taxonomyTemplateContracts(this.groupId)
        );
        if (!isLatest()) return;
        this.templates = response.items || [];
        this.loaded = { ...this.loaded, templates: true };
      } catch (error) {
        if (isLatest()) this.reportLoadError();
      }
    },
  },
};
