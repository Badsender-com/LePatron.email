const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { getPersonalizedBlocks } = require('../../utils/apis');

const PersonalizedBlocksListComponent = Vue.component(
  'PersonalizedBlocksListComponent',
  {
    props: {
      vm: { type: Object, default: () => ({}) },
    },
    data: () => ({
      isLoading: false,
    }),
    mounted() {
      this.fetchPersonalizedBlocks();
      // Add a global event listener to refresh the list of personalized blocks when a new block is added.
      window.addEventListener(
        'personalizedBlockApiActionApplied',
        this.fetchPersonalizedBlocks
      );
    },
    beforeDestroy() {
      // Make sure to remove the listener when the component is destroyed
      window.removeEventListener(
        'personalizedBlockApiActionApplied',
        this.fetchPersonalizedBlocks
      );
    },
    methods: {
      fetchPersonalizedBlocks() {
        this.isLoading = true;
        const groupId = this.vm?.metadata?.groupId;

        axios
          .get(getPersonalizedBlocks(), { params: { groupId } })
          .then((response) => {
            this.vm.personalizedBlocks(
              response.data?.items.map(({ content, ...blockInformation }) => ({
                ...content,
                blockInformation,
                id: "" // This line is crucial. The `viewModel.loadDefaultBlocks` function will override this `id` when the block is added to the email content. Without this placeholder, there could be issues when adding personalized blocks in emails.
              }))
            );
            this.isLoading = false;
          })
          .catch((error) => {
            this.vm.notifier.error(
              this.vm.t('personalized-blocks-fetch-error')
            );
            this.isLoading = false;
          });
      },
    },
    template: `
    <div id="personalized-blocks-list">
      <div v-if="isLoading" class="loading-state">
        <!-- Loading Spinner -->
        <span>{{ vm.t('personalized-blocks-loading') }}</span>
      </div>
      <div v-else-if="vm.personalizedBlocks().length === 0" class="empty-state">
        <!-- Empty State -->
        <span>{{ vm.t('personalized-blocks-empty') }}</span>
      </div>
    </div>
    `,
  }
);

module.exports = {
  PersonalizedBlocksListComponent,
};
