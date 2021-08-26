## Description

The purpose of this PR is to add a group of emails
Link Feature https://github.com/Badsender-com/LePatron.email/issues/408

## Current state

We have a menu in the Setting page, but it doesnt contain the Add button of a group of emails
The API is not ready yet

## How

- [ ] In the file `packages/ui/components/group/menu.vue` On ajout un Element dans la menu `Ajouter un groupe des emails`

- [ ] Add the computed `newGroupEmails` which returns `/groups/${this.groupId}/new-group-emails`;

- [ ] Add the component `new-group-email.vue` which contain the input text for the name and for the list of emails

- [ ] Add a validation for the group name and the e-mail text box is not empty

- [ ] Add a fake service for to add the new group email

## How much time

3h
