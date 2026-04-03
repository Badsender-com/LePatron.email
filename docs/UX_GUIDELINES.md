# UX Guidelines - Behavioral Patterns & Best Practices

This document defines **UX patterns and behavioral guidelines** for LePatron.email development.

> **Related Documentation**
> - [Design System Documentation](./design-system/00-overview.md) - Tokens, components, visual specifications
> - [Design System Tokens](./design-system/01-tokens.md) - Colors, typography, spacing
> - [Design System Components](./design-system/02-atoms.md) - Vuetify component usage
> - [AGENTS.md](../AGENTS.md) - Technical conventions

## Design System Principles

### Component Reuse First

- **ALWAYS search for existing components before creating new ones**
- Check these locations:
  ```
  /packages/ui/components/           # Global components
  /packages/ui/components/group/     # Group-specific components
  /packages/ui/components/mailings/  # Mailing-specific components
  /packages/ui/components/users/     # User-specific components
  ```
- If similar functionality exists, extend the existing component
- Only create new components when truly unique functionality is needed

### Vuetify Components

LePatron.email uses **Vuetify 2** for UI components. Always prefer Vuetify components:

```vue
<!-- ✅ GOOD - Using Vuetify -->
<v-btn color="primary" @click="addComment">
  Add Comment
</v-btn>

<!-- ❌ BAD - Custom button when Vuetify exists -->
<button class="custom-btn" @click="addComment">
  Add Comment
</button>
```

### Common Vuetify Components

- `v-btn` - Buttons
- `v-card` - Cards
- `v-dialog` - Modals/dialogs
- `v-text-field` - Input fields
- `v-select` - Dropdowns
- `v-chip` - Tags/chips
- `v-badge` - Badges
- `v-menu` - Dropdown menus
- `v-list` - Lists
- `v-icon` - Icons (Material Design Icons)
- `v-snackbar` - Toast notifications
- `v-tooltip` - Tooltips

## Icon Usage

### Material Design Icons

Use Material Design Icons (MDI) via Vuetify:

```vue
<!-- Comment icon -->
<v-icon>mdi-comment</v-icon>
<v-icon>mdi-comment-outline</v-icon>
<v-icon>mdi-comment-plus</v-icon>

<!-- Notification icon -->
<v-icon>mdi-bell</v-icon>
<v-icon>mdi-bell-outline</v-icon>

<!-- User mention -->
<v-icon>mdi-at</v-icon>
```

### Icon + Text Pattern

**IMPORTANT**: When functionality might be unclear:

```vue
<!-- ❌ BAD - Icon only, unclear meaning -->
<v-btn icon>
  <v-icon>mdi-plus</v-icon>
</v-btn>

<!-- ✅ GOOD - Icon + Text for clarity -->
<v-btn>
  <v-icon left>mdi-comment-plus</v-icon>
  Add Comment
</v-btn>

<!-- ✅ ACCEPTABLE - Icon only with tooltip -->
<v-btn icon>
  <v-tooltip bottom>
    <template v-slot:activator="{ on }">
      <v-icon v-on="on">mdi-comment-plus</v-icon>
    </template>
    <span>Add Comment</span>
  </v-tooltip>
</v-btn>
```

### Review Finding: Button Clarity

From PR review: "Add a comment button looks like a add a badge"

- **Solution**: Use explicit text labels or standard comment icons
- Avoid generic "+" icons for specific actions

## Layout Patterns

### Side Panel Pattern

When adding side panels (like comments panel):

#### Position Consistency

```vue
<!-- If button is top-right, panel should be right -->
<div class="top-bar">
  <v-btn class="top-right" @click="openPanel">Comments</v-btn>
</div>
<v-navigation-drawer right> <!-- panel on right -->
  <!-- Panel content -->
</v-navigation-drawer>

<!-- If button is left (with other tools), panel should be left -->
<div class="toolbar-left">
  <v-btn @click="openPanel">Comments</v-btn>
</div>
<v-navigation-drawer left> <!-- panel on left -->
  <!-- Panel content -->
</v-navigation-drawer>
```

#### Panel Z-Index

- Panels must NOT hide critical UI elements
- Review finding: "The panel top should not mask the other tab options"
- Solution: Use appropriate z-index and positioning:

  ```css
  .side-panel {
    z-index: 10; /* Below top navigation */
  }

  .top-navigation {
    z-index: 20; /* Always on top */
  }
  ```

### Overlay Pattern

When panels affect content visibility:

```vue
<!-- ❌ BAD - Panel hides content, must close to see -->
<v-navigation-drawer permanent> <!-- always open, blocks view -->
  <comment-list />
</v-navigation-drawer>

<!-- ✅ GOOD - Panel is toggleable, doesn't block workflow -->
<v-navigation-drawer v-model="drawer" temporary> <!-- can be closed -->
  <comment-list />
</v-navigation-drawer>
```

