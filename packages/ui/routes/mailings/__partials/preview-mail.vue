<script>
import { images } from '~/helpers/api-routes';

export default {
  name: 'PreviewMail',
  props: {
    mailingId: { type: String, default: null },
    mailing: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      images,
      loading: false,
      errorPreview: false,
      previewImage: null,
    };
  },
  async mounted() {
    this.loading = true;
  },
  methods: {
    onImageLoad() {
      this.loading = false
    }
  }
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
        v-show="loading"
        class="preview_container"
        type="image, image"
      />
      <v-img
        class="max_width_img"
        @load="onImageLoad"
        :src="images(this.mailing.previewFileUrl)"
        :alt="$t('global.previewMailAlt')"
      />
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
