<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js'

export default {
  name: `pio-template-error`,
  mixins: [mixinPageTitle],
  props: [`error`],
  head() {
    return { title: this.title }
  },
  mounted() {
    console.log(this.error)
  },
  computed: {
    title() {
      return `error – ${this.error.statusCode}`
    },
  },
}
</script>

<template>
  <main class="bs-page-error" role="main">
    <h1 class="bs-page-error__code display-4">{{error.statusCode}}</h1>
    <h2 class="bs-page-error__message display-2" v-text="error.message" />
    <h3
      class="bs-page-error__server-message"
      v-if="error.serverMessage"
      v-text="error.serverMessage"
    />
    <p class="bs-page-error__enpoint" v-if="error.endpoint">
      <code class="bs-page-error__enpoint-url" v-text="error.endpoint" />
    </p>
  </main>
</template>


<style lang="scss" scoped>
.bs-page-error {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.bs-page-error__code {
  color: var(--v-primary-base);
  margin-bottom: 0.25em;
}
</style>
