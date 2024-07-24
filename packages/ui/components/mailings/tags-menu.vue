<script>
import BsModalTagsForm from '~/components/mailings/modal-tags-form';
const CHECKBOX_UNCHECKED = 'check_box_outline_blank';
const CHECKBOX_CHECKED = 'check_box';
const CHECKBOX_INDETERMINATE = 'indeterminate_check_box';

export default {
  name: 'BsMailingsTagsMenu',
  components: {
    BsModalTagsForm,
  },
  props: {
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
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
      const uniqueTagsMap = new Map();

      [...this.tags, ...this.newTags].forEach((tag) => {
        if (!uniqueTagsMap.has(tag.label) || tag._id) {
          uniqueTagsMap.set(tag.label, tag);
        }
      });

      return Array.from(uniqueTagsMap.values()).map((tag) => {
        if (this.addedTags.includes(tag.label)) {
          return { ...tag, checkIcon: CHECKBOX_CHECKED };
        }
        if (this.removedTags.includes(tag.label)) {
          return { ...tag, checkIcon: CHECKBOX_UNCHECKED };
        }
        const mailingsTagCount = this.mailingsSelection.reduce(
          (count, mailing) =>
            count +
            mailing.tags.filter((mailingTag) => mailingTag.label === tag.label)
              .length,
          0
        );
        if (mailingsTagCount === this.mailingsSelection.length) {
          return { ...tag, checkIcon: CHECKBOX_CHECKED };
        }
        if (mailingsTagCount) {
          return { ...tag, checkIcon: CHECKBOX_INDETERMINATE };
        }
        return { ...tag, checkIcon: CHECKBOX_UNCHECKED };
      });
    },
  },

  watch: {
    showTagMenu: {
      handler(val) {
        if (val) {
          this.addedTags = this.mailingsSelection
            .reduce((allTags, mailing) => [...allTags, ...mailing.tags], [])
            .map((tag) => tag.label);
          this.removedTags = [];
        } else {
          this.addedTags = [];
          this.removedTags = [];
        }
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
      } else if (
        tagStatus === CHECKBOX_CHECKED ||
        tagStatus === CHECKBOX_INDETERMINATE
      ) {
        this.addedTags = this.addedTags.filter((tag) => tag !== tagLabel);
        this.removedTags.push({ label: tagLabel });
      }
    },
    updateMailingsTags() {
      this.showTagMenu = false;

      const uniqueAddedTags = new Set(
        this.addedTags.map((label) => {
          const existingTag = this.tags.find((tag) => tag.label === label);
          return existingTag ? existingTag._id || label : label;
        })
      );

      const uniqueRemovedTags = new Set(
        this.removedTags.map((tag) => {
          const existingTag = this.tags.find(
            (existingTag) => existingTag.label === tag.label
          );
          return existingTag ? existingTag._id || tag.label : tag.label;
        })
      );

      const addedTags = Array.from(uniqueAddedTags).map((idOrLabel) => {
        const existingTag = this.tags.find(
          (tag) => tag._id === idOrLabel || tag.label === idOrLabel
        );
        return existingTag || { label: idOrLabel };
      });

      const removedTags = Array.from(uniqueRemovedTags).map((idOrLabel) => {
        const existingTag = this.tags.find(
          (tag) => tag._id === idOrLabel || tag.label === idOrLabel
        );
        return existingTag ? { _id: existingTag._id } : { label: idOrLabel };
      });

      this.$emit('update', {
        added: addedTags,
        removed: removedTags,
      });
    },
  },
};
</script>

<template>
  <!-- pile up menu & tooltip -->
  <!-- https://stackoverflow.com/a/58077496 -->
  <v-menu
    v-model="showTagMenu"
    :close-on-content-click="false"
    :nudge-width="300"
  >
    <template #activator="{ on: onMenu }">
      <v-tooltip bottom :disabled="showTagMenu">
        <template #activator="{ on: onTooltip }">
          <v-btn icon v-on="{ ...onMenu, ...onTooltip }">
            <v-icon>label</v-icon>
          </v-btn>
        </template>
        <span>{{ $t('tags.handle') }}</span>
      </v-tooltip>
    </template>
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
        <v-btn elevation="0" color="accent" @click="updateMailingsTags">
          {{ $t('global.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <bs-modal-tags-form
      ref="createTags"
      width="500"
      :close-on-content-click="false"
      :input-label="$t('global.name')"
      @confirm="createNewTag"
    />
  </v-menu>
</template>

<style lang="scss" scoped></style>
