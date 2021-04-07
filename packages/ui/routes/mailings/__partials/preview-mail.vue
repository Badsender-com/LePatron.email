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
  <div class="pr-4 pl-4 preview_container d-flex justify-center align-center">
    <div v-if="errorPreview">
      <p class="red--text">
        {{ $t('mailings.errorPreview') }}
      </p>
    </div>
    <v-progress-circular v-else-if="loading" indeterminate color="primary" />
    <div v-else class="max_height_img_container">
      <img
        class="max_width_img"
        :src="`data:image/png;base64,${previewImage}`"
        :alt="$t('global.previewMailAlt')"
      >
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
  min-height: 100px;
  min-width: 100px;
}
</style>
