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
    :class="`mr-2 mb-4 bs-template-card ${selectedClass}`"
    @click="onClick"
  >
    <bs-template-cover-image :src="coverSrc" :fit-cover="!hasCover" />
    <v-card-title>
      <h2 class="bs-template-card__title headline">
        {{ template.name }}
      </h2>
    </v-card-title>
    <v-card-subtitle class="bs-template-card__subtitle text-center pb-0">
      {{ template.description }}
    </v-card-subtitle>
  </v-card>
</template>

<style lang="scss" scoped>
.bs-template-card {
  --cover-min-height: 250px;
  --cover-max-height: 250px;
}

.bs-template-card_selected {
  box-shadow: 0 0 0 5px var(--v-primary-base) !important;
}

.bs-template-card__title {
  text-align: center;
  flex-grow: 1;
  margin: 0;
}
.bs-template-card__subtitle {
  &:empty {
    display: none;
  }
  &::before {
    content: '– ';
  }
  &::after {
    content: ' –';
  }
}
</style>
