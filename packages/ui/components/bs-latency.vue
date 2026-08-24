<script>
// Compact latency cell: seconds with one decimal ("12,4 s"), raw ms on hover.
import { latencySeconds, latencyMillis } from '~/helpers/format-latency.js';

export default {
  name: 'BsLatency',
  props: {
    value: { type: [String, Number], default: null },
  },
  computed: {
    seconds() {
      return latencySeconds(this.value);
    },
    millis() {
      return latencyMillis(this.value);
    },
  },
};
</script>

<template>
  <v-tooltip v-if="seconds" bottom>
    <template #activator="{ on, attrs }">
      <span class="text-caption text--secondary" v-bind="attrs" v-on="on">{{
        seconds
      }}</span>
    </template>
    <span>{{ millis }}</span>
  </v-tooltip>
  <span v-else class="text--disabled">—</span>
</template>
