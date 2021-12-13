<script>
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'BsTemplateHtmlPreview',
  props: {
    markup: { type: String, default: '' },
    templateId: { type: String, default: '' },
  },
  computed: {
    previewHref() {
      return apiRoutes.templatesItemMarkup({ templateId: this.templateId });
    },
    downloadHref() {
      return `${this.previewHref}?download=true`;
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-title>{{ $t('template.markup') }}</v-card-title>
    <v-card-text>
      <details>
        <summary>{{ $t('global.show') }}</summary>
        <pre class="html-content" v-text="markup" />
      </details>
    </v-card-text>
    <v-divider />
    <v-card-actions class="float-right">
      <v-btn link :href="downloadHref" elevation="0" color="accent">
        {{ $t('template.download') }}
      </v-btn>
      <v-btn link :href="previewHref" target="_blank" outlined color="primary">
        {{ $t('template.preview') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style lang="scss" scoped>
.html-content {
  font-size: 11px;
  overflow-x: auto;
}
</style>
