const Vue = require('vue/dist/vue.common');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component
    Vue.component('TrackingParamsPlugin', {
      components: {},
      data: () => ({
        hasGoogleAnalyticsUtmSubscription: null,
        hasGoogleAnalyticsUtm: vm.content().tracking().hasGoogleAnalyticsUtm(),
        trackingUrlKey: vm.content().tracking().urlKey(),
        trackingUrlValue: vm.content().tracking().urlValue(),
        utmSourceKey: vm.content().tracking().utmSourceKey(),
        utmSourceValue: vm.content().tracking().utmSourceValue(),
        utmMediumKey: vm.content().tracking().utmMediumKey(),
        utmMediumValue: vm.content().tracking().utmMediumValue(),
        utmCampaignKey: vm.content().tracking().utmCampaignKey(),
        utmCampaignValue: vm.content().tracking().utmCampaignValue(),
        style: {
          mh1: {
            marginLeft: '10px',
            marginRight: '10px'
          }
        }
      }),
      mounted() {
        this.hasGoogleAnalyticsUtmSubscription = vm.content().tracking().hasGoogleAnalyticsUtm.subscribe(this.updateHasGoogleAnalyticsUtm);
      },
      beforeDestroy() {
        this.hasGoogleAnalyticsUtmSubscription.dispose();
      },
      methods: {
        handleGoogleAnalytics() {
          const oldValue = vm.content().tracking().hasGoogleAnalyticsUtm();
          vm.content().tracking().hasGoogleAnalyticsUtm(!oldValue);
        },
        getGoogleAnalyticsButtonText() {
          return `${this.hasGoogleAnalyticsUtm ? vm.t('remove') : vm.t('add')} Google Analytics UTM`;
        },
        updateHasGoogleAnalyticsUtm(newHasGoogleAnalyticsUtm) {
          this.hasGoogleAnalyticsUtm = newHasGoogleAnalyticsUtm;
        },
      },
      watch: {
        trackingUrlKey(newTrackingUrlKey) {
          vm.content().tracking().urlKey(newTrackingUrlKey);
        },
        trackingUrlValue(newTrackingUrlValue) {
          vm.content().tracking().urlValue(newTrackingUrlValue);
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
        <div class="objEdit level1">
          <span class="objLabel level1">
            <span data-bind="text: $root.ut('template', 'Tracking')">Tracking</span>
          </span>
          <div class="propEditor">
            <div class="propInput">
              <label>
                <input
                  type="text"
                  placeholder="key"
                  v-model="trackingUrlKey"
                />
              </label>
            </div>
            <span :style="style.mh1">
              =
            </span>
            <div class="propInput">
              <label>
                <input
                  type="text"
                  placeholder="value"
                  v-model="trackingUrlValue"
                />
              </label>
            </div>
          </div>
          <button
            @click.prevent="handleGoogleAnalytics"
            class="ui-button"
          >
          <span>
            {{getGoogleAnalyticsButtonText()}}
          </span>
          </button>
          <div v-if="hasGoogleAnalyticsUtm">
            <div class="propEditor">
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="utm_source"
                    v-model="utmSourceKey"
                  />
                </label>
              </div>
              <span :style="style.mh1">
                =
              </span>
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="value"
                    v-model="utmSourceValue"
                  />
                </label>
              </div>
            </div>
            <div class="propEditor">
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="utm_medium"
                    v-model="utmMediumKey"
                  />
                </label>
              </div>
              <span :style="style.mh1">
                =
              </span>
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="value"
                    v-model="utmMediumValue"
                  />
                </label>
              </div>
            </div>
            <div class="propEditor">
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="utm_campaign"
                    v-model="utmCampaignKey"
                  />
                </label>
              </div>
              <span :style="style.mh1">
                =
              </span>
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="value"
                    v-model="utmCampaignValue"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    new Vue({ el: '#tracking-params' });
  },
};
