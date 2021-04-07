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
      previewImage: null,
    };
  },
  async mounted() {
    this.loading = true;
    const { $axios } = this;
    const previewResponse = await $axios.$get(preview(this.mailingId), {
      responseType: 'arraybuffer',
    });
    this.previewImage = Buffer.from(previewResponse, 'binary').toString(
      'base64'
    );
    this.loading = false;
  },
};
</script>
<template>
  <div class="pr-4 pl-4 preview_container d-flex justify-center align-center">
    <v-progress-circular
      v-if="loading"
      indeterminate
      color="primary"
    />
    <div v-else class="max_height_img_container">
      <img
        class="max_width_img"
        :src="`data:image/png;base64,${previewImage}`"
        alt=""
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
