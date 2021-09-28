<template>
  <div class="m-color-scheme">
    <bs-color v-for="color of colorScheme" :key="color" :color="color" />
  </div>
</template>

<script>
import BsColor from '~/components/group/color';

export default {
  name: 'BsColorScheme',
  components: {
    BsColor,
  },
  props: {
    colorScheme: {
      type: Array,
      default: () => [],
    },
  },
};
</script>

<style scoped>
.m-color-scheme {
  max-width: fit-content;
  display: grid;
  justify-content: start;
  grid-template-rows: repeat(3, 1fr);
  grid-template-columns: repeat(7, 1fr);
  row-gap: 0.3rem;
  column-gap: 0.3rem;
}
</style>
