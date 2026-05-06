<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form.vue';
import BsFormSection from '~/components/layout/BsFormSection.vue';
import {
  FileText,
  Upload,
  Image as ImageIcon,
  X,
  Check,
  Download,
  ExternalLink,
  Trash2,
} from 'lucide-vue';

const SUPPORTED_IMAGES_FORMAT = '.png,.gif,.jpg,.webp';

export default {
  name: 'BsTemplateForm',
  components: {
    BsTextField,
    BsSelect,
    BsModalConfirmForm,
    BsFormSection,
    LucideFileText: FileText,
    LucideUpload: Upload,
    LucideImage: ImageIcon,
    LucideX: X,
    LucideCheck: Check,
    LucideDownload: Download,
    LucideExternalLink: ExternalLink,
    LucideTrash2: Trash2,
  },
  mixins: [validationMixin],
  SUPPORTED_IMAGES_FORMAT,
  props: {
    template: { type: Object, default: () => ({}) },
    groups: { type: Array, default: () => [] },
    isEditMode: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    hideGroupSelect: { type: Boolean, default: false },
  },
  data() {
    return {
      localTemplate: {
        name: '',
        description: '',
        groupId: '',
        ...this.template,
      },
      markup: null,
      images: [],
      dragOverMarkup: false,
      dragOverImages: false,
    };
  },
  validations() {
    const rules = {
      localTemplate: {
        name: { required },
      },
    };
    if (!this.isEditMode) {
      rules.localTemplate.groupId = { required };
    }
    return rules;
  },
  computed: {
    groupOptions() {
      return this.groups.map((g) => ({
        text: g.name,
        value: g.id,
      }));
    },
    showGroupSelect() {
      // Show group select only in create mode when group is not pre-selected
      return !this.isEditMode && !this.hideGroupSelect;
    },
    showGroupInfo() {
      // Show group info (read-only) only in create mode when group is pre-selected
      // In edit mode, the group is shown in the left navigation, so no need to display it here
      return !this.isEditMode && this.hideGroupSelect;
    },
    displayedGroupName() {
      // In edit mode, use template.group. In create mode with pre-selected group, use first group from list
      if (this.isEditMode) {
        return this.template.group?.name || '';
      }
      if (this.hideGroupSelect && this.groups.length > 0) {
        return this.groups[0].name;
      }
      return '';
    },
    displayedGroupId() {
      if (this.isEditMode) {
        return this.template.group?.id || '';
      }
      if (this.hideGroupSelect && this.groups.length > 0) {
        return this.groups[0].id;
      }
      return '';
    },
    hasMarkup() {
      return this.template.hasMarkup || this.markup !== null;
    },
    hasImages() {
      if (this.template.assets == null) return false;
      return Object.keys(this.template.assets).length > 0;
    },
    hasCover() {
      if (this.template.assets == null) return false;
      return this.template.assets['_full.png'] != null;
    },
    coverSrc() {
      if (!this.hasCover) return '';
      const imageName = this.template.assets['_full.png'];
      return apiRoutes.imagesItem({ imageName });
    },
    imagesList() {
      if (!this.hasImages) return [];
      return Object.entries(this.template.assets).map(
        ([originalName, imageName]) => ({
          originalName,
          href: apiRoutes.imagesItem({ imageName }),
        })
      );
    },
    previewHref() {
      if (!this.template.id) return '';
      return apiRoutes.templatesItemMarkup({ templateId: this.template.id });
    },
    downloadHref() {
      return `${this.previewHref}?download=true`;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.localTemplate.name.$dirty) return errors;
      if (!this.$v.localTemplate.name.required) {
        errors.push(this.$t('global.errors.required'));
      }
      return errors;
    },
    groupErrors() {
      const errors = [];
      if (!this.$v.localTemplate.groupId?.$dirty) return errors;
      if (!this.$v.localTemplate.groupId?.required) {
        errors.push(this.$t('global.errors.required'));
      }
      return errors;
    },
    submitLabel() {
      return this.isEditMode
        ? this.$t('global.save')
        : this.$t('global.create');
    },
  },
  watch: {
    template: {
      handler(newTemplate) {
        this.localTemplate = {
          ...this.localTemplate,
          ...newTemplate,
        };
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const formData = new FormData();
      formData.append('name', this.localTemplate.name);
      formData.append('description', this.localTemplate.description || '');

      if (!this.isEditMode) {
        formData.append('groupId', this.localTemplate.groupId);
      }

      if (this.markup) {
        formData.append('markup', this.markup);
      }

      if (Array.isArray(this.images) && this.images.length > 0) {
        this.images.forEach((image) => {
          formData.append('images', image, image.name);
        });
      }

      this.$emit('submit', formData);
    },

    // Delete confirmation
    confirmDelete() {
      this.$refs.deleteDialog.open({
        name: this.localTemplate.name,
        id: this.template.id,
      });
    },

    onDeleteConfirm() {
      this.$emit('delete');
    },

    // File handling - Markup
    onMarkupFileChange(event) {
      const file = event.target.files[0];
      if (file) {
        this.markup = file;
      }
    },

    onMarkupDragOver(event) {
      event.preventDefault();
      this.dragOverMarkup = true;
    },

    onMarkupDragLeave() {
      this.dragOverMarkup = false;
    },

    onMarkupDrop(event) {
      event.preventDefault();
      this.dragOverMarkup = false;
      const file = event.dataTransfer.files[0];
      if (file && file.name.endsWith('.html')) {
        this.markup = file;
      } else {
        this.showSnackbar({
          text: this.$t('templates.invalidMarkupFormat'),
          color: 'error',
        });
      }
    },

    clearMarkup() {
      this.markup = null;
      if (this.$refs.markupInput) {
        this.$refs.markupInput.value = '';
      }
    },

    // File handling - Images
    onImagesFileChange(event) {
      const files = Array.from(event.target.files);
      this.images = [...this.images, ...files];
    },

    onImagesDragOver(event) {
      event.preventDefault();
      this.dragOverImages = true;
    },

    onImagesDragLeave() {
      this.dragOverImages = false;
    },

    onImagesDrop(event) {
      event.preventDefault();
      this.dragOverImages = false;
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        SUPPORTED_IMAGES_FORMAT.split(',').some((ext) =>
          file.name.toLowerCase().endsWith(ext)
        )
      );
      this.images = [...this.images, ...files];
    },

    removeImage(index) {
      this.images.splice(index, 1);
    },

    // Actions
    deleteImages() {
      this.$emit('deleteImages');
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form" class="template-form" @submit.prevent="onSubmit">
    <v-card-text>
      <!-- General Information Section -->
      <bs-form-section>
        <template #icon>
          <lucide-file-text :size="20" />
        </template>
        <template #title>
          {{ $t('templates.generalInfo') }}
        </template>
        <template #description>
          {{ $t('templates.generalInfoDescription') }}
        </template>
        <bs-text-field
          v-model="localTemplate.name"
          :label="$t('global.name')"
          :error-messages="nameErrors"
          :disabled="disabled"
          required
          autofocus
          @blur="$v.localTemplate.name.$touch()"
        />

        <div class="bs-textarea">
          <label class="bs-textarea__label">
            {{ $t('global.description') }}
          </label>
          <v-textarea
            v-model="localTemplate.description"
            :disabled="disabled"
            auto-grow
            rows="2"
            solo
            flat
            hide-details
            class="bs-textarea__input"
          />
        </div>

        <bs-select
          v-if="showGroupSelect"
          v-model="localTemplate.groupId"
          :label="$tc('global.company', 1)"
          :items="groupOptions"
          :error-messages="groupErrors"
          :disabled="disabled"
          required
          @blur="$v.localTemplate.groupId && $v.localTemplate.groupId.$touch()"
        />

        <div v-if="showGroupInfo" class="template-company-info">
          <span class="template-company-info__label">{{
            $tc('global.company', 1)
          }}</span>
          <nuxt-link
            v-if="displayedGroupId"
            :to="`/groups/${displayedGroupId}`"
            class="template-company-info__link"
          >
            {{ displayedGroupName }}
          </nuxt-link>
        </div>
      </bs-form-section>

      <!-- Template Files Section (only in edit mode) -->
      <bs-form-section v-if="isEditMode">
        <template #icon>
          <lucide-upload :size="20" />
        </template>
        <template #title>
          {{ $t('templates.templateFiles') }}
        </template>
        <template #description>
          {{ $t('templates.templateFilesDescription') }}
        </template>
        <!-- Markup Upload -->
        <div class="file-upload-field">
          <label class="file-upload-field__label">
            {{ $t('templates.markup') }}
            <span v-if="!isEditMode" class="file-upload-field__required"
              >*</span
            >
          </label>

          <!-- Show existing markup info if in edit mode -->
          <div
            v-if="isEditMode && template.hasMarkup && !markup"
            class="file-existing"
          >
            <div class="file-existing__info">
              <lucide-check
                :size="18"
                class="file-existing__icon accent--text"
              />
              <span>{{ $t('templates.markupUploaded') }}</span>
            </div>
            <div class="file-existing__actions">
              <v-btn
                small
                text
                color="accent"
                :href="downloadHref"
                :disabled="disabled"
              >
                <lucide-download :size="16" class="mr-1" />
                {{ $t('global.download') }}
              </v-btn>
              <v-btn
                small
                text
                color="primary"
                :href="previewHref"
                target="_blank"
                :disabled="disabled"
              >
                <lucide-external-link :size="16" class="mr-1" />
                {{ $t('global.preview') }}
              </v-btn>
            </div>
          </div>

          <!-- Show new file if selected -->
          <div v-if="markup" class="file-selected">
            <div class="file-selected__info">
              <lucide-file-text :size="18" class="file-selected__icon" />
              <span class="file-selected__name">{{ markup.name }}</span>
            </div>
            <v-btn icon small :disabled="disabled" @click="clearMarkup">
              <lucide-x :size="18" />
            </v-btn>
          </div>

          <!-- Drop zone -->
          <div
            v-if="!markup"
            class="file-dropzone"
            :class="{ 'file-dropzone--active': dragOverMarkup }"
            @dragover="onMarkupDragOver"
            @dragleave="onMarkupDragLeave"
            @drop="onMarkupDrop"
            @click="$refs.markupInput.click()"
          >
            <lucide-upload :size="32" class="file-dropzone__icon" />
            <p class="file-dropzone__text">
              {{ $t('templates.dropMarkupHere') }}
            </p>
            <p class="file-dropzone__hint">
              {{ $t('templates.markupFormats') }}
            </p>
            <input
              ref="markupInput"
              type="file"
              accept=".html"
              class="file-dropzone__input"
              :disabled="disabled"
              @change="onMarkupFileChange"
            />
          </div>
        </div>

        <!-- Images Upload -->
        <div class="file-upload-field">
          <label class="file-upload-field__label">
            {{ $tc('global.image', 2) }}
          </label>

          <!-- Show existing images if in edit mode -->
          <div v-if="isEditMode && hasImages" class="images-existing">
            <div class="images-existing__header">
              <span>{{
                $t('templates.existingImages', { count: imagesList.length })
              }}</span>
              <v-btn
                small
                text
                color="error"
                :disabled="disabled"
                @click="deleteImages"
              >
                <lucide-trash2 :size="16" class="mr-1" />
                {{ $t('templates.removeAllImages') }}
              </v-btn>
            </div>
            <div class="images-existing__grid">
              <div
                v-for="image in imagesList"
                :key="image.originalName"
                class="images-existing__item"
              >
                <img
                  :src="image.href"
                  :alt="image.originalName"
                  loading="lazy"
                  class="images-existing__thumb"
                />
                <span class="images-existing__name">{{
                  image.originalName
                }}</span>
              </div>
            </div>
          </div>

          <!-- Show new images if selected -->
          <div v-if="images.length > 0" class="images-selected">
            <div class="images-selected__header">
              <span>{{
                $t('templates.newImages', { count: images.length })
              }}</span>
            </div>
            <div class="images-selected__list">
              <div
                v-for="(image, index) in images"
                :key="index"
                class="images-selected__item"
              >
                <lucide-image :size="16" class="images-selected__icon" />
                <span class="images-selected__name">{{ image.name }}</span>
                <v-btn
                  icon
                  x-small
                  :disabled="disabled"
                  @click="removeImage(index)"
                >
                  <lucide-x :size="14" />
                </v-btn>
              </div>
            </div>
          </div>

          <!-- Drop zone for images -->
          <div
            class="file-dropzone"
            :class="{ 'file-dropzone--active': dragOverImages }"
            @dragover="onImagesDragOver"
            @dragleave="onImagesDragLeave"
            @drop="onImagesDrop"
            @click="$refs.imagesInput.click()"
          >
            <lucide-image :size="32" class="file-dropzone__icon" />
            <p class="file-dropzone__text">
              {{ $t('templates.dropImagesHere') }}
            </p>
            <p class="file-dropzone__hint">
              {{ $t('templates.imageFormats') }}
            </p>
            <input
              ref="imagesInput"
              type="file"
              :accept="$options.SUPPORTED_IMAGES_FORMAT"
              multiple
              class="file-dropzone__input"
              :disabled="disabled"
              @change="onImagesFileChange"
            />
          </div>
        </div>
      </bs-form-section>

      <!-- Info message in create mode about files -->
      <bs-form-section v-if="!isEditMode" last>
        <template #icon>
          <lucide-upload :size="20" />
        </template>
        <template #title>
          {{ $t('templates.templateFiles') }}
        </template>
        <template #description>
          {{ $t('templates.filesAvailableAfterCreation') }}
        </template>
      </bs-form-section>

      <!-- Preview Section (only in edit mode with markup) -->
      <bs-form-section v-if="isEditMode && hasCover">
        <template #icon>
          <lucide-image :size="20" />
        </template>
        <template #title>
          {{ $t('global.preview') }}
        </template>
        <template #description>
          {{ $t('templates.previewDescription') }}
        </template>
        <div class="template-preview">
          <img
            :src="coverSrc"
            alt="Template preview"
            class="template-preview__image"
          />
        </div>
      </bs-form-section>
    </v-card-text>

    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn
        type="submit"
        color="accent"
        elevation="0"
        :disabled="disabled"
        :loading="disabled"
      >
        {{ submitLabel }}
      </v-btn>
    </v-card-actions>

    <!-- Delete Confirmation Modal -->
    <bs-modal-confirm-form
      v-if="isEditMode"
      ref="deleteDialog"
      :title="$t('templates.deleteConfirmTitle')"
      :action-label="$t('global.delete')"
      :confirmation-input-label="$t('templates.confirmationField')"
      @confirm="onDeleteConfirm"
    >
      <p class="black--text">
        {{ $t('templates.deleteWarningMessage', { name: localTemplate.name }) }}
      </p>
    </bs-modal-confirm-form>
  </v-card>
</template>

<style lang="scss" scoped>
// Textarea styling (matches design system)
.bs-textarea {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__input {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      border-radius: 4px;
      background: #fff !important;
      min-height: 40px;
      padding: 8px 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4) !important;
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: #00acdc !important;
    }

    ::v-deep textarea {
      font-size: 0.875rem;
      line-height: 1.5;
    }
  }
}

