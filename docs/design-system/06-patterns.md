# UI Patterns

Recurring patterns and conventions used throughout LePatron.email.

> **See also**: [UX_GUIDELINES.md](../UX_GUIDELINES.md) for behavioral patterns, accessibility guidelines, and UX review checklist.

## Form Pattern

### Structure

```html
<v-card flat tile tag="form">
  <v-card-title v-if="title">{{ title }}</v-card-title>
  <v-card-text>
    <v-row>
      <v-col cols="6">
        <v-text-field ... />
      </v-col>
      <v-col cols="6">
        <v-text-field ... />
      </v-col>
    </v-row>
  </v-card-text>
  <v-divider />
  <v-card-actions>
    <v-spacer />
    <v-btn color="accent" elevation="0" :disabled="disabled" @click="onSubmit">
      {{ $t('global.save') }}
    </v-btn>
  </v-card-actions>
</v-card>
```

### Validation (Vuelidate)

```javascript
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';

export default {
  mixins: [validationMixin],
  validations() {
    return {
      user: {
        email: { required, email },
        name: { required },
      },
    };
  },
  computed: {
    emailErrors() {
      const errors = [];
      if (!this.$v.user.email.$dirty) return errors;
      !this.$v.user.email.required &&
        errors.push(this.$t('forms.user.errors.email.required'));
      !this.$v.user.email.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', this.formData);
    },
  },
};
```

### v-model Pattern

Use custom v-model for two-way binding with parent:

```javascript
export default {
  model: { prop: 'user', event: 'update' },
  props: {
    user: { type: Object, default: () => ({}) },
  },
  computed: {
    localModel: {
      get() { return this.user; },
      set(updated) { this.$emit('update', updated); },
    },
  },
};
```

---

## Table Pattern

### Headers Definition

```javascript
computed: {
  tableHeaders() {
    return [
      { text: this.$t('column.name'), align: 'left', value: 'name' },
      { text: this.$t('column.email'), value: 'email' },
      { text: this.$t('column.status'), value: 'status', class: 'table-column-action' },
      { text: this.$t('global.actions'), value: 'actions', sortable: false, align: 'center' },
    ].filter((col) => !this.hiddenCols.includes(col.value));
  },
},
```

### Custom Cell Templates

```html
<v-data-table :headers="headers" :items="items" :loading="loading">
  <!-- Link cell -->
  <template #item.name="{ item }">
    <nuxt-link :to="`/resource/${item.id}`">{{ item.name }}</nuxt-link>
  </template>

  <!-- Badge cell -->
  <template #item.role="{ item }">
    <v-badge v-if="item.isAdmin" inline color="accent" content="Admin" />
  </template>

  <!-- Icon cell -->
  <template #item.status="{ item }">
    <v-icon color="accent">{{ getStatusIcon(item) }}</v-icon>
  </template>

  <!-- Date cell with filter -->
  <template #item.createdAt="{ item }">
    {{ item.createdAt | preciseDateTime }}
  </template>

  <!-- Actions cell -->
  <template #item.actions="{ item }">
    <bs-actions-dropdown :item="item" />
  </template>
</v-data-table>
```

---

## Modal Pattern

### Using refs

```html
<template>
  <div>
    <v-btn @click="$refs.confirmModal.open()">Delete</v-btn>

    <bs-modal-confirm
      ref="confirmModal"
      :title="$t('confirm.delete.title')"
      :action-label="$t('global.delete')"
      action-button-color="error"
      @confirm="onDeleteConfirm"
    >
      <p>{{ $t('confirm.delete.message') }}</p>
    </bs-modal-confirm>
  </div>
</template>

<script>
export default {
  methods: {
    onDeleteConfirm() {
      // Perform delete action
    },
  },
};
</script>
```

---

## State Management Pattern

### Store Module Structure

```javascript
// store/resource.js
export const RESOURCE = 'resource';
export const FETCH_ITEMS = 'fetchItems';
export const SET_ITEMS = 'setItems';

export const state = () => ({
  items: [],
  loading: false,
});

export const mutations = {
  [SET_ITEMS](state, items) {
    state.items = items;
  },
};

export const actions = {
  async [FETCH_ITEMS]({ commit }) {
    const { data } = await this.$axios.get('/api/resources');
    commit(SET_ITEMS, data);
  },
};
```

### Using in Component

```javascript
import { mapState, mapActions } from 'vuex';
import { RESOURCE, FETCH_ITEMS } from '~/store/resource.js';

export default {
  computed: {
    ...mapState(RESOURCE, ['items', 'loading']),
  },
  methods: {
    ...mapActions(RESOURCE, { fetchItems: FETCH_ITEMS }),
  },
  async mounted() {
    await this.fetchItems();
  },
};
```

---

## Notification Pattern

### Snackbar via Store

```javascript
// In component
this.$store.commit('page/SHOW_SNACKBAR', {
  text: this.$t('success.saved'),
  color: 'success',
  timeout: 3000,
});

// Error notification
this.$store.commit('page/SHOW_SNACKBAR', {
  text: this.$t('error.generic'),
  color: 'error',
  timeout: 5000,
});
```

---

## Navigation Pattern

### Links

```html
<!-- Internal navigation -->
<nuxt-link :to="`/users/${user.id}`">{{ user.name }}</nuxt-link>

<!-- External link -->
<v-btn href="https://external.com" target="_blank">
  External Link
</v-btn>

<!-- Conditional admin link -->
<nuxt-link v-if="isAdmin" :to="`/admin/settings`">
  {{ $t('nav.settings') }}
</nuxt-link>
```

---

## i18n Pattern

### Translation Keys

```javascript
// Simple key
this.$t('global.save')

// With parameter
this.$t('users.welcome', { name: user.name })

// Pluralization
this.$tc('global.item', count)

// In template
{{ $t('page.title') }}
```

### Key Organization

```
global.*          // Shared across app (save, cancel, delete, etc.)
forms.*           // Form labels and errors
users.*           // User-related text
mailings.*        // Mailing-related text
groups.*          // Group-related text
layout.*          // Layout elements (logout, help, etc.)
```

---

## Loading Pattern

### Table Loading

```html
<v-data-table :loading="loading" :items="items">
  ...
</v-data-table>
```

### Button Loading

```html
<v-btn :loading="saving" :disabled="saving" @click="save">
  {{ $t('global.save') }}
</v-btn>
```

### Full Page Loading

```html
<v-progress-linear v-if="loading" indeterminate color="accent" />
```

---

## Error Handling Pattern

### Form Errors

```javascript
try {
  await this.$axios.post('/api/resource', data);
  this.$store.commit('page/SHOW_SNACKBAR', {
    text: this.$t('success.created'),
    color: 'success',
  });
} catch (error) {
  this.$store.commit('page/SHOW_SNACKBAR', {
    text: error.response?.data?.message || this.$t('error.generic'),
    color: 'error',
  });
}
```

---

## Conditional Rendering Pattern

### Role-Based

```html
<v-btn v-if="isAdmin">Admin Action</v-btn>
<v-btn v-if="isGroupAdmin">Group Admin Action</v-btn>
```

### Feature Flags

```html
<div v-if="$store.state.group.features.translation">
  <!-- Translation feature UI -->
</div>
```
