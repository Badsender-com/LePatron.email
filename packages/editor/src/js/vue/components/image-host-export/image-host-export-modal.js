const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { ModalComponent } = require('../modal/modalComponent');
const {
  startImageHostExport,
  imageHostExport,
  imageHostExportZip,
} = require('../../utils/apis');
const {
  POLL_INTERVAL_MS,
  POLL_REQUEST_TIMEOUT_MS,
  nextPollDelay,
} = require('../../utils/poll-delay');

// Why an export failed, by the server's code, as the editor says it.
const FAILURE_MESSAGES = {
  IMAGE_HOST_UPLOAD_FAILED: 'download-image-host-images-error',
  IMAGE_HOST_CREDENTIALS_REFUSED: 'download-image-host-credentials-refused',
  IMAGE_HOST_NOT_AVAILABLE: 'download-image-host-unavailable',
  IMAGE_HOST_FOLDER_UNAVAILABLE: 'download-image-host-folder-unavailable',
  IMAGE_HOST_UNAVAILABLE: 'download-image-host-down',
  IMAGE_HOST_EXPORT_INTERRUPTED: 'image-host-export-interrupted',
};

/**
 * The export of the email to an image host, run as a job on the server
 * (ADR 0029): started when the export menu sets `vm.imageHostExport`, its
 * progress shown, the ZIP downloaded once done, or the reason it failed.
 */
const ImageHostExportModalComponent = Vue.component('ImageHostExportModal', {
  components: { ModalComponent },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    host: null,
    // starting · hosting · downloading · failed
    phase: 'starting',
    progress: { done: 0, total: 0 },
    failure: '',
    jobId: null,
    timer: null,
    delay: POLL_INTERVAL_MS,
    // Bumped when the modal closes: an answer to a former export is ignored.
    generation: 0,
  }),
  computed: {
    title() {
      return this.host
        ? this.vm.t('image-host-export-title', { host: this.host.name })
        : '';
    },
    percent() {
      if (!this.progress.total) return 0;
      return Math.round((this.progress.done / this.progress.total) * 100);
    },
    status() {
      // Until the first status, the total is not known yet.
      if (this.phase === 'starting' || !this.progress.total) {
        return this.vm.t('image-host-export-starting');
      }
      if (this.phase === 'downloading') {
        return this.vm.t('image-host-export-downloading');
      }
      return this.vm.t('image-host-export-progress', {
        done: this.progress.done,
        total: this.progress.total,
      });
    },
  },
  mounted() {
    this.subscription = this.vm.imageHostExport.subscribe((request) => {
      if (request) this.start(request);
    });
  },
  beforeDestroy() {
    this.stopPolling();
    if (this.subscription) this.subscription.dispose();
  },
  methods: {
    start({ host, html, tracking }) {
      this.generation += 1;
      const generation = this.generation;
      Object.assign(this, {
        host,
        phase: 'starting',
        progress: { done: 0, total: 0 },
        failure: '',
        jobId: null,
        delay: POLL_INTERVAL_MS,
      });
      this.$refs.modalRef.openModal();
      axios
        .post(startImageHostExport({ mailingId: this.vm.metadata.id }), {
          html,
          hostingIntegrationId: host.id,
          tracking,
        })
        .then(({ data }) => {
          if (generation !== this.generation) return;
          this.jobId = data.jobId;
          this.phase = 'hosting';
          this.schedule(generation);
        })
        .catch((error) => {
          if (generation !== this.generation) return;
          const answer = (error.response && error.response.data) || {};
          this.fail(answer.message || answer.errorCode, []);
        });
    },
    schedule(generation) {
      this.timer = setTimeout(() => this.poll(generation), this.delay);
    },
    poll(generation) {
      axios
        .get(imageHostExport({ jobId: this.jobId }), {
          timeout: POLL_REQUEST_TIMEOUT_MS,
        })
        .then(({ data }) => {
          if (generation !== this.generation) return;
          this.delay = nextPollDelay(this.delay, { failed: false });
          this.progress = data.progress;
          if (data.status === 'completed') return this.download(generation);
          if (data.status === 'failed') {
            return this.fail(data.error.code, data.error.images);
          }
          return this.schedule(generation);
        })
        .catch(() => {
          if (generation !== this.generation) return;
          this.delay = nextPollDelay(this.delay, { failed: true });
          this.schedule(generation);
        });
    },
    download(generation) {
      this.phase = 'downloading';
      return axios
        .get(imageHostExportZip({ jobId: this.jobId }), {
          responseType: 'blob',
        })
        .then(({ data }) => {
          if (generation !== this.generation) return;
          const url = window.URL.createObjectURL(data);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${this.vm.metadata.name()}.zip`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          this.vm.notifier.success(
            this.vm.t('image-host-export-done', { host: this.host.name })
          );
          this.closeModal();
        })
        .catch(() => {
          if (generation !== this.generation) return;
          this.fail(null, []);
        });
    },
    fail(code, images) {
      this.stopPolling();
      this.phase = 'failed';
      const names = (images || []).map((url) =>
        url.split('?')[0].split('/').pop()
      );
      const key =
        code === 'IMAGE_HOST_UPLOAD_FAILED' && !names.length
          ? null
          : FAILURE_MESSAGES[code];
      // Text, not HTML: Vue escapes what it interpolates.
      this.failure = this.vm.t(key || 'download-image-host-error', {
        host: this.host.name,
        images: names.join(', '),
      });
    },
    stopPolling() {
      clearTimeout(this.timer);
      this.timer = null;
    },
    closeModal() {
      this.$refs.modalRef.closeModal();
    },
    // Closing stops following the export; on the server it goes on, and a
    // new export finds its images already hosted.
    handleOnClose() {
      this.generation += 1;
      this.stopPolling();
    },
  },
  template: `
    <modal-component ref="modalRef" :onClose="handleOnClose" :maxWidth="480">
      <div class="modal-content image-host-export">
        <h5>{{ title }}</h5>
        <template v-if="phase !== 'failed'">
          <p class="image-host-export__status" aria-live="polite">{{ status }}</p>
          <div
            class="image-host-export__bar"
            role="progressbar"
            :aria-valuenow="percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="image-host-export__fill" :style="{ width: percent + '%' }"></div>
          </div>
        </template>
        <p v-else class="image-host-export__failure" role="alert">{{ failure }}</p>
      </div>
      <div class="modal-footer">
        <button
          @click.prevent="closeModal"
          class="btn-flat waves-effect waves-light"
          name="closeAction">
          {{ vm.t('image-host-export-close') }}
        </button>
      </div>
    </modal-component>
  `,
});

module.exports = { ImageHostExportModalComponent };
