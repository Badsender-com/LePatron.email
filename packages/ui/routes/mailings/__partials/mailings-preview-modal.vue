<script>
import { imageFromPreviews } from '~/helpers/api-routes';
import BsModalConfirm from '~/components/modal-confirm';
import { AlertCircle } from 'lucide-vue';

export default {
  name: 'MailingsPreviewModal',
  components: {
    BsModalConfirm,
    LucideAlertCircle: AlertCircle,
  },
  data() {
    return {
      loading: false,
      errorPreview: false,
      previewHtml: null,
      iframeHeight: null,
    };
  },
  methods: {
    async open(item) {
      this.errorPreview = false;
      this.data = item;
      await this.fetchPreview();
      this.$refs.previewMailModal.open();
    },
    async fetchPreview() {
      this.loading = true;
      this.errorPreview = false;
      try {
        this.previewHtml = await this.$axios.$get(
          imageFromPreviews(this.data?.mail?.id),
          {
            responseType: 'text',
          }
        );
      } catch (e) {
        this.errorPreview = true;
      } finally {
        this.loading = false;
      }
    },
    resizeIframe() {
      this.iframeHeight =
        this.$refs.iframePreview?.contentWindow?.document?.documentElement
          .scrollHeight + 'px';
    },
    clickOutside() {
      this.data = null;
      this.iframeHeight = null;
      this.previewHtml = null;
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="previewMailModal"
    modal-width="700"
    :title="$t('global.previewMailAlt')"
    :is-form="true"
    @click-outside="clickOutside"
  >
    <div class="pb-8">
      <div class="px-1 max_height_img_container">
        <div v-if="errorPreview">
          <div class="d-flex align-start">
            <lucide-alert-circle :size="24" class="warning-icon" />
            <div class="pl-4">
              <p class="mb-0 text-h6" v-html="$t('mailings.errorPreview')" />
              <p
                class="mb-0 text-subtitle-1"
                v-html="$t('mailings.subErrorPreview')"
              />
            </div>
          </div>
        </div>
        <div v-else>
          <v-skeleton-loader v-show="loading" type="image, image" />
          <iframe
            v-show="!loading"
            ref="iframePreview"
            width="100%"
            scrolling="no"
            :height="iframeHeight"
            :srcDoc="previewHtml"
            @load="() => resizeIframe(this)"
          />
        </div>
      </div>
    </div>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.max_height_img_container {
  max-height: 500px;
  overflow-y: auto;
}

iframe {
  overflow: hidden;
}

.warning-icon {
  color: #fb8c00; /* warning color equivalent */
  flex-shrink: 0;
}
</style>