Review finding: "The comment panel on the left hide the blocks -> needs to close and reopen to check comments and improve mail"

- **Solution**: Use `temporary` drawers or `overlay` mode for better UX

## Badge and Indicator Patterns

### Notification Badges

```vue
<!-- Standard pattern for unread counts -->
<v-badge :content="unreadCount" :value="unreadCount > 0" color="error" overlap>
  <v-icon>mdi-bell</v-icon>
</v-badge>
```

### Badge Positioning

Review finding: "The red number icon in the top bar is overlapping with the rest"

- **Solution**: Use Vuetify's `overlap` prop correctly
- Ensure adequate spacing around badges
- Test with different counts (1, 10, 99+)

```vue
<!-- ✅ GOOD - Proper badge positioning -->
<v-badge
  :content="count"
  :value="count > 0"
  color="error"
  overlap
  offset-x="10"
  offset-y="10"
>
  <v-btn icon>
    <v-icon>mdi-bell</v-icon>
  </v-btn>
</v-badge>
```

### Per-Item Indicators

Review suggestion: "Add a number icon of unresolved comments by block?"

- Use small badges on list items:

```vue
<v-list-item v-for="block in blocks" :key="block.id">
  <v-list-item-content>
    {{ block.name }}
  </v-list-item-content>
  <v-list-item-action>
    <v-chip small v-if="block.unresolvedComments > 0">
      {{ block.unresolvedComments }}
    </v-chip>
  </v-list-item-action>
</v-list-item>
```

## Filter and Toggle Patterns

### Clear Toggle State

Review finding: "The filtered options is not clear: how to activate/deactivate it to see only block comment or all: should be a toggle?"

```vue
<!-- ❌ UNCLEAR - No visible state -->
<v-btn @click="toggleFilter">Filter</v-btn>

<!-- ✅ CLEAR - Toggle with visible state -->
<v-btn :color="showFiltered ? 'primary' : 'default'" @click="toggleFilter">
  <v-icon left>{{ showFiltered ? 'mdi-filter' : 'mdi-filter-outline' }}</v-icon>
  {{ showFiltered ? 'Show All' : 'Filter' }}
</v-btn>

<!-- ✅ EVEN BETTER - Explicit toggle switch -->
<v-switch v-model="showOnlyBlockComments" label="Show only block comments">
</v-switch>
```

## Data Table Patterns

### BsDataTable Component (Recommended)

Use the `BsDataTable` component for consistent table styling across the application:

```vue
<script>
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { Users, Pencil, Trash2 } from 'lucide-vue';

export default {
  components: {
    BsDataTable,
    LucideUsers: Users,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
  },
  // ...
};
</script>

<template>
  <bs-data-table
    :headers="tableHeaders"
    :items="items"
    :loading="loading"
    :empty-icon="$options.components.LucideUsers"
    :empty-message="$t('workspaces.empty')"
    clickable
    @click:row="handleRowClick"
  >
    <template #item.name="{ item }">
      <span class="font-weight-medium">{{ item.name }}</span>
    </template>

    <template #item.actions="{ item }">
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn icon small v-bind="attrs" v-on="on" @click.stop="editItem(item)">
            <lucide-pencil :size="18" />
          </v-btn>
        </template>
        <span>{{ $t('global.edit') }}</span>
      </v-tooltip>
    </template>
  </bs-data-table>
</template>
```

### Table Configuration

See `/helpers/constants/table-config.js` for centralized configuration:

- **Pagination options**: 25, 50, 100, All
- **Default items per page**: 25
- **Footer hidden threshold**: 25 items

```js
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
```

### Table Design Guidelines

| Feature | Guideline |
|---------|-----------|
| **Row click** | Use `clickable` prop for navigation to detail page |
| **Actions column** | Use icon buttons with tooltips, right-aligned |
| **Name column** | Use `font-weight-medium` for emphasis |
| **Empty state** | Include relevant icon and descriptive message |
| **Status indicators** | Use `v-chip` with appropriate colors |
| **Boolean values** | Use Lucide check icon (`lucide-check`) |
| **Dates** | Use `preciseDateTime` filter |
| **Counts** | Use `v-chip small outlined` with icon |

### Action Buttons Pattern

