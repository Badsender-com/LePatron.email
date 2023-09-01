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
      personalizedBlocks: [],
      isLoading: false,
    }),
    mounted() {
      this.fetchPersonalizedBlocks();
    },
    methods: {
      fetchPersonalizedBlocks() {
        this.isLoading = true;
        const groupId = this.vm?.metadata?.groupId;

        axios
          .get(getPersonalizedBlocks(), { params: { groupId } })
          .then((response) => {
            this.personalizedBlocks = response.data?.items;
            this.isLoading = false;
          })
          .catch((error) => {
            this.vm.notifier.error(this.vm.t('fetch-blocks-error'));
            this.isLoading = false;
          });
      },
    },
    computed: {
      imagePath() {
        return type => {
          return this.vm.templatePath('edres/' + type + '.png');
        };
      },
    },
    template: `
      <div class="block-list" style="text-align: center">
        <!-- Loading Spinner -->
        <div v-if="isLoading">
          <span>Loading...</span>
        </div>
        <!-- List of Personalized Blocks -->
        <div v-else v-for="block in personalizedBlocks" :key="block.id" class="draggable-item">
          <div class="block" style="position: relative;">
            <div title="Click or drag to add this block to the template" class="handle"></div>
            <!-- Add an image for each block, customize the src attribute based on your API data -->
            <img :alt="block.content.type" :src="imagePath(block.content.type)" />
            <span class="block-name">{{ block.name }}</span>
          </div>
          <div class="addblockbutton">Add</div>
        </div>
      </div>
    `,
  }
);

module.exports = {
  PersonalizedBlocksListComponent,
};
