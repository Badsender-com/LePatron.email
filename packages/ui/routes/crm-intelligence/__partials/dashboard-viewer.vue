<script>
import { AlertCircle } from 'lucide-vue';

export default {
  name: 'DashboardViewer',
  components: {
    LucideAlertCircle: AlertCircle,
  },
  props: {
    embedUrl: {
      type: String,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    dashboardName: {
      type: String,
      default: '',
    },
  },
  data: () => ({
    iframeLoaded: false,
  }),
  watch: {
    embedUrl() {
      this.iframeLoaded = false;
    },
  },
  methods: {
    onIframeLoad() {
      this.iframeLoaded = true;
    },
  },
};
</script>

<template>
  <div class="dashboard-viewer fill-height">
    <!-- Loading State -->
    <div v-if="loading || !iframeLoaded" class="loading-overlay">
      <v-progress-circular indeterminate color="primary" size="64" />
      <p class="mt-4 text-body-1 grey--text">
        {{ $t('crmIntelligence.loadingDashboard') }}
      </p>
    </div>

    <!-- Dashboard iframe -->
    <iframe
      v-if="embedUrl"
      ref="dashboardFrame"
      :src="embedUrl"
      :title="dashboardName"
      class="dashboard-iframe"
      :class="{ 'iframe-hidden': loading || !iframeLoaded }"
      frameborder="0"
      allowfullscreen
      @load="onIframeLoad"
    />

    <!-- Error State -->
    <div v-if="!loading && !embedUrl" class="error-state">
      <lucide-alert-circle :size="64" style="color: var(--v-error-base)" />
      <p class="mt-4 text-body-1 grey--text">
        {{ $t('crmIntelligence.errors.loadFailed') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.dashboard-viewer {
  position: relative;
  min-height: calc(100vh - 100px);
}

.dashboard-iframe {
  width: 100%;
  height: calc(100vh - 100px);
  border: none;
}

.iframe-hidden {
  visibility: hidden;
  position: absolute;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 1;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}
</style>
