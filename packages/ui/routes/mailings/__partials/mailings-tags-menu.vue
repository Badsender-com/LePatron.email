<script>
import BsModalTagsForm from '~/components/mailings/modal-tags-form';
const CHECKBOX_UNCHECKED = 'check_box_outline_blank';
const CHECKBOX_CHECKED = 'check_box';

export default {
  name: 'BsMailingsTagsMenu',
  components: {
    BsModalTagsForm,
  },

  props: {
    tags: { type: Array, default: () => [] },
    selectedMailTags: { type: Array, default: () => [] },
  },
  data() {
    return {
      showTagMenu: false,
      addedTags: [],
      newTags: [],
      removedTags: [],
    };
  },
  computed: {
    tagsCheckboxList() {
      return [...this.tags, ...this.newTags].map((tag) => {
        if (this.addedTags.includes(tag.label)) {
          return { ...tag, checkIcon: CHECKBOX_CHECKED };
        }
        if (this.removedTags.includes(tag.label)) {
          return { ...tag, checkIcon: CHECKBOX_UNCHECKED };
        }
        const isSelected = this.selectedMailTags.some(
          (t) => t.label === tag.label
        );
        return {
          ...tag,
          checkIcon: isSelected ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED,
        };
      });
    },
  },
  watch: {
    showTagMenu: {
      handler(val) {
        if (val) {
          this.addedTags = this.selectedMailTags.map((tag) => tag.label);
          this.removedTags = [];
          return;
        }
        this.addedTags = [];
        this.removedTags = [];
      },
      deep: true,
    },
  },

  methods: {
    closeMenu() {
      this.showTagMenu = false;
    },
    openMenu() {
      this.showTagMenu = true;
    },
    closeNewTagDialog() {
      this.$refs.createTags.close();
    },
    openNewTagDialog() {
      this.$refs.createTags.open();
    },
    createNewTag(label) {
      if (!label) return;
      if (![...this.tags, ...this.newTags].some((tag) => tag.label === label)) {
        this.newTags.push({ label });
      }
    },
    toggleTag(tagCheckbox) {
      const { checkIcon: tagStatus, label: tagLabel } = tagCheckbox;
      if (tagStatus === CHECKBOX_UNCHECKED) {
        this.removedTags = this.removedTags.filter(
          (tag) => tag.label !== tagLabel
        );
        this.addedTags.push(tagLabel);
        return;
      }
      if (tagStatus === CHECKBOX_CHECKED) {
        this.addedTags = this.addedTags.filter((tag) => tag !== tagLabel);
        this.removedTags.push({ label: tagLabel });
      }
    },
    updateMailingsTags() {
      this.showTagMenu = false;
      const addedTags = this.addedTags.map((label) => {
        const existingTag = this.tags.find((tag) => tag.label === label);
        return existingTag || { label };
      });
      const removedTags = this.removedTags.map((tag) => {
        const existingTag = this.tags.find(
          (existingTag) => existingTag.label === tag.label
        );
        return existingTag ? { _id: existingTag._id } : { label: tag.label };
      });
      this.$emit('update-tags', {
        added: addedTags,
        removed: removedTags,
      });
    },
  },
};
</script>

<template>
  <div>
    <v-dialog v-model="showTagMenu" :close-on-content-click="false" width="300">
      <v-card flat tile>
        <v-list>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title class="title">
                {{ $t('tags.list') }}
              </v-list-item-title>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn icon @click="closeMenu">
                <v-icon>close</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
        <v-divider />
        <v-list>
          <v-list-item
            v-for="tagCheckbox in tagsCheckboxList"
            :key="tagCheckbox.label"
            @click="toggleTag(tagCheckbox)"
          >
            <v-list-item-action>
              <v-icon>{{ tagCheckbox.checkIcon }}</v-icon>
            </v-list-item-action>
            <v-list-item-title>{{ tagCheckbox.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" text @click="openNewTagDialog">
            {{ $t('tags.new') }}
          </v-btn>
          <v-btn color="accent" elevation="0" @click="updateMailingsTags">
            {{ $t('global.apply') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <bs-modal-tags-form
      ref="createTags"
      width="500"
      :close-on-content-click="false"
      :input-label="$t('global.name')"
      @confirm="createNewTag"
    />
  </div>
</template>
