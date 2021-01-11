<script>
import * as apiRoutes from '~/helpers/api-routes.js'

export default {
  name: `bs-template-images-list`,
  props: {
    assets: { type: Object, default: () => ({}) },
    templateId: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    imagesList() {
      return Object.entries(this.assets).map(([originalName, imageName]) => ({
        originalName,
        href: apiRoutes.imagesItem({ imageName }),
      }))
    },
  },
  methods: {
    deleteImages() {
      this.$emit(`delete`)
    },
  },
}
</script>

<template>
  <v-card>
    <v-card-title>{{ `${$tc('global.image', imagesList.length)} (${imagesList.length})` }}</v-card-title>
    <v-card-text>
      <details>
        <summary>{{$t('global.show')}}</summary>
        <ul class="template-images">
          <li class="template-images__item" v-for="image in imagesList" :key="image.originalName">
            <a :href="image.href">{{ image.originalName }}</a>
          </li>
        </ul>
      </details>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn @click="deleteImages" :disabled="disabled" text large color="primary">{{$t('template.removeImages')}}</v-btn>
    </v-card-actions>
  </v-card>
</template>

<style lang="scss" scoped>
.template-images {
  columns: 300px 2;
  list-style: none;
  counter-reset: nombre;
}
.template-images__item {
  counter-increment: nombre;

  &::before {
    content: counter(nombre) ' -';
    color: #ccc;
    width: 2em;
    display: inline-block;
    text-align: right;
    padding-right: 0.5em;
  }
}
</style>
