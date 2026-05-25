const Vue = require('vue/dist/vue.common');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component
    Vue.component('TrackingParamsPlugin', {
      components: {},
      data: () => ({
        hasGoogleAnalyticsUtmSubscription: null,
        trackingUrlsSubscription: null,
        hasGoogleAnalyticsUtm: vm.content().tracking().hasGoogleAnalyticsUtm(),
        trackingUrls: vm.content().tracking().trackingUrls(),
        utmSourceKey: vm.content().tracking().utmSourceKey(),
        utmSourceValue: vm.content().tracking().utmSourceValue(),
        utmMediumKey: vm.content().tracking().utmMediumKey(),
        utmMediumValue: vm.content().tracking().utmMediumValue(),
        utmCampaignKey: vm.content().tracking().utmCampaignKey(),
        utmCampaignValue: vm.content().tracking().utmCampaignValue(),
      }),
      mounted() {
        this.hasGoogleAnalyticsUtmSubscription = vm.content().tracking().hasGoogleAnalyticsUtm.subscribe(this.updateHasGoogleAnalyticsUtm);
        this.trackingUrlsSubscription = vm.content().tracking().trackingUrls.subscribe(this.updateTrackingUrls);
      },
      beforeDestroy() {
        this.hasGoogleAnalyticsUtmSubscription.dispose();
        this.trackingUrlsSubscription.dispose();
      },
      methods: {
        handleGoogleAnalytics() {
          const oldValue = vm.content().tracking().hasGoogleAnalyticsUtm();
          vm.content().tracking().hasGoogleAnalyticsUtm(!oldValue);
        },
        getGoogleAnalyticsButtonText() {
          return `${this.hasGoogleAnalyticsUtm ? vm.t('remove') : vm.t('Add')} Google Analytics UTM`;
        },
        getNeedHelpText() {
          return vm.t('needHelpText');
        },
        getAddParamText() {
          return vm.t('addParamText');
        },
        updateHasGoogleAnalyticsUtm(newHasGoogleAnalyticsUtm) {
          this.hasGoogleAnalyticsUtm = newHasGoogleAnalyticsUtm;
        },
        updateTrackingUrls(newTrackingUrls) {
          this.trackingUrls = newTrackingUrls;
        },
        addTrackingUrl() {
          const oldValue = vm.content().tracking().trackingUrls();
          vm.content().tracking().trackingUrls([...oldValue, { key: '', value: '' }]);
        },
        removeTrackingUrl(indexToDelete) {
          const oldTrackingUrls = vm.content().tracking().trackingUrls();
          const newTrackingUrls = [...oldTrackingUrls]
          newTrackingUrls.splice(indexToDelete, 1);
          vm.content().tracking().trackingUrls(newTrackingUrls);
        }
      },
      watch: {
        trackingUrls(newTrackingUrls) {
          vm.content().tracking().trackingUrls(newTrackingUrls);
        },
        utmSourceKey(utmSourceKey) {
          vm.content().tracking().utmSourceKey(utmSourceKey);
        },
        utmSourceValue(utmSourceValue) {
          vm.content().tracking().utmSourceValue(utmSourceValue);
        },
        utmMediumKey(utmMediumKey) {
          vm.content().tracking().utmMediumKey(utmMediumKey);
        },
        utmMediumValue(utmMediumValue) {
          vm.content().tracking().utmMediumValue(utmMediumValue);
        },
        utmCampaignKey(utmCampaignKey) {
          vm.content().tracking().utmCampaignKey(utmCampaignKey);
        },
        utmCampaignValue(utmCampaignValue) {
          vm.content().tracking().utmCampaignValue(utmCampaignValue);
        }
      },
      template: `
        <div class="objEdit level1 tracking-section">
          <span class="objLabel level1">
            <span data-bind="text: $root.ut('template', 'Tracking')">Tracking</span>
            <a href="https://www.lepatron.email/faq" target="_blank" class="tracking-help-link">{{getNeedHelpText()}}</a>
          </span>
          <div v-for="(trackingUrl, index) in trackingUrls" class="tracking-param-row">
            <div class="propEditor tracking-param-editor">
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="key"
                  v-model="trackingUrl.key"
                />
              </div>
              <span class="tracking-equals">=</span>
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="value"
                  v-model="trackingUrl.value"
                />
              </div>
              <button
                v-if="trackingUrls.length > 1"
                @click.prevent="() => removeTrackingUrl(index)"
                class="tracking-remove-btn"
                title="Remove parameter"
              >
                <span class="lucide lucide-x"></span>
              </button>
            </div>
          </div>
          <div class="tracking-actions">
            <button
              @click.prevent="addTrackingUrl"
              class="tracking-add-btn"
            >
              <span class="lucide lucide-plus"></span>
              <span>{{getAddParamText()}}</span>
            </button>
            <button
              @click.prevent="handleGoogleAnalytics"
              class="tracking-utm-btn"
              :class="{ 'tracking-utm-btn--active': hasGoogleAnalyticsUtm }"
            >
              <span class="lucide" :class="hasGoogleAnalyticsUtm ? 'lucide-minus' : 'lucide-plus'"></span>
              <span>{{getGoogleAnalyticsButtonText()}}</span>
            </button>
          </div>
          <div v-if="hasGoogleAnalyticsUtm" class="tracking-utm-fields">
            <div class="propEditor tracking-param-editor">
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="utm_source"
                  v-model="utmSourceKey"
                />
              </div>
              <span class="tracking-equals">=</span>
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="value"
                  v-model="utmSourceValue"
                />
              </div>
            </div>
            <div class="propEditor tracking-param-editor">
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="utm_medium"
                  v-model="utmMediumKey"
                />
              </div>
              <span class="tracking-equals">=</span>
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="value"
                  v-model="utmMediumValue"
                />
              </div>
            </div>
            <div class="propEditor tracking-param-editor">
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="utm_campaign"
                  v-model="utmCampaignKey"
                />
              </div>
              <span class="tracking-equals">=</span>
              <div class="propInput tracking-input">
                <input
                  type="text"
                  placeholder="value"
                  v-model="utmCampaignValue"
                />
              </div>
            </div>
          </div>
        </div>
      `,
    });

    new Vue({ el: '#tracking-params' });
  },
};
