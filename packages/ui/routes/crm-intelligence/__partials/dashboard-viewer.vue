<script>
export default {
  name: 'DashboardViewer',
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
    refreshTimer: null,
  }),
  watch: {
    embedUrl() {
      this.iframeLoaded = false;
      this.scheduleRefresh();
    },
  },
  beforeDestroy() {
    this.clearRefreshTimer();
  },
  methods: {
    onIframeLoad() {
      this.iframeLoaded = true;
    },
    scheduleRefresh() {
      this.clearRefreshTimer();
      if (!this.embedUrl) return;
      // Refresh 1 minute before the 10-minute JWT expiration
      this.refreshTimer = setTimeout(() => {
        this.$emit('refresh');
      }, 9 * 60 * 1000);
    },
    clearRefreshTimer() {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
    },
  },
};
</script>

<template>
  <div class="dashboard-viewer fill-height">
    <!-- Loading State (only when actually loading, not when in error) -->
    <div v-if="loading || (embedUrl && !iframeLoaded)" class="loading-overlay">
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
      sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"
      allowfullscreen
      @load="onIframeLoad"
    />

    <!-- Error State -->
    <div v-if="!loading && !embedUrl" class="error-state">
      <v-icon size="64" color="error">
        mdi-alert-circle-outline
      </v-icon>
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
