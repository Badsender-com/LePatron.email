export default {
  snackbars: {
    updated: 'Updated',
    created: 'Created',
    deleted: 'Deleted',
    usersFetchError: 'Unable to access users\' list :(',
    emailSent: 'An email was sent',
  },
  global: {
    errors: {
      errorOccured: 'Oops! An error has occurred :(',
      required: 'This field is required',
      userRequired: 'A user is required',
      entityRequired: 'An entity is required',
      replyToRequired: 'A reply email is required',
      targetTableRequired: 'A target table is required',
      nameRequired: 'A name is required',
      apiKeyInvalid: 'API key invalid',
      supportedLanguageIsRequired: 'A language is required',
      apiKeyRequired: 'An API Key is Required',
      senderNameRequired: 'A Sender name is Required',
      senderMailRequired: 'A Sender email is Required',
      WORKSPACE_ALREADY_EXISTS: 'A workspace with this name already exists',
      FORBIDDEN_WORKSPACE_CREATION: 'You don\'t have the rights to create this workspace',
      emailsGroupExist: 'The name of this test list already exist',
      password: {
        error: {
          nouser: 'User not found',
          incorrect: 'Bad password',
        },
      },
      login: {
        error: {
          internal: 'Oops! An error occurred :(',
        },
      },
    },
    add: 'Add',
    apiKey: 'API key',
    entity: 'Entity',
    encodingType: 'Encoding type',
    targetTable: 'Target table',
    supportedLanguage: 'Language',
    profileName: 'ESP profile name',
    teams: 'Workspaces',
    addTags: 'Add tags',
    copyMail: 'Copy',
    copyMailAction: 'Create copy',
    moveFolderAction: 'Move folder',
    moveMail: 'Move',
    location: 'Location',
    moveManyMail: 'Move',
    newTemplate: 'Add a template',
    newFolder: 'Add a folder',
    parentLocation: 'Parent folder location',
    template: 'Template | Templates',
    mailing: 'Email | Emails',
    newMailing: 'Add an email',
    newProfile: 'Add an ESP profile',
    editProfile: 'Edit export profile {name}',
    profile: 'ESP',
    user: 'User | Users',
    newUser: 'Add a user',
    newEmailsGroup: 'Add a test list',
    newTeam: 'Add a workspace',
    newTag: 'Add a tag',
    backToMails: 'Back to emails',
    backToGroups: 'Back to groups',
    group: 'Group | Groups',
    workspaces: 'Workspaces',
    newGroup: 'Add a group',
    workspace: 'Workspace',
    newWorkspace: 'Add a workspace',
    newMail: 'New email',
    image: 'Image | Images',
    actions: 'Actions',
    save: 'Save',
    cancel: 'Cancel',
    create: 'Create',
    createTag: 'Create tag',
    update: 'Update',
    delete: 'Delete',
    reset: 'Reset',
    duplicate: 'Duplicate',
    apply: 'Apply',
    confirm: 'Confirm',
    close: 'Close',
    show: 'Show',
    settings: 'Settings',
    download: 'Download',
    preview: 'Preview',
    previewMailAlt: 'Preview of the email',
    newPreview: 'Create a preview',
    name: 'Name',
    description: 'Description',
    author: 'Author',
    tags: 'Tags',
    password: 'Password',
    email: 'Email',
    enable: 'Enable',
    disable: 'Disable',
    enabled: 'Enabled',
    disabled: 'Disabled',
    status: 'Status',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
    edit: 'Edit',
    move: 'Move',
    emailsGroups: 'Test lists',
    emailsGroupsEmpty: 'No test list available',
    editEmailsGroup: 'Edit test list',
    continue: 'Continue',
    downloadFtp: 'Download FTP',
  },
  layout: {
    logout: 'Logout',
  },
  forms: {
    group: {
      downloadWithoutEnclosingFolder: {
        label: 'Zip file format',
        wrapped: 'Wrap in a parent folder',
        unwrapped: 'Leave files in root folder',
      },
      color: {
        label: 'Custom color',
       },
      defaultWorkspace: {
        label: 'Default workspace\'s name',
      },
      status: {
        label: 'Status',
        demo: 'Demo',
        inactive: 'Inactive',
        active: 'Active',
        requiredValidationMessage: 'A status is required',
      },
      exportFtp: 'Export images on an FTP',
      exportCdn: 'Export images on a CDN',
      enable: 'Enable',
      ftpProtocol: 'FTP protocol',
      host: 'Host',
      username: 'Username',
      port: 'Port',
      path: 'Folder\'s path',
      httpProtocol: 'Protocole HTTP',
      endpoint: 'Images root\'URL',
      editorLabel: 'Button label',
      entryPoint: 'Entry point',
      issuer: 'Issuer',
      userHasAccessToAllWorkspaces: 'Give access to all workspaces to regular users',
    },
    template: {
      meta: 'Meta',
      files: 'Files',
      markup: 'Markup',
    },
    user: {
      passwordConfirm: 'Password confirmation',
      passwordReset: 'Password reset',
      login: 'Login',
      adminLogin: 'Admin Login',
      sendLink: 'Send reset link',
      forgottenPassword: 'Forgotten password ?',
      validate: 'Validate',
      errors: {
        password: {
          required: 'A password is required',
          confirm: 'You need to confirm your password',
          same: 'Your passwords should be identical',
        },
        email: {
          required: 'An email is required',
          valid: 'A valid email is required',
        },
      },
      tooltip: {
        noPassword: 'Disabled cause of SAML Authentication',
      },
    },
    emailsGroup: {
      emails: 'Emails',
      emailsPlaceholder: 'Example: email.01@domain.com;email.02@domain.com;',
      errors: {
        name: {
          required: 'the list name is required',
        },
        emails: {
          required: 'You have to fill at least one email address',
          emailsValid: 'There are invalid email addresses',
        },
      },
      deleteNotice: 'You are about to delete the test list. This action can\'t be undone.',
      deleteSuccess: 'Test list deleted',
    },
    workspace: {
      checkBoxError: 'I understand that workspace\'s emails and folders will be removed too',
      inputError: 'The name is required',
      inputMaxLength: 'Name must not exceed 70 characters',
      moveFolderConfirmationMessage: 'Please choose the destination',
    },
    profile: {
      errors: {
        email: {
          valid: 'A valid email address is required',
        },
        apiKey: {
          unauthorized: 'The provided API key is not allowed :(',
        },
      },
    },
  },
  groups: {
    tabs: {
      informations: 'Information',
    },
    mailingTab: {
      confirmationField: 'Type the email name to confirm',
      deleteWarningMessage: 'You are about to delete the email: <strong>{name}</strong>. This action can\'t be undone.',
      deleteSuccessful: 'Email deleted',
      deleteFolderWarning: 'You are about to delete the folder: <strong>{name}</strong> folder. This action can\'t be undone.',
      deleteFolderNotice: 'Emails and folders contained in this folder will also be deleted',
      deleteFolderSuccessful: 'Folder deleted',
    },
    workspaceTab: {
      confirmationField: 'Type the workspace name to confirm',
      deleteNotice: 'Emails and folders contained in the workspace will also be deleted',
      deleteWarningMessage: 'You are about to delete the workspace: "<strong>{name}</strong>. This action can\'t be undone.',
      deleteSuccessful: 'Workspace deleted',
    },
    delete: {
      'deleteWarningMessage': 'You are about to delete the group "<strong> {name} </strong>". This action cannot be undone.',
      'confirmationField': 'Type the group name to confirm',
      'deleteNotice': 'Administrators, users, templates, workspaces, folders, emails and emails test groups will also be deleted',
      'successful': 'Group deleted',
    }
  },
  mailings: {
    transfer: {
      label: 'Transfer email',
      success: 'Email transferred',
    },
    list: '🔎 Search in the email list',
    creationNotice: 'Click on any of above templates to create email',
    filters: {
      createdBetween: 'Created between',
      updatedBetween: 'Updated between',
      and: 'and',
    },
    deleteManySuccessful: 'Emails deleted',
    deleteConfirmationMessage: 'You are about to delete all the selected emails. This action can\'t be undone.',
    downloadManyMailsWithoutPreview: 'This email list does not contain previews so they will not be downloaded. Do you want to continue anyway?',
    downloadSingleMailWithoutPreview: 'Cannot download an email without a preview. Please open the email at least once to generate one.',  
    duplicate: 'Duplicate email',
    duplicateNotice: 'Are you sure to duplicate: <strong>{name}</strong> ?',
    name: 'Email name',
    errorPreview: 'No preview available for this email',
    subErrorPreview: 'A preview will be generated when opening the email editor',
    rename: 'Rename email',
    selectedCount: '{count} email selected | {count} emails selected',
    selectedShortCount: '{count} email| {count} emails',
    deleteCount: 'Delete {count} email | Delete {count} emails',
    downloadCount: 'Download {count} email | Download {count} emails',
    downloadFtpCount: 'Download ftp {count} email | Download ftp {count} emails',
    moveCount: 'Move {count} email | Move {count} emails',
    deleteNotice: 'This will definitely remove:',
    copyMailConfirmationMessage: 'Please choose the location of the new copy',
    copyMailSuccessful: 'Mail copied',
    moveMailConfirmationMessage: 'Please choose the destination',
    moveMailSuccessful: 'Email moved',
    moveManySuccessful: 'Emails moved',
    downloadManySuccessful: 'Emails download complete',
    downloadMailSuccessful: 'Email download complete',
    editTagsSuccessful: 'Tags updated',
  },
  template: {
    noId: 'No ID',
    noMarkup: 'No markup',
    markup: 'Markup',
    download: 'Download markup',
    preview: 'Download template',
    removeImages: 'Delete all images',
    imagesRemoved: 'Images deleted',
    deleteNotice: 'Deleting a template will also remove every emails using this one',
  },
  tags: {
    list: 'Tags\' list',
    new: 'New tag',
    handle: 'Handle tags',
  },
  users: {
    actions: {
      reset: 'Reset',
      send: 'Send',
      resend: 'Resend',
    },
    passwordTooltip: {
      reset: 'Reset password',
      send: 'Send password\'s email',
      resend: 'Resend password\'s email',
    },
    enableNotice: 'are you sure you want to enable',
    disableNotice: 'Are you sure you want to disable',
    passwordNotice: {
      reset: 'Are you sure you want to reset the password of',
      send: 'Are you sure you want to send the password email to',
      resend: 'Are you sure you want to resend the password email to',
    },
    email: 'Email address',
    lang: 'Language',
    details: 'Details',
    role: 'Role',
  },
  workspaces: {
    name: 'Name',
    description: 'Descritpion',
    members: 'Users',
    userIsGroupAdmin: 'The user is a group admin',
  },
  profiles: {
    name: 'Name',
    type: 'Type',
    senderName: 'Sender name',
    senderMail: 'Sender email address',
    replyTo: 'Reply email address',
    createdAt: 'Creation date',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    contentSendType: 'The content type',
    warningNoFTP: 'You cannot add profile without having configured FTP server.',
    emptyState: 'No profile available',
    deleteWarningMessage: 'You are about to delete the profile: "<strong>{name}</strong>". This action can\'t be undone.',
  },
  folders: {
    name: 'Folder name',
    nameUpdated: 'Folder renamed',
    renameTitle: 'Rename folder <strong>{name}</strong>',
    rename: 'Rename',
    created: 'Folder created',
    conflict: 'Folder already exists',
    moveFolderConfirmationMessage: 'Please choose the destination',
    moveFolderSuccessful: 'Folder moved',
  },
  tableHeaders: {
    groups: {
      downloadWithoutEnclosingFolder: 'Download without parent folder',
      cdnDownload: 'CDN download',
      ftpDownload: 'FTP download',
      status: 'Status',
    },
    users: {
      passwordMail: 'Password\' email',
    },
    templates: {
      markup: 'Markup?',
    },
    mailings: {
      rename: 'Rename',
      transfer: 'Transfer',
    },
  },
};
