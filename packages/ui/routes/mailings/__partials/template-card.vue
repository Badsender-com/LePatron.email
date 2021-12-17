<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTemplateCoverImage from '~/components/template/cover-image.vue';

export default {
  name: 'TemplateCard',
  components: { BsTemplateCoverImage },
  props: {
    template: { type: Object, default: () => ({}) },
    isSelected: { type: Boolean, default: false },
  },
  computed: {
    hasCover() {
      return this.template.coverImage != null;
    },
    coverSrc() {
      if (!this.hasCover) {
        return apiRoutes.imagesPlaceholder({ width: 450, height: 250 });
      }
      const imageName = this.template.coverImage;
      return apiRoutes.imagesItem({ imageName });
    },
    selectedClass() {
      return this.isSelected ? 'bs-template-card_selected' : '';
    },
    hoverClass() {
      return !this.isSelected ? 'card-hover' : '';
    },
  },
  methods: {
    onClick() {
      this.$emit('click', this.template);
    },
  },
};
</script>

<template>
  <v-card
    flat
    tile
    :class="`mr-2 mb-4 bs-template-card ${selectedClass} ${hoverClass}`"
    @click="onClick"
  >
    <bs-template-cover-image :src="coverSrc" :fit-cover="!hasCover" />
    <v-card-title>{{ template.name }}</v-card-title>
    <v-card-subtitle>{{ template.description }}</v-card-subtitle>
  </v-card>
</template>

<style lang="scss" scoped>
.bs-template-card {
  --cover-min-height: 200px;
  --cover-max-height: 200px;
  max-width: 30%;
  box-shadow: 0 0 0 1px var(--v-primary-base) !important;
}

.bs-template-card {
  &:hover {
    box-shadow: 0 0 0 5px var(--v-accent-lighten1) !important;
  }
}
.bs-template-card_selected {
  box-shadow: 0 0 0 5px var(--v-accent-base) !important;
}
</style>
