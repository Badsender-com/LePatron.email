const Vue = require('vue/dist/vue.common');

module.exports = {
  viewModel(vm, ko) {
    // const trackingUrl = ko.observable(null);
    // vm.content({ ...vm.content(), trackingUrl: trackingUrl })

  },
  init(vm) {
    // Init VueJS component
    Vue.component('TrackingParamsPlugin', {
      components: {
      },
      data: () => ({
        // subscriptionTrackingUrl: null,
        trackingUrl: vm.content().trackingUrl(),
      }),
      mounted() {
        // this.subscriptionTrackingUrl = vm.content().trackingUrl().subscribe(this.updateTrackingUrl)
      },
      // beforeDestroy() {
      //   this.subscriptionTrackingUrl.dispose();
      // },
      watch: {
        trackingUrl(newTrackingUrl) {
          vm.content().trackingUrl(newTrackingUrl);
        }
      },
      methods: {
        clickTemplate(obj) {
          console.log(obj);
          console.log({ content: vm.content()});
        },
        // updateTrackingUrl(data) {
        //   console.log({ data });
        //   console.log({ trackingUrl: this.viewModel.content().trackingUrl() });
        //   this.trackingUrl = data
        // }
      },
      template: `
        <div class="objEdit level1">
          <span class="objLabel level1">
            <span data-bind="text: $root.ut('template', 'Tracking')">Tracking</span>
          </span>
          <div class="propEditor">
            <span class="propLabel">
              <span data-bind="text: $root.ut('template', 'Tracking')">Tracking URL</span>
            </span>
            <div class="propInput">
              <label>
                <input
                  type="text"
                  v-model="trackingUrl"
                />
              </label>
            </div>
          </div>
        </div>
      `,
    });

    new Vue({ el: '#tracking-params' });
  },
};
