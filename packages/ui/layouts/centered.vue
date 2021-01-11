<script>
import BsSnackBar from '~/components/snackbar.vue'

export default {
  name: `bs-layout-authentication`,
  components: { BsSnackBar },
}
</script>

<template>
  <v-app id="inspire">
    <v-content>
      <v-container class="fill-height secondary" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="4">
            <nuxt />
          </v-col>
        </v-row>
      </v-container>
    </v-content>
    <bs-snack-bar />
  </v-app>
</template>
