const Vue = require('vue/dist/vue.common');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    const groupConfig = (vm.metadata && vm.metadata.trackingConfig) || null;
    const isManaged = !!(
      groupConfig &&
      groupConfig.enabled &&
      Array.isArray(groupConfig.params) &&
      groupConfig.params.length > 0
    );

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
        groupConfig,
        isManaged,
      }),
      mounted() {
        this.hasGoogleAnalyticsUtmSubscription = vm.content().tracking().hasGoogleAnalyticsUtm.subscribe(this.updateHasGoogleAnalyticsUtm);
        this.trackingUrlsSubscription = vm.content().tracking().trackingUrls.subscribe(this.updateTrackingUrls);
        if (this.isManaged) this.ensureManagedRows();
      },
      beforeDestroy() {
        this.hasGoogleAnalyticsUtmSubscription.dispose();
        this.trackingUrlsSubscription.dispose();
      },
      computed: {
        groupKeys() {
          if (!this.isManaged) return [];
          return this.groupConfig.params.map((p) => p.key);
        },
        restrictValues() {
          return !!(this.isManaged && this.groupConfig.restrictValues);
        },
        managedRows() {
          if (!this.isManaged) return [];
          return this.groupConfig.params.map((param) => {
            const existing = this.trackingUrls.find((tu) => tu && tu.key === param.key);
            return {
              key: param.key,
              values: Array.isArray(param.values) ? param.values : [],
              required: !!param.required,
              value: existing ? existing.value || '' : '',
              missing: !!param.required && !(existing && existing.value),
            };
          });
        },
        freeFormRows() {
          if (!this.isManaged) return this.trackingUrls;
          // free-form rows are those whose key isn't in the group whitelist
          return this.trackingUrls.filter(
            (tu) => tu && this.groupKeys.indexOf(tu.key) === -1
          );
        },
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
        // Make sure each managed key has a row in tracking().trackingUrls so
        // that the user can fill it. Also drops free-form rows when
        // restrictValues is on.
        ensureManagedRows() {
          const current = (vm.content().tracking().trackingUrls() || []).slice();
          let mutated = false;
          this.groupConfig.params.forEach((param) => {
            const idx = current.findIndex((tu) => tu && tu.key === param.key);
            if (idx === -1) {
              current.push({ key: param.key, value: '' });
              mutated = true;
            }
          });
          if (this.restrictValues) {
            const beforeLen = current.length;
            const kept = current.filter(
              (tu) => tu && this.groupKeys.indexOf(tu.key) !== -1
            );
            if (kept.length !== beforeLen) {
              vm.content().tracking().trackingUrls(kept);
              return;
            }
          }
          if (mutated) {
            vm.content().tracking().trackingUrls(current);
          }
        },
        setManagedValue(key, value) {
          const current = (vm.content().tracking().trackingUrls() || []).slice();
          const idx = current.findIndex((tu) => tu && tu.key === key);
          if (idx >= 0) {
            current[idx] = Object.assign({}, current[idx], { value: value });
          } else {
            current.push({ key: key, value: value });
          }
          vm.content().tracking().trackingUrls(current);
        },
        addTrackingUrl() {
          const oldValue = vm.content().tracking().trackingUrls();
          vm.content().tracking().trackingUrls([...oldValue, { key: '', value: '' }]);
        },
        removeTrackingUrl(targetKey, targetIndex) {
          const current = (vm.content().tracking().trackingUrls() || []).slice();
          // When called with key, drop the first matching key entry;
          // otherwise drop by index (legacy free-form list).
          let removeIdx = -1;
          if (typeof targetKey === 'string' && targetKey.length > 0) {
            removeIdx = current.findIndex((tu) => tu && tu.key === targetKey);
          } else {
            // For legacy free-form rows, indexes refer to the filtered freeFormRows list.
            const freeForm = current.filter(
              (tu) => tu && this.groupKeys.indexOf(tu.key) === -1
            );
            const target = freeForm[targetIndex];
            if (target) removeIdx = current.indexOf(target);
          }
          if (removeIdx >= 0) {
            current.splice(removeIdx, 1);
            vm.content().tracking().trackingUrls(current);
          }
        },
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

          <!-- Managed mode: group-defined params -->
          <template v-if="isManaged">
            <div
              v-for="row in managedRows"
              :key="row.key"
              class="tracking-param-row tracking-param-row--managed"
              :class="{ 'tracking-param-row--missing': row.missing }"
            >
              <div class="propEditor tracking-param-editor">
                <div class="propInput tracking-input tracking-input--readonly">
                  <strong>{{ row.key }}</strong>
                  <span v-if="row.required" class="tracking-required">*</span>
                </div>
                <span class="tracking-equals">=</span>
                <div class="propInput tracking-input">
                  <select
                    v-if="row.values.length > 1"
                    :value="row.value"
                    @change="setManagedValue(row.key, $event.target.value)"
                  >
                    <option value=""></option>
                    <option
                      v-for="v in row.values"
                      :key="v"
                      :value="v"
                    >{{ v }}</option>
                  </select>
                  <input
                    v-else-if="row.values.length === 1"
                    type="text"
                    :value="row.values[0]"
                    readonly
                    @focus="setManagedValue(row.key, row.values[0])"
                  />
                  <input
                    v-else
                    type="text"
                    :value="row.value"
                    placeholder="value"
                    @input="setManagedValue(row.key, $event.target.value)"
                  />
                </div>
              </div>
            </div>

            <!-- Free-form params (only when restrictValues is off) -->
            <template v-if="!restrictValues">
              <div
                v-for="(trackingUrl, index) in freeFormRows"
                :key="'ff-' + index"
                class="tracking-param-row"
              >
                <div class="propEditor tracking-param-editor">
                  <div class="propInput tracking-input">
                    <input type="text" placeholder="key" v-model="trackingUrl.key" />
                  </div>
                  <span class="tracking-equals">=</span>
                  <div class="propInput tracking-input">
                    <input type="text" placeholder="value" v-model="trackingUrl.value" />
                  </div>
                  <button
                    @click.prevent="() => removeTrackingUrl(null, index)"
                    class="tracking-remove-btn"
                    title="Remove parameter"
                  >
                    <span class="lucide lucide-x"></span>
                  </button>
                </div>
              </div>
              <div class="tracking-actions">
                <button @click.prevent="addTrackingUrl" class="tracking-add-btn">
                  <span class="lucide lucide-plus"></span>
                  <span>{{getAddParamText()}}</span>
                </button>
              </div>
            </template>
          </template>

          <!-- Free-form mode (legacy: no group config) -->
          <template v-else>
            <div v-for="(trackingUrl, index) in trackingUrls" class="tracking-param-row">
              <div class="propEditor tracking-param-editor">
                <div class="propInput tracking-input">
                  <input type="text" placeholder="key" v-model="trackingUrl.key" />
                </div>
                <span class="tracking-equals">=</span>
                <div class="propInput tracking-input">
                  <input type="text" placeholder="value" v-model="trackingUrl.value" />
                </div>
                <button
                  v-if="trackingUrls.length > 1"
                  @click.prevent="() => removeTrackingUrl(null, index)"
                  class="tracking-remove-btn"
                  title="Remove parameter"
                >
                  <span class="lucide lucide-x"></span>
                </button>
              </div>
            </div>
            <div class="tracking-actions">
              <button @click.prevent="addTrackingUrl" class="tracking-add-btn">
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
                  <input type="text" placeholder="utm_source" v-model="utmSourceKey" />
                </div>
                <span class="tracking-equals">=</span>
                <div class="propInput tracking-input">
                  <input type="text" placeholder="value" v-model="utmSourceValue" />
                </div>
              </div>
              <div class="propEditor tracking-param-editor">
                <div class="propInput tracking-input">
                  <input type="text" placeholder="utm_medium" v-model="utmMediumKey" />
                </div>
                <span class="tracking-equals">=</span>
                <div class="propInput tracking-input">
                  <input type="text" placeholder="value" v-model="utmMediumValue" />
                </div>
              </div>
              <div class="propEditor tracking-param-editor">
                <div class="propInput tracking-input">
                  <input type="text" placeholder="utm_campaign" v-model="utmCampaignKey" />
                </div>
                <span class="tracking-equals">=</span>
                <div class="propInput tracking-input">
                  <input type="text" placeholder="value" v-model="utmCampaignValue" />
                </div>
              </div>
            </div>
          </template>
        </div>
      `,
    });

    new Vue({ el: '#tracking-params' });
  },
};
