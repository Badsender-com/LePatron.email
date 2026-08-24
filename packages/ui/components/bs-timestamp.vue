<script>
// Compact timestamp cell: date only, full date+time on hover (cf. UX review §0).
import { dateShort, dateTime } from '~/helpers/format-date.js';

export default {
  name: 'BsTimestamp',
  props: {
    value: { type: [String, Number, Date], default: null },
  },
  computed: {
    short() {
      return dateShort(this.value);
    },
    full() {
      return dateTime(this.value);
    },
  },
};
</script>

<template>
  <v-tooltip v-if="value" bottom>
    <template #activator="{ on, attrs }">
      <span class="text-caption text--secondary" v-bind="attrs" v-on="on">{{
        short
      }}</span>
    </template>
    <span>{{ full }}</span>
  </v-tooltip>
  <span v-else class="text--disabled">—</span>
</template>
