import * as apiRoutes from '~/helpers/api-routes.js';
import { STANDARD_DIMENSIONS } from '~/helpers/taxonomy-builder.js';
import { pointsToCheck, pointsByDimension } from '~/helpers/taxonomy-checks.js';

/**
 * What the taxonomy workspace reads (ADR-0026): the company's dimensions,
 * their values (for the tree's counts, the crossings, the defaults, the
 * preview and the points to check), and its templates with their contract.
 */
export default {
  data() {
    return {
      dimensions: [],
      // Values per dimension name.
      valuesByType: {},
      // `{ id, name, contract }`, by name.
      templates: [],
    };
  },
  computed: {
    allValues() {
      return Object.values(this.valuesByType).flat();
    },
    // What the taxonomy lacks, never blocking (ADR-0026).
    points() {
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
    async fetchDimensions() {
      try {
        const response = await this.$axios.$get(
          apiRoutes.taxonomyDimensions(this.groupId, {
            lang: this.$i18n.locale,
          })
        );
        this.dimensions = response.items || [];
        await this.fetchValues();
      } catch (error) {
        this.dimensions = [];
        this.showSnackbar({
          text: this.$t('taxonomy.dimensions.loadError'),
          color: 'error',
        });
      }
    },

    async fetchValues() {
      const named = this.dimensions.filter(
        (dimension) => dimension.name !== STANDARD_DIMENSIONS.TRIGGER
      );
      const lists = await Promise.all(
        named.map((dimension) =>
          this.$axios
            .$get(
              apiRoutes.taxonomyItems(this.groupId, { type: dimension.name })
            )
            .then((response) => response.items || [])
            .catch(() => [])
        )
      );
      this.valuesByType = Object.fromEntries(
        named.map((dimension, index) => [dimension.name, lists[index]])
      );
    },

    // A section read its values again: the tree counts them.
    setCount(name, count) {
      const known = this.valuesByType[name] || [];
      if (known.length === count) return;
      this.fetchValues();
    },

    async fetchTemplates() {
      try {
        const response = await this.$axios.$get(
          apiRoutes.taxonomyTemplateContracts(this.groupId)
        );
        this.templates = response.items || [];
      } catch (error) {
        this.templates = [];
      }
    },
  },
};