// Company info display (edit mode)
.template-company-info {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__link {
    font-size: 0.875rem;
    color: var(--v-primary-base);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

// File upload field
.file-upload-field {
  margin-bottom: 1.5rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.5rem;
  }

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }
}

// File dropzone
.file-dropzone {
  border: 2px dashed rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafafa;

  &:hover {
    border-color: var(--v-accent-base);
    background: rgba(0, 172, 220, 0.04);
  }

  &--active {
    border-color: var(--v-accent-base);
    background: rgba(0, 172, 220, 0.08);
  }

  &__icon {
    color: rgba(0, 0, 0, 0.3);
    margin-bottom: 0.75rem;
  }

  &__text {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
    margin: 0 0 0.25rem 0;
  }

  &__hint {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
    margin: 0;
  }

  &__input {
    display: none;
  }
}

// File existing (edit mode)
.file-existing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(0, 172, 220, 0.08);
  border-radius: 8px;
  margin-bottom: 1rem;

  &__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  &__icon {
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
  }
}

// File selected (new upload)
.file-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 1rem;

  &__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__icon {
    color: var(--v-accent-base);
    flex-shrink: 0;
  }

  &__name {
    font-size: 0.875rem;
  }
}

// Images existing
.images-existing {
  margin-bottom: 1rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  &__thumb {
    width: 80px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  &__name {
    font-size: 0.625rem;
    color: rgba(0, 0, 0, 0.6);
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// Images selected (new uploads)
.images-selected {
  margin-bottom: 1rem;

  &__header {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
    margin-bottom: 0.5rem;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 8px;
    max-height: 150px;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: white;
    border-radius: 4px;
  }

  &__icon {
    color: var(--v-accent-base);
    flex-shrink: 0;
  }

  &__name {
    flex: 1;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// Template preview
.template-preview {
  width: 560px;
  height: 380px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;

  &__image {
    width: 560px;
    height: 380px;
    object-fit: cover;
    display: block;
  }
}
</style>
