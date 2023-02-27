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
        style: {
          mh1: {
            marginLeft: '10px',
            marginRight: '10px'
          },
          mv1: {
            marginTop: '10px',
            marginBottom: '10px'
          },
          removeIconButton: {
            background: 'none',
            border: 0,
            marginLeft: '0.5rem',
            fontSize: '1rem',
          },
          plusIconButton: {
            background: 'none',
            border: 0,
            fontSize: '1rem',
          },
          plusIcon: {
            color: 'black',
          }
        }
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
          return `${this.hasGoogleAnalyticsUtm ? vm.t('remove') : vm.t('add')} Google Analytics UTM`;
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
        <div class="objEdit level1">
          <span class="objLabel level1">
            <span data-bind="text: $root.ut('template', 'Tracking')">Tracking</span>
          </span>
          <div v-for="(trackingUrl, index) in trackingUrls">
            <div class="propEditor" :style="style.mv1">
              <div class="propInput">
                <label>
                  <input
                    type="text"
                    placeholder="key"
                    v-model="trackingUrl.key"
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
                    v-model="trackingUrl.value"
                  />
                </label>
              </div>
              <button
                v-if="trackingUrls.length > 1"
                @click.prevent="() => removeTrackingUrl(index)"
                :style="[style.mh1, style.removeIconButton]"
              >
                <i class="fa fa-times"></i>
              </button>
            </div>
          </div>
          <div>
            <button
              @click.prevent="addTrackingUrl"
              :style="[style.plusIconButton]"
            >
              <i :style="style.plusIcon" class="fa fa-plus" aria-hidden="true"></i>
            </button>
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
            <div class="propEditor" :style="style.mv1">
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
            <div class="propEditor" :style="style.mv1">
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
            <div class="propEditor" :style="style.mv1">
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
