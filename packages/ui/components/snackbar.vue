<script>
import { mapState, mapMutations } from 'vuex';

import { PAGE, CLOSE_SNACKBAR } from '~/store/page.js';

export default {
  name: 'BsSnackbar',
  computed: {
    ...mapState(PAGE, {
      snackbar: (state) => state.snackbar,
    }),
  },
  methods: {
    ...mapMutations(PAGE, {
      closeSnackbar: CLOSE_SNACKBAR,
    }),
  },
};
</script>

<template>
  <v-snackbar
    bottom
    :value="snackbar.visible"
    :color="snackbar.color"
    :timeout="snackbar.timeout"
    :multi-line="snackbar.multiline === true"
    @input="closeSnackbar"
  >
    {{ snackbar.text }}
    <v-btn text dark @click="closeSnackbar">
      {{ $t('global.close') }}
    </v-btn>
  </v-snackbar>
</template>
