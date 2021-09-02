## Description

#67
Add the listing of email groups

## How

Add the tab email groups in file `packages/ui/routes/groups/_groupId/index.vue`

Create a new component `email-groups-tab`

In file email-groups-tab display the list of email-groups, We will have `Name`, `created at` and `delete`

add a confirmation modal for the delete

click on the name of a email group to redirect to edit so we have to create a folder `packages/ui/routes/groups/_groupId/email-groups/_emailsGroupId/index.vue` and we use the same component `new-emails-group`
