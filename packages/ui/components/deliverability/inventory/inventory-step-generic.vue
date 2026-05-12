<template>
  <v-card>
    <v-card-text>
      <div class="text-h6 mb-2">
        {{ title }}
      </div>
      <div class="text-body-2 grey--text mb-4">
        {{ description }}
      </div>

      <v-text-field
        v-model="newItem"
        :placeholder="placeholder"
        outlined
        append-icon="mdi-plus"
        @click:append="addItem"
        @keyup.enter="addItem"
      />

      <v-list v-if="localItems.length > 0">
        <v-list-item v-for="(item, index) in localItems" :key="index">
          <v-list-item-content>
            <v-list-item-title>{{ item.value }}</v-list-item-title>
            <v-list-item-subtitle v-if="item.description">
              {{ item.description }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-btn icon small @click="removeItem(index)">
              <v-icon small>
                mdi-delete
              </v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>

      <div v-else class="text-center grey--text pa-4">
        No items added yet
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn text @click="$emit('prev')">
        Previous
      </v-btn>
      <v-spacer />
      <v-btn color="primary" :loading="saving" @click="handleSave">
        Save & Continue
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { mapActions } from 'vuex';
import { DELIVERABILITY, BULK_UPSERT_INVENTORY } from '~/store/deliverability';

export default {
  name: 'InventoryStepGeneric',
  props: {
    auditId: {
      type: String,
      required: true,
    },
    items: {
      type: Array,
      default: () => [],
    },
    category: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: 'Enter a value',
    },
  },
  data() {
    return {
      localItems: [],
      newItem: '',
      saving: false,
    };
  },
  watch: {
    items: {
      immediate: true,
      handler(newItems) {
        this.localItems = [...newItems];
      },
    },
  },
  methods: {
    ...mapActions(DELIVERABILITY, {
      bulkUpsert: BULK_UPSERT_INVENTORY,
    }),
    addItem() {
      if (!this.newItem.trim()) return;

      this.localItems.push({
        value: this.newItem.trim(),
        description: null,
      });
      this.newItem = '';
    },
    removeItem(index) {
      this.localItems.splice(index, 1);
    },
    async handleSave() {
      this.saving = true;
      try {
        await this.bulkUpsert({
          auditId: this.auditId,
          category: this.category,
          items: this.localItems,
        });
        this.$emit('save', this.localItems);
        this.$emit('next');
      } catch (error) {
        console.error('Error saving inventory:', error);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