```vue
<template #item.actions="{ item }">
  <!-- Edit button -->
  <v-tooltip bottom>
    <template #activator="{ on, attrs }">
      <v-btn icon small v-bind="attrs" v-on="on" @click.stop="editItem(item)">
        <lucide-pencil :size="18" />
      </v-btn>
    </template>
    <span>{{ $t('global.edit') }}</span>
  </v-tooltip>

  <!-- Delete button (danger style) -->
  <v-tooltip bottom>
    <template #activator="{ on, attrs }">
      <v-btn
        icon
        small
        class="error--text"
        v-bind="attrs"
        v-on="on"
        @click.stop="deleteItem(item)"
      >
        <lucide-trash2 :size="18" />
      </v-btn>
    </template>
    <span>{{ $t('global.delete') }}</span>
  </v-tooltip>
</template>
```

### Count Display Pattern

```vue
<template #item.users="{ item }">
  <v-chip small outlined>
    <lucide-users :size="14" class="mr-1" />
    {{ item.users || 0 }}
  </v-chip>
</template>
```

### Status Chip Pattern

```vue
<template #item.status="{ item }">
  <v-chip
    small
    :color="getStatusColor(item.status)"
    :outlined="item.status !== 'active'"
    :dark="item.status === 'active'"
  >
    {{ item.status }}
  </v-chip>
</template>
```

## Modal Patterns

### BsModalForm Component (Recommended for Forms)

Use the `BsModalForm` component for modal dialogs containing forms:

```vue
<script>
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';

export default {
  components: { BsModalForm, BsTextField, BsSelect },
  data() {
    return { formData: { name: '', status: '' }, loading: false };
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    onSubmit() {
      // Validate and submit
      this.$emit('submit', this.formData);
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="$t('modal.title')"
    :submit-label="$t('global.create')"
    :loading="loading"
    @submit="onSubmit"
  >
    <bs-text-field v-model="formData.name" label="Name" required />
    <bs-select v-model="formData.status" :items="options" label="Status" />
  </bs-modal-form>
</template>
```

### BsModalForm Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | String | required | Modal header title |
| `width` | String/Number | 500 | Modal width in pixels |
| `submit-label` | String | "Save" | Submit button text |
| `cancel-label` | String | "Cancel" | Cancel button text |
| `submit-color` | String | "accent" | Submit button color |
| `loading` | Boolean | false | Shows loader on submit button |
| `submit-disabled` | Boolean | false | Disables submit button |
| `show-submit` | Boolean | true | Whether to show submit button |
| `persistent` | Boolean | false | Prevents closing on outside click |

### Modal Components Summary

| Component | Use Case |
|-----------|----------|
| `BsModalForm` | Forms in modals (create, edit) |
| `BsModalConfirm` | Simple confirmation dialogs |
| `BsModalConfirmForm` | Confirmation with input validation |

## Form and Input Patterns

### Text Mentions

When displaying user mentions:

```vue
<!-- Review finding: "Not sure if the interface should display the user id when mentioning them" -->

<!-- ❌ BAD - Shows user ID -->
<span class="mention">@user_123456</span>

<!-- ✅ GOOD - Shows user name -->
<span class="mention">@{{ user.name }}</span>

<!-- ✅ BEST - Shows name with hover tooltip for details -->
<v-tooltip bottom>
  <template v-slot:activator="{ on }">
    <span class="mention" v-on="on">@{{ user.name }}</span>
  </template>
  <span>{{ user.email }}</span>
</v-tooltip>
```

## Notification Patterns

### Notification State Management

Review finding: "Notification should be cleared and stored some where else to see historic -> i mark one as read and it is still in the pop up"

```vue
<!-- Separate read vs unread notifications -->
<v-menu offset-y>
  <template v-slot:activator="{ on }">
    <v-badge :content="unreadCount" :value="unreadCount > 0">
      <v-btn icon v-on="on">
        <v-icon>mdi-bell</v-icon>
      </v-btn>
    </v-badge>
  </template>

  <v-card max-width="400">
    <!-- Tabs for unread/all -->
    <v-tabs v-model="tab">
      <v-tab>Unread ({{ unreadCount }})</v-tab>
      <v-tab>All</v-tab>
    </v-tabs>

    <v-tabs-items v-model="tab">
      <v-tab-item>
        <!-- Only unread notifications -->
        <notification-list :notifications="unreadNotifications" />
      </v-tab-item>
      <v-tab-item>
        <!-- All notifications with history -->
        <notification-list :notifications="allNotifications" />
      </v-tab-item>
    </v-tabs-items>
  </v-card>
</v-menu>
```

## Color Palette

> **See [Design System Tokens](./design-system/01-tokens.md)** for complete color specifications.

LePatron.email uses custom Vuetify theme colors:

| Color | Value | Usage |
|-------|-------|-------|
| `primary` | `#093040` | Headers, navigation, text emphasis |
| `secondary` | `#265090` | Secondary actions |
| `accent` | `#00ACDC` | **Primary actions**, links, highlights |
| `error` | `#F04E23` | Destructive actions, errors, unread counts |
| `warning` | `#FFB400` | Warnings, caution states |
| `success` | `#4CAF50` | Confirmations, resolved states |

