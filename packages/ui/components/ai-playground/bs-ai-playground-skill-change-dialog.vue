<script>
/**
 * Confirmation shown when changing skill would drop non-empty input fields.
 * Deliberately NO ambiguous "Cancel": the skill change is acted in both cases
 * (no picker revert) — the user only chooses what happens to their input:
 * keep everything by switching to JSON mode, or proceed and drop the listed
 * fields. Closing the dialog defaults to the safe choice (keep as JSON).
 */
export default {
  name: 'BsAiPlaygroundSkillChangeDialog',
  props: {
    // Names of the non-empty fields the new skill does not use; null = closed.
    droppedFields: { type: Array, default: null },
  },
};
</script>

<template>
  <v-dialog
    :value="!!droppedFields"
    max-width="480"
    persistent
    @input="!$event && $emit('keep-json')"
  >
    <v-card>
      <v-card-title>
        {{ $t('aiPlayground.input.skillChangeConfirmTitle') }}
      </v-card-title>
      <v-card-text>
        {{
          $t('aiPlayground.input.skillChangeConfirmBody', {
            fields: (droppedFields || []).join(', '),
          })
        }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="$emit('keep-json')">
          {{ $t('aiPlayground.input.skillChangeKeepJson') }}
        </v-btn>
        <v-btn color="error" text @click="$emit('proceed')">
          {{ $t('aiPlayground.input.skillChangeProceed') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
