<script>
export default {
  name: `bs-template-cover-image`,
  props: {
    src: { type: String, default: `` },
    fitCover: { type: Boolean, default: false },
  },
  computed: {
    hasImage() {
      return this.src !== ``;
    },
    componentClasses() {
      return { 'bs-template-cover-image--cover': this.fitCover };
    },
  },
};
</script>

<template>
  <figure class="bs-template-cover-image" :class="componentClasses">
    <!-- https://web.dev/native-lazy-loading/ -->
    <img
      v-if="hasImage"
      class="bs-template-cover-image__image"
      loading="lazy"
      :src="src"
    />
  </figure>
</template>

<style lang="scss" scoped>
.bs-template-cover-image {
  min-height: var(--cover-min-height, 0);
  max-height: var(--cover-max-height, 300px);
  overflow-y: auto;
  margin: 0;
}
.bs-template-cover-image--cover {
  height: var(--cover-max-height, 300px);
  object-fit: cover;
}
.bs-template-cover-image__image {
  width: 100%;
  height: auto;
  display: block;

  .bs-template-cover-image--cover & {
    height: 100%;
  }
}
</style>
