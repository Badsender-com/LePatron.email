const Vue = require('vue/dist/vue.common');

// Small inline combobox: editable <input> + chevron button that opens a
// suggestion popover. The current value stays editable at all times — the
// suggestions only assist (no chip/tag, no "clear" button).
const TrackingCombobox = {
  props: {
    value: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'value' },
    // In strict mode the input becomes read-only: only the menu can change
    // the value. Used for locked keys so the dropdown look stays identical to
    // the free-form combobox.
    strict: { type: Boolean, default: false },
  },
  data: () => ({ isOpen: false }),
  mounted() {
    // Document-level mousedown closes the menu only when the click lands
    // outside the combobox. Relying on the input's blur was flaky because
    // some browsers blur the input on chevron click despite mousedown.prevent.
    document.addEventListener('mousedown', this.handleDocMousedown);
  },
  beforeDestroy() {
    document.removeEventListener('mousedown', this.handleDocMousedown);
  },
  methods: {
    onInput(e) {
      if (this.strict) return;
      this.$emit('input', e.target.value);
    },
    openMenu() {
      if (this.options.length > 0) this.isOpen = true;
    },
    toggleMenu() {
      this.isOpen = !this.isOpen;
      this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    onInputMousedown(e) {
      // In strict mode the input acts as a toggle for the menu (select-like).
      if (!this.strict) return;
      e.preventDefault();
      this.toggleMenu();
    },
    selectOption(opt) {
      this.$emit('input', opt);
      this.isOpen = false;
      this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    handleDocMousedown(e) {
      if (!this.isOpen) return;
      if (this.$el && !this.$el.contains(e.target)) this.isOpen = false;
    },
  },
  template: `
    <div
      class="tracking-combobox"
      :class="{ 'tracking-combobox--open': isOpen, 'tracking-combobox--strict': strict }"
    >
      <input
        ref="input"
        type="text"
        class="tracking-combobox__input"
        :value="value"
        :placeholder="placeholder"
        :readonly="strict"
        @input="onInput"
        @focus="openMenu"
        @mousedown="onInputMousedown"
      />
      <button
        type="button"
        class="tracking-combobox__chevron"
        tabindex="-1"
        aria-label="Show suggestions"
        @mousedown.prevent="toggleMenu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <ul v-if="isOpen && options.length" class="tracking-combobox__menu" role="listbox">
        <li
          v-if="strict"
          class="tracking-combobox__option tracking-combobox__option--empty"
          role="option"
          @mousedown.prevent="selectOption('')"
        >&mdash;</li>
        <li
          v-for="opt in options"
          :key="opt"
          class="tracking-combobox__option"
          :class="{ 'tracking-combobox__option--active': opt === value }"
          role="option"
          @mousedown.prevent="selectOption(opt)"
        >{{ opt }}</li>
      </ul>
    </div>
  `,
};

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
      components: { TrackingCombobox },
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
            const values = Array.isArray(param.values) ? param.values : [];
            // `lockedValues` is only meaningful when at least one value is defined.
            // Falling back to false otherwise keeps the editor behavior sane for
            // legacy configs that pre-date the flag.
            const lockedValues = !!param.lockedValues && values.length > 0;
            return {
              key: param.key,
              values,
              required: !!param.required,
              lockedValues,
              value: existing ? existing.value || '' : '',
              missing: !!param.required && !(existing && existing.value),
            };
          });
        },
        freeFormRows() {
          if (!this.isManaged) return this.trackingUrls;
          // Free-form rows are the ones the user added manually. We must NOT
          // filter them out the moment their key becomes a managed key, else
          // the row vanishes mid-typing (the key field loses its row as soon
          // as you finish typing e.g. "utm_source"). Instead we keep every row
          // that is not the dedicated managed row for that key, and flag the
          // collision via freeFormErrors so the user sees an inline message.
          // A row is "managed" (and thus hidden from the free-form list) only
          // when it is the unique row whose key matches a group key AND it is
          // the first such row — managedRows already renders that one.
          const managedFirstIndexByKey = {};
          this.trackingUrls.forEach((tu, i) => {
            if (
              tu &&
              this.groupKeys.indexOf(tu.key) !== -1 &&
              managedFirstIndexByKey[tu.key] === undefined
            ) {
              managedFirstIndexByKey[tu.key] = i;
            }
          });
          return this.trackingUrls.filter(
            (tu, i) =>
              tu && managedFirstIndexByKey[tu.key] !== i
          );
        },
        // Per-row collision detection for free-form rows. Returns a Map keyed
        // by the row object so the template can show an inline error without
        // relying on a fragile index. A row is in error when its (non-empty)
        // key duplicates a managed key OR another free-form key.
        freeFormErrors() {
          const errors = new Map();
          if (!this.isManaged) {
            // legacy mode: only free-form vs free-form duplicates
            const counts = {};
            this.trackingUrls.forEach((tu) => {
              if (tu && tu.key) counts[tu.key] = (counts[tu.key] || 0) + 1;
            });
            this.trackingUrls.forEach((tu) => {
              if (tu && tu.key && counts[tu.key] > 1) {
                errors.set(tu, 'trackingDuplicateKey');
              }
            });
            return errors;
          }
          const freeForm = this.freeFormRows;
          const seen = {};
          freeForm.forEach((tu) => {
            if (tu && tu.key) seen[tu.key] = (seen[tu.key] || 0) + 1;
          });
          freeForm.forEach((tu) => {
            if (!tu || !tu.key) return;
            if (this.groupKeys.indexOf(tu.key) !== -1) {
              // collides with a managed (group) key
              errors.set(tu, 'trackingReservedKey');
            } else if (seen[tu.key] > 1) {
              errors.set(tu, 'trackingDuplicateKey');
            }
          });
          return errors;
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
        getLockedTooltip() {
          return vm.t('trackingGlobalParamLocked');
        },
        getOverrideBehaviorTooltip() {
          return vm.t('trackingOverrideBehavior');
        },
        // Returns the translated inline error for a free-form row, or '' if ok.
        getFreeFormError(trackingUrl) {
          const code = this.freeFormErrors.get(trackingUrl);
          return code ? vm.t(code) : '';
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
            const values = Array.isArray(param.values) ? param.values : [];
            const lockedValues = !!param.lockedValues && values.length > 0;
            // Determine the value to pre-fill so the row is never left empty
            // when a value is effectively imposed/suggested:
            //   - locked: the value is imposed by the admin → always force it
            //     (values[0]). It must not depend on the user focusing the
            //     field, otherwise a required+locked param stays "missing".
            //   - unlocked with a single allowed value → suggest it (editable).
            // Anything else (multiple unlocked values, no value) stays empty
            // so the user actively picks/types.
            let prefill = '';
            if (lockedValues) prefill = values[0];
            else if (values.length === 1) prefill = values[0];
            if (idx === -1) {
              current.push({ key: param.key, value: prefill });
              mutated = true;
            } else if (lockedValues && current[idx].value !== values[0]) {
              // Locked value must always reflect the admin-imposed value,
              // overriding any stale/forged value already present.
              current[idx] = Object.assign({}, current[idx], {
                value: values[0],
              });
              mutated = true;
            } else if (prefill && !current[idx].value) {
              current[idx] = Object.assign({}, current[idx], { value: prefill });
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
            <span class="tracking-info-icon" :title="getOverrideBehaviorTooltip()" role="img" :aria-label="getOverrideBehaviorTooltip()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </span>
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
                  <strong class="tracking-key-label">{{ row.key }}</strong>
                  <span
                    v-if="row.required"
                    class="tracking-required"
                    title="Champ obligatoire"
                  >*</span>
                </div>
                <span class="tracking-equals">=</span>
                <div class="propInput tracking-input">
                  <!-- Locked + multiple values: same combobox in strict mode
                       (input read-only) so the dropdown look matches the
                       unlocked case. -->
                  <tracking-combobox
                    v-if="row.lockedValues && row.values.length > 1"
                    strict
                    :value="row.value"
                    :options="row.values"
                    placeholder="value"
                    @input="(val) => setManagedValue(row.key, val)"
                  ></tracking-combobox>
                  <!-- Locked + single value: read-only, value forced -->
                  <input
                    v-else-if="row.lockedValues && row.values.length === 1"
                    type="text"
                    :value="row.values[0]"
                    readonly
                    @focus="setManagedValue(row.key, row.values[0])"
                  />
                  <!-- Unlocked + multiple values: combobox (chevron opens
                       the suggestion list; the input value stays editable). -->
                  <tracking-combobox
                    v-else-if="row.values.length > 1"
                    :value="row.value"
                    :options="row.values"
                    placeholder="value"
                    @input="(val) => setManagedValue(row.key, val)"
                  ></tracking-combobox>
                  <!-- Unlocked + 1 value (or no values): plain editable input.
                       Single-value case is pre-filled by ensureManagedRows; no
                       chevron needed because there is nothing to choose from. -->
                  <input
                    v-else
                    type="text"
                    :value="row.value"
                    placeholder="value"
                    @input="setManagedValue(row.key, $event.target.value)"
                  />
                </div>
                <!-- Disabled remove button: same footprint as free-form rows
                     so columns align, but greyed out + tooltip explaining the
                     param is locked by the group config -->
                <span
                  class="tracking-remove-btn tracking-remove-btn--locked"
                  :title="getLockedTooltip()"
                  :aria-label="getLockedTooltip()"
                  aria-disabled="true"
                  role="img"
                >
                  <span class="lucide lucide-x"></span>
                </span>
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
                    <input
                      type="text"
                      placeholder="key"
                      v-model="trackingUrl.key"
                      :class="{ 'tracking-input--error': !!getFreeFormError(trackingUrl) }"
                    />
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
                <p
                  v-if="getFreeFormError(trackingUrl)"
                  class="tracking-error"
                >{{ getFreeFormError(trackingUrl) }}</p>
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
            <div v-for="(trackingUrl, index) in trackingUrls" :key="'legacy-' + index" class="tracking-param-row">
              <div class="propEditor tracking-param-editor">
                <div class="propInput tracking-input">
                  <input
                    type="text"
                    placeholder="key"
                    v-model="trackingUrl.key"
                    :class="{ 'tracking-input--error': !!getFreeFormError(trackingUrl) }"
                  />
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
              <p
                v-if="getFreeFormError(trackingUrl)"
                class="tracking-error"
              >{{ getFreeFormError(trackingUrl) }}</p>
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
