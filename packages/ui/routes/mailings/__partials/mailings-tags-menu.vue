<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

const CHECKBOX_UNCHECKED = 'check_box_outline_blank';
const CHECKBOX_CHECKED = 'check_box';
export default {
  name: 'BsMailingsTagsMenu',
  mixins: [validationMixin],
  props: {
    tags: { type: Array, default: () => [] },
    selectedMailTags: { type: Array, default: () => [] },
  },
  data() {
    return {
      showTagMenu: false,
      newTagDialog: false,
      newTagName: '',
      addedTags: [],
      newTags: [],
      removedTags: [],
    };
  },
  validations() {
    return {
      newTagName: { required },
    };
  },
  computed: {
    tagsCheckboxList() {
      return [...this.tags, ...this.newTags].map((tagName) => {
        if (this.addedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_CHECKED };
        }
        if (this.removedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
        }
        return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
      });
    },
    tagNameErrors() {
      const errors = [];
      if (!this.$v?.newTagName?.$dirty) return errors;
      !this.$v?.newTagName?.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  watch: {
    showTagMenu: {
      handler: function (val) {
        if (val) {
          this.addedTags = [...this.selectedMailTags];
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
      this.newTagDialog = false;
    },
    openNewTagDialog() {
      this.newTagDialog = true;
    },
    onCreateNewTag() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      const { newTagName } = this;
      if (![...this.tags, ...this.newTags].includes(newTagName)) {
        this.newTags.push(newTagName);
      }
      this.closeNewTagDialog();
    },
    toggleTag(tagCheckbox) {
      const { checkIcon: tagStatus, name: tagName } = tagCheckbox;
      if (tagStatus === CHECKBOX_UNCHECKED) {
        this.removedTags = this.removedTags.filter((tag) => tag !== tagName);
        this.addedTags.push(tagName);
        return;
      }
      if (tagStatus === CHECKBOX_CHECKED) {
        this.addedTags = this.addedTags.filter((tag) => tag !== tagName);
        this.removedTags.push(tagName);
      }
    },
    onUpdateMailingsTags() {
      this.showTagMenu = false;
      this.$emit('update-tags', {
        added: [...this.addedTags],
        removed: [...this.removedTags],
      });
    },
  },
};
</script>

<template>
  <div>
    <v-dialog
      v-model="showTagMenu"
      :close-on-content-click="false"
      :width="300"
    >
      <v-card>
        <v-list>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title class="title">
                {{ $t(`tags.list`) }}
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
            :key="tagCheckbox.name"
            @click="toggleTag(tagCheckbox)"
          >
            <v-list-item-action>
              <v-icon>{{ tagCheckbox.checkIcon }}</v-icon>
            </v-list-item-action>
            <v-list-item-title>{{ tagCheckbox.name }}</v-list-item-title>
          </v-list-item>
        </v-list>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" text @click="openNewTagDialog">
            {{ $t('tags.new') }}
          </v-btn>
          <v-btn color="primary" @click="onUpdateMailingsTags">
            {{ $t(`global.apply`) }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="newTagDialog" width="500">
      <v-card>
        <v-card-title class="headline">
          {{ $t('tags.new') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newTagName"
            :label="$t('global.name')"
            :error-messages="tagNameErrors"
            @input="$v.newTagName.$touch()"
            @blur="$v.newTagName.$touch()"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeNewTagDialog">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn color="primary" @click="onCreateNewTag">
            {{ $t('global.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
