<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';

export default {
  name: 'PioTemplateError',
  mixins: [mixinPageTitle],
  props: ['error'],
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `error – ${this.error.statusCode}`;
    },
  },
  mounted() {
    console.log(this.error);
  },
};
</script>

<template>
  <main class="bs-page-error" role="main">
    <h1 class="bs-page-error__code display-4">
      {{ error.statusCode }}
    </h1>
    <h2 class="bs-page-error__message display-2" v-text="error.message" />
    <h3
      v-if="error.serverMessage"
      class="bs-page-error__server-message"
      v-text="error.serverMessage"
    />
    <p v-if="error.endpoint" class="bs-page-error__enpoint">
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
