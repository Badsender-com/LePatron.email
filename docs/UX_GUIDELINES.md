# UX Guidelines

Behavioral patterns and UX best practices for LePatron.email.

> **Visual tokens**: See [design-system/01-tokens.md](./design-system/01-tokens.md) for colors, typography, spacing.
> **Components**: See [design-system/02-components.md](./design-system/02-components.md) for component usage.

---

## Principles

### Component Reuse

Always search for existing components before creating new ones:

```
/packages/ui/components/           # Global components
/packages/ui/components/group/     # Group-specific
/packages/ui/components/mailings/  # Mailing-specific
```

### Vuetify First

```vue
<!-- ✅ GOOD -->
<v-btn color="accent" @click="save">Save</v-btn>

<!-- ❌ BAD -->
<button class="custom-btn" @click="save">Save</button>
```

---

## Code Patterns

### Forms (Vuelidate)

```javascript
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';

export default {
  mixins: [validationMixin],
  validations: {
    user: {
      email: { required, email },
      name: { required },
    },
  },
  computed: {
    emailErrors() {
      const errors = [];
      if (!this.$v.user.email.$dirty) return errors;
      !this.$v.user.email.required && errors.push(this.$t('forms.errors.required'));
      !this.$v.user.email.email && errors.push(this.$t('forms.errors.email'));
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

### Store (Vuex)

```javascript
// store/resource.js
export const RESOURCE = 'resource';
export const FETCH_ITEMS = 'fetchItems';

export const state = () => ({ items: [], loading: false });

export const mutations = {
  setItems(state, items) { state.items = items; },
};

export const actions = {
  async [FETCH_ITEMS]({ commit }) {
    const { data } = await this.$axios.get('/api/resources');
    commit('setItems', data);
  },
};
```

### Notifications

```javascript
this.$store.commit('page/SHOW_SNACKBAR', {
  text: this.$t('success.saved'),
  color: 'success',  // success, error, warning, info
  timeout: 3000,
});
```

### i18n

```javascript
this.$t('global.save')              // Simple key
this.$t('users.welcome', { name })  // With parameter
this.$tc('global.item', count)      // Pluralization
```

Key organization:
- `global.*`: Shared (save, cancel, delete)
- `forms.*`: Labels and errors
- `users.*`, `mailings.*`, `groups.*`: Per domain

---

## UI Patterns

### Icon + Text

```vue
<!-- ❌ BAD - Icon only, unclear meaning -->
<v-btn icon><v-icon>mdi-plus</v-icon></v-btn>

<!-- ✅ GOOD - Icon + text -->
<v-btn><v-icon left>mdi-comment-plus</v-icon>Add Comment</v-btn>

<!-- ✅ OK - Icon only with tooltip -->
<v-tooltip bottom>
  <template v-slot:activator="{ on }">
    <v-btn icon v-on="on"><v-icon>mdi-plus</v-icon></v-btn>
  </template>
  <span>Add Comment</span>
</v-tooltip>
```

### Side Panels

- If button is top-right → panel should be right
- If button is left (toolbar) → panel should be left
- Use `temporary` to avoid blocking content

```vue
<v-navigation-drawer v-model="drawer" temporary right>
  <!-- Content -->
</v-navigation-drawer>
```

### Badges and Indicators

```vue
<v-badge :content="count" :value="count > 0" color="error" overlap>
  <v-icon>mdi-bell</v-icon>
</v-badge>
```

### Toggles and Filters

```vue
<!-- Visible state -->
<v-btn :color="active ? 'primary' : 'default'">
  <v-icon left>{{ active ? 'mdi-filter' : 'mdi-filter-outline' }}</v-icon>
  {{ active ? 'Show All' : 'Filter' }}
</v-btn>

<!-- Or explicit switch -->
<v-switch v-model="filterActive" label="Show only active" />
```

---

## Accessibility

### ARIA

```vue
<v-btn icon aria-label="Add comment">
  <v-icon>mdi-plus</v-icon>
</v-btn>

<div aria-live="polite">{{ notification }}</div>
```

### Contrast

- Minimum ratio 4.5:1 (WCAG AA)
- Don't rely solely on color to convey information
- Use icon + text for important actions

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Visible focus in modals/drawers
- Logical tab order

---

## Responsive Design

```vue
<v-row>
  <v-col cols="12" md="6">Content</v-col>
</v-row>

<template v-if="$vuetify.breakpoint.mdAndUp">
  <!-- Desktop -->
</template>
<template v-else>
  <!-- Mobile -->
</template>
```

---

## UX Checklist

- [ ] Uses existing Vuetify components
- [ ] Clear icons (with tooltips if needed)
- [ ] Panels don't hide critical content
- [ ] Filter/toggle states are visible
- [ ] Accessible (ARIA, keyboard, contrast)
- [ ] Responsive (mobile, tablet, desktop)

---

## Related Documentation

- [Design System](./design-system/README.md) - Index
- [Tokens](./design-system/01-tokens.md) - Colors, typography, spacing
- [Components](./design-system/02-components.md) - Component usage
- [AGENTS.md](../AGENTS.md) - Technical conventions

---

*Last updated: February 2026*