### Color Usage Guidelines

- **Primary actions** use `accent` (not `primary`) - e.g., "Save", "Create", "Submit"
- **Cancel/secondary** actions use `text` style with `primary` color
- **Destructive actions** use `error` - e.g., "Delete", "Remove"
- **Navigation and headers** use `primary`

## Typography

> **See [Design System Tokens](./design-system/01-tokens.md)** for font specifications.
> **Target font**: Work Sans (migration from Montserrat in progress)

Use Vuetify typography classes:

```vue
<div class="text-h4">Main Title</div>
<div class="text-h6">Section Title</div>
<div class="text-subtitle-1">Subtitle</div>
<div class="text-body-1">Body text</div>
<div class="text-caption">Small text</div>
```

## Spacing

> **See [Design System Tokens](./design-system/01-tokens.md)** for spacing scale.

Use Vuetify spacing utilities (0-12 scale, 4px base):

```vue
<!-- Margin -->
<div class="ma-4">All margins</div>
<div class="mt-2 mb-2">Top and bottom margin</div>
<div class="mx-4">Horizontal margins</div>

<!-- Padding -->
<div class="pa-4">All padding</div>
<div class="pt-2 pb-2">Top and bottom padding</div>
<div class="px-4">Horizontal padding</div>
```

## Responsive Design

Always test UI on different screen sizes:

```vue
<!-- Use Vuetify breakpoint helpers -->
<v-container>
  <v-row>
    <!-- Full width on mobile, half on tablet+ -->
    <v-col cols="12" md="6">
      Content
    </v-col>
  </v-row>
</v-container>

<!-- Conditional rendering based on screen size -->
<template v-if="$vuetify.breakpoint.mdAndUp">
  <!-- Desktop view -->
</template>
<template v-else>
  <!-- Mobile view -->
</template>
```

## Animation and Transitions

Use Vuetify's built-in transitions:

```vue
<!-- Fade -->
<v-fade-transition>
  <div v-if="show">Content</div>
</v-fade-transition>

<!-- Slide -->
<v-slide-x-transition>
  <div v-if="show">Content</div>
</v-slide-x-transition>

<!-- Scale -->
<v-scale-transition>
  <div v-if="show">Content</div>
</v-scale-transition>
```

## Accessibility

### ARIA Labels

```vue
<!-- Always add aria-label for icon-only buttons -->
<v-btn icon aria-label="Add comment">
  <v-icon>mdi-plus</v-icon>
</v-btn>

<!-- Use aria-live for dynamic content -->
<div aria-live="polite" aria-atomic="true">
  {{ notificationMessage }}
</div>
```

### Keyboard Navigation

- Ensure all interactive elements are keyboard accessible
- Use proper focus management in modals/drawers
- Test tab order

### Color Contrast

- Ensure text meets WCAG AA standards (4.5:1 ratio)
- Don't rely solely on color to convey information
- Use icons + text for important actions

## Component Checklist

When creating/modifying UI components:

- [ ] Uses existing Vuetify components
- [ ] Follows existing component patterns in `/components`
- [ ] Icons are semantic and clear (with tooltips if needed)
- [ ] Responsive across breakpoints
- [ ] Proper z-index and doesn't hide critical UI
- [ ] Badges and indicators are clearly positioned
- [ ] Filter/toggle states are visually obvious
- [ ] Color usage follows theme
- [ ] Proper spacing with Vuetify utilities
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Tested on mobile, tablet, desktop

## UX Review Agent Instructions

When the UX review agent analyzes code:

1. Check for component reuse opportunities
2. Verify Vuetify components are used over custom HTML
3. Validate icon + text patterns for clarity
4. Check layout consistency (panel positions, z-index)
5. Verify badge/indicator positioning
6. Ensure filter/toggle states are clear
7. Validate color usage against theme
8. Check responsive behavior
9. Verify accessibility basics

## Related Documentation

### Internal Documentation
- [Design System Overview](./design-system/00-overview.md) - Architecture and principles
- [Design System Tokens](./design-system/01-tokens.md) - Colors, typography, spacing
- [Design System Components](./design-system/02-atoms.md) - Vuetify component specifications
- [Design System Patterns](./design-system/06-patterns.md) - Recurring UI patterns
- [AGENTS.md](../AGENTS.md) - Technical conventions
- [AI_POLICIES.md](./AI_POLICIES.md) - Quality standards

### External References
- [Vuetify 2 Documentation](https://v2.vuetifyjs.com/)
- [Material Design Icons](https://materialdesignicons.com/)
