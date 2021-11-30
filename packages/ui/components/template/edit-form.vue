<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

export default {
  name: 'BsTemplateEditForm',
  mixins: [validationMixin],
  SUPPORTED_IMAGES_FORMAT: '.png,.gif,.jpg',
  model: { prop: 'template', event: 'update' },
  props: {
    template: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return { markup: '', images: [] };
  },
  computed: {
    localModel: {
      get() {
        return this.template;
      },
      set(updatedTemplate) {
        this.$emit('update', updatedTemplate);
      },
    },
  },
  validations() {
    return {
      template: {
        name: { required },
      },
    };
  },
  methods: {
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.template[fieldName].$dirty) return errors;
      !this.$v.template[fieldName].required &&
        errors.push(this.$t('errors.required'));
      return errors;
    },
    onSubmit() {
      console.log('onSubmit');
      this.$v.$touch();
      if (this.$v.$invalid) return;
      // Send a formData
      // https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
      // https://alligator.io/vuejs/uploading-vue-picture-input/
      const formData = new FormData();
      formData.append('name', this.template.name);
      formData.append('description', this.template.description);
      if (this.markup) formData.append('markup', this.markup);
      if (Array.isArray(this.images)) {
        this.images.forEach((image) => {
          formData.append('images', image, image.name);
        });
      }
      this.$emit('submit', formData);
    },
    updateMarkup(markup) {
      this.markup = markup;
    },
    updateImages(images) {
      console.log('updateImages', images);
      this.images = images;
    },
  },
};
</script>

<template>
  <form class="template-edit-form" @submit.prevent="onSubmit">
    <v-col cols="6">
      <v-card>
        <v-card-title>{{ $t('forms.template.meta') }}</v-card-title>
        <v-card-text>
          <v-text-field
            id="name"
            v-model="localModel.name"
            :label="$t('global.name')"
            name="name"
            required
            :disabled="disabled"
            :error-messages="requiredErrors(`name`)"
            @input="$v.template.name.$touch()"
            @blur="$v.template.name.$touch()"
          />
          <v-textarea
            id="description"
            v-model="localModel.description"
            :label="$t('global.description')"
            name="description"
            auto-grow
            rows="1"
            :disabled="disabled"
          />
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6">
      <v-card>
        <v-card-title>{{ $t('forms.template.files') }}</v-card-title>
        <v-card-text>
          <v-file-input
            id="markup"
            :label="$t('forms.template.markup')"
            name="markup"
            accept=".html"
            prepend-icon="web"
            :disabled="disabled"
            @change="updateMarkup"
          />
          <!-- Don't put counter -->
          <!-- on SSR it leads to a “File is undefined” error -->
          <v-file-input
            id="template-images"
            :label="$tc('global.image', 2)"
            name="template-images"
            :accept="$options.SUPPORTED_IMAGES_FORMAT"
            multiple
            small-chips
            show-size
            prepend-icon="insert_photo"
            :disabled="disabled"
            @change="updateImages"
          />
        </v-card-text>
      </v-card>
    </v-col>
    <v-btn
      color="accent"
      fixed
      bottom
      right
      fab
      :disabled="disabled"
      @click="onSubmit"
    >
      <v-icon>save</v-icon>
    </v-btn>
  </form>
</template>

<style lang="scss" scoped>
.template-edit-form {
  display: contents;
}
.v-card {
  height: 100%;
}
</style>
