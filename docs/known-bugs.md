# Known Bugs

This document tracks known bugs encountered in the application that may affect multiple branches.

---

## BUG-001: TypeError on homepage - `_this$templates.filter is not a function`

### Status
**Fixed** - First reported: 2024-12 - Fixed: 2024-12

### Affected branches
- `develop`
- `multi-assets-export`
- Potentially any branch based on `develop`

### Error message

**Server logs:**
```
› Rendering url /
Error while fetching group
error while fetching workspaces
[Vue warn]: Error in render: "TypeError: _this$templates.filter is not a function"

found in

---> <MailingsModalNew> at packages/ui/routes/mailings/__partials/mailings-new-modal.vue
       <BsLayoutLeftMenu> at packages/ui/components/layout-left-menu.vue
         <PageMailings> at packages/ui/routes/index.vue
           <Nuxt>
             <VMain>
               <VApp>
                 <BsLayoutDefault> at packages/ui/layouts/default.vue
                   <Root>
<== GET / 500 721.974ms
```

**Browser error:**
```
TypeError
_this$templates.filter is not a function
mailings-new-modal.vue:32
```

### Root cause analysis

The error occurs in `packages/ui/routes/mailings/__partials/mailings-new-modal.vue` at line 32, in a computed property `templatesHasMarkup` that attempts to call `.filter()` on `this.templates`.

The issue is that `templates` is not an array when the component renders. This can happen when:
1. The API call to fetch templates fails or returns unexpected data
2. The initial state of `templates` is not properly initialized as an empty array
3. Race condition where the component renders before data is loaded

### Symptoms
- HTTP 500 error when accessing the homepage (`/`)
- Application crashes on initial load
- Error appears even before user authentication in some cases

### Temporary workaround

Add a guard in the computed property to handle cases where `templates` is not an array:

```javascript
// In mailings-new-modal.vue
computed: {
  templatesHasMarkup() {
    if (!Array.isArray(this.templates)) {
      return [];
    }
    return this.templates.filter(/* ... */);
  }
}
```

### Suggested fix

1. Ensure `templates` is initialized as an empty array in the component's `data()` function
2. Add null checks in the computed property
3. Investigate why the API call fails ("Error while fetching group", "error while fetching workspaces")

### Related files
- `packages/ui/routes/mailings/__partials/mailings-new-modal.vue`
- `packages/ui/routes/index.vue`

---

---

## BUG-002: CastError on /groups page - `Cast to ObjectId failed for value "undefined"`

### Status
**Fixed** - First reported: 2024-12 - Fixed: 2024-12

### Affected branches
- `develop`
- `multi-assets-export`
- Potentially any branch based on `develop`

### Error message

**Server logs:**
```
==> GET /api/groups/undefined
CastError: Cast to ObjectId failed for value "undefined" at path "_id" for model "Company"
Error while fetching group
```

### Root cause analysis

The error occurs in `packages/ui/store/user.js` in the `USER_SET` action. When a user logs in, the store attempts to fetch the user's group to check FTP access:

```javascript
group = await this.$axios.$get(groupsItem({ groupId: user?.group?.id }));
```

For admin users who are not associated with a specific group, `user?.group?.id` is `undefined`, causing an API call to `/api/groups/undefined`.

### Symptoms
- Error logged on every page load for admin users
- API returns 500 error for `/api/groups/undefined`
- Does not break the application but pollutes logs

### Fix applied

Added a guard to check if `groupId` exists before making the API call:

```javascript
const groupId = user?.group?.id;
if (groupId) {
  try {
    group = await this.$axios.$get(groupsItem({ groupId }));
  } catch {
    console.error('Error while fetching group');
  }
}
```

### Related files
- `packages/ui/store/user.js`

---

## Template for new bugs

```markdown
## BUG-XXX: [Short description]

### Status
**Open/Closed** - First reported: YYYY-MM

### Affected branches
- branch-name

### Error message
[Paste error here]

### Root cause analysis
[Explanation]

### Symptoms
- Symptom 1
- Symptom 2

### Temporary workaround
[If any]

### Suggested fix
[Steps to fix]

### Related files
- file1.js
- file2.vue
```
