<script>
import { validationMixin } from 'vuelidate';

export default {
  name: 'ProfileForm',
  mixins: [validationMixin],
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
};
</script>

<template>
  <v-card tag="form">
    Profile form
  </v-card>
</template>
