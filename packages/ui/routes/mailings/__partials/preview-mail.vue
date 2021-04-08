<script>
import { preview } from '~/helpers/api-routes.js';

export default {
  name: 'PreviewMail',
  props: {
    mailingId: { type: String, default: null },
  },
  data() {
    return {
      loading: false,
      errorPreview: false,
      previewImage: null,
    };
  },
  async mounted() {
    try {
      this.loading = true;
      const { $axios } = this;
      const previewResponse = await $axios.$get(preview(this.mailingId), {
        responseType: 'arraybuffer',
      });
      this.previewImage = Buffer.from(previewResponse, 'binary').toString(
        'base64'
      );
      this.loading = false;
    } catch (error) {
      this.errorPreview = true;
    }
  },
};
</script>
<template>
  <div class="px-1 preview_container">
    <div v-if="errorPreview">
      <p class="red--text">
        {{ $t('mailings.errorPreview') }}
      </p>
    </div>
    <div class="max_height_img_container">
      <v-skeleton-loader
        :loading="loading"
        class="preview_container"
        type="image, image">
        <img
          class="max_width_img"
          :src="`data:image/png;base64,${previewImage}`"
          :alt="$t('global.previewMailAlt')"
        />
      </v-skeleton-loader>
    </div>
  </div>
</template>

<style scoped>
.max_height_img_container {
  max-height: 400px;
  overflow-y: auto;
}

.max_width_img {
  max-width: 300px;
}

.preview_container {
  min-height: 400px;
  min-width: 300px;
}
</style>
