export default {
  twoFactor: {
    code: {
      label: 'Code',
      submit: 'Verify',
      hints: {
        totp: 'Enter the 6-digit code shown by your authenticator app.',
        email: 'Enter the 6-digit code sent to you by email.',
      },
      recoveryHint:
        'Without your verification method? Enter one of your recovery codes.',
      incorrect: 'Incorrect code',
      expired: 'This step expired: enter your password again.',
      trustDevice: 'Trust this device for 30 days',
      resend: 'Send a new code',
      sent: 'A new code was sent to you',
    },
    setup: {
      intro:
        'Your company requires two-factor authentication: after your password, you will enter a code.',
      choose: 'How do you want to get your codes?',
      methods: {
        totp: 'An authenticator app on my phone',
        email: 'A code by email',
      },
      start: 'Continue',
      emailSent:
        'A code was just sent to you by email: enter it to turn on two-factor authentication.',
      scan: 'Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the code it shows.',
      qrCodeAlt: 'Setup QR code',
      manual: 'Or enter this key in the app:',
      confirm: 'Turn on',
    },
    recoveryCodes: {
      intro:
        'Each recovery code signs you in once, without your verification method. Keep them somewhere safe: they will not be shown again.',
      copy: 'Copy',
      copied: 'Codes copied',
      download: 'Download',
      noted: 'I have saved my recovery codes',
      continue: 'Continue',
    },
    group: {
      title: 'Two-factor authentication',
      description:
        'Every member of the company enters a code after their password. Those who have not set it up yet will do so at their next sign-in.',
      switch: 'Require two-factor authentication',
      saml: 'This company signs in with SSO: two-factor authentication belongs to its identity provider.',
      updated: 'Setting saved',
      required: 'Required of every member.',
      notRequired: 'Not required.',
      managedByTech: 'Only a technical administrator can change this setting.',
    },
    users: {
      column: 'Two-factor',
      methods: { totp: 'App', email: 'Email' },
      notSetUp: 'Not set up',
      reset: 'Reset two-factor authentication',
      resetNotice:
        'Their sessions will end and they will set it up again at their next sign-in. Reset the two-factor authentication of',
      resetDone: 'Two-factor authentication reset',
      emailLocked:
        'Two-factor authentication is set up: only a technical administrator can change the address.',
    },
    passwordSet: 'Password saved: sign in to continue.',
  },
  snackbars: {
    updated: 'Updated',
    created: 'Created',
    deleted: 'Deleted',
    usersFetchError: 'Unable to access users\' list :(',
    groupFetchError: 'Unable to load company data :(',
    emailSent: 'An email was sent',
  },
  global: {
    errors: {
      typeCampagneRequired: 'Campaign type is required.',
      errorOccured: 'Oops! An error has occurred :(',
      passwordLinkExpired:
        'This link has expired or was already used. Ask for a new one from the login page.',
      tooManyRequests: 'Too many attempts. Try again later.',
      createMailingFailed: 'An error has occurred while creating the mailing',
      required: 'This field is required',
      userRequired: 'A user is required',
      entityRequired: 'An entity is required',
      databaseEntityRequired: 'A database entity is required',
      replyToRequired: 'A reply email is required',
      targetTableRequired: 'A target table is required',
      nameRequired: 'A name is required',
      apiKeyInvalid: 'API key invalid',
      supportedLanguageIsRequired: 'A language is required',
      apiKeyRequired: 'An API Key is Required',
      secretKeyRequired: 'A Secret Key is Required',
      adobeImsUrlRequired : 'A login url is required',
      adobeBaseUrlRequired: 'A base url is required',
      senderNameRequired: 'A Sender name is Required',
      senderMailRequired: 'A Sender email is Required',
      WORKSPACE_ALREADY_EXISTS: 'A workspace with this name already exists',
      FORBIDDEN_WORKSPACE_CREATION:
        'You don\'t have the rights to create this workspace',
      INVALID_SSH_KEY_FORMAT:
        'Invalid SSH key format. Accepted formats: PEM or OpenSSH.',
      INCOMPLETE_SSH_KEY: 'Incomplete SSH key: missing end marker.',
      FTP_MISSING_SSH_KEY: 'No SSH key configured for this company.',
      FTP_NOT_ENABLED: 'FTP is not enabled for this company.',
      FTP_CONNECTION_AUTH_FAILED:
        'Authentication failed. Check your credentials (password or SSH key).',
      FTP_CONNECTION_HOST_NOT_FOUND: 'Host not found.',
      FTP_CONNECTION_REFUSED: 'Connection refused.',
      FTP_CONNECTION_INVALID_KEY: 'Invalid SSH key or unsupported format.',
      FTP_CONNECTION_TIMEOUT: 'Connection timed out.',
      FTP_CONNECTION_HANDSHAKE_FAILED:
        'SSH handshake failed. The server may use unsupported algorithms.',
      FTP_PATH_NOT_FOUND: 'Path not found on server.',
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
      session: {
        replaced: 'You have been logged out because you logged in from another location.',
        expired: 'Your session has expired. Please login again.',
      },
    },
    add: 'Add',
    apiKey: 'API key',
    secretKey: 'Secret key',
    adobeImsUrl : 'Adobe login Url',
    adobeBaseUrl : 'Adobe base Url',
    adobeBaseUrlHelper: 'The URL will automatically be completed with /jsp/soaprouter.jsp and /jsp/uploadFile.jsp',
    targetType: 'Connector type : ',
    entity: 'Entity',
    databaseEntity: 'Database entity',
    routingEntity: 'Routing entity',
    routingEntityHint: 'Sending configuration (sender, DKIM). Default: same as database entity.',
    encodingType: 'Encoding type',
    targetTable: 'Target table',
    supportedLanguage: 'Language',
    profileName: 'ESP profile name',
    typeCampagne: 'Campaign Type',
    teams: 'Workspaces',
    addTags: 'Add tags',
    copyMail: 'Copy',
    copyMailAction: 'Create copy',
    moveFolderAction: 'Move folder',
    moveMail: 'Move',
    location: 'Location',
    moveManyMail: 'Move',
    newTemplate: 'Add a template',
    newFolder: 'New folder',
    parentLocation: 'Location',
    template: 'Template | Templates',
    mailing: 'Email | Emails',
    newMailing: 'New email',
    newProfile: 'Add an ESP profile',
    editProfile: 'Edit export profile {name}',
    profile: 'ESP',
    user: 'User | Users',
    newUser: 'Add a user',
    editUser: 'Edit user',
    newEmailsGroup: 'Add a test list',
    editEmailsGroup: 'Edit test list',
    newTeam: 'Add a workspace',
    editTeam: 'Edit workspace',
    newTag: 'Add a tag',
    backToMails: 'Back to emails',
    backToGroups: 'Back to companies',
    group: 'Company | Companies',
    workspaces: 'Workspaces',
    newGroup: 'Add a company',
    newCompany: 'Add a company',
    companyName: 'Company name',
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
    clear: 'Clear',
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
    title: 'Title',
    savedSuccessfully: 'Saved',
    search: 'Search',
    externalUsername: 'External Username',
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
    comments: 'Comments',
    edit: 'Edit',
    move: 'Move',
    moveTo: 'Move to…',
    emailsGroups: 'Test lists',
    variables: 'Variables',
    emailsGroupsEmpty: 'No test list available',
    continue: 'Continue',
    all: 'All',
    downloadFtp: 'Download FTP',
    noData: 'No data available',
  },
  layout: {
    logout: 'Logout',
    help: 'Need some help?',
  },
  forms: {
    group: {
      sections: {
        generalInfo: 'General information',
        imageHosting: 'Image hosting',
        authentication: 'Authentication',
        authenticationDescription: 'Configure SAML authentication to allow your users to login with their enterprise account.',
        permissions: 'Permissions',
        permissionsDescription: 'Manage user access rights to different workspaces.',
        companyInfo: 'Company information',
        companyInfoDescription: 'Enter the main information about the company.',
      },
      enableSaml: 'Enable SAML authentication',
      entryPointHint: 'Login URL provided by your identity provider',
      issuerHint: 'Unique identifier for your application at the provider',
      idpCertHint:
        'Signing certificate of the identity provider (PEM), found in its SAML metadata. Required: without it, SSO sign-in is not offered.',
      dangerZone: {
        title: 'Danger zone',
        description: 'Actions in this zone are irreversible. Proceed with caution.',
        deleteCompany: 'Delete company',
        deleteTitle: 'Delete company',
      },
      name: 'Company name',
      downloadWithoutEnclosingFolder: {
        label: 'Zip file format',
        wrapped: 'Wrap in a parent folder',
        unwrapped: 'Leave files in root folder',
      },
      color: {
        label: 'Custom color',
        description: 'Define the colors available in the email editor for this company.',
      },
      defaultWorkspace: {
        label: 'Default workspace\'s name',
        hint: 'Leave empty to use the default name',
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
      samlAuthentication: 'SAML authentication',
      enable: 'Enable',
      ftpProtocol: 'FTP protocol',
      host: 'Host',
      username: 'Username',
      port: 'Port',
      path: 'Folder\'s path',
      httpProtocol: 'HTTP protocol',
      endpoint: 'Images root URL',
      editorLabel: 'Button label',
      ftpAuthType: 'Authentication method',
      ftpSshKey: 'SSH private key',
      ftpSshKeyPlaceholder: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
      testFtpConnection: 'Test connection',
      ftpConnectionSuccess: 'Connection successful',
      entryPoint: 'Entry point',
      issuer: 'Issuer',
      idpCert: 'Identity provider certificate',
      userHasAccessToAllWorkspaces:
        'Give access to all workspaces to regular users',
    },
    template: {
      meta: 'Meta',
      files: 'Files',
      markup: 'Markup',
    },
    user: {
      name: 'User name',
      externalUsername: 'External user name',
      optional: ' (Optional)',
      passwordConfirm: 'Password confirmation',
      passwordReset: 'Password reset',
      login: 'Login',
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
      emailsHint: 'Separate email addresses with semicolons (;)',
      configuration: 'Test list configuration',
      configurationDescription:
        'Define the name and email addresses for this test list',
      errors: {
        name: {
          required: 'the list name is required',
        },
        emails: {
          required: 'You have to fill at least one email address',
          emailsValid: 'There are invalid email addresses',
        },
      },
      deleteNotice:
        'You are about to delete the test list. This action can\'t be undone.',
      deleteSuccess: 'Test list deleted',
    },
    workspace: {
      checkBoxError:
        'I understand that workspace\'s emails and folders will be removed too',
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
        default : 'An error occurred. Please try again.',
        creation : 'An error occurred while creating the connector. Please contact support with this ID: {logId}.',
        update : 'An error occurred while updating the connector. Please contact support with this ID: {logId}.',
        invalidClient : 'Invalid API Key.',
        invalidSecret : 'Invalid Secret Key.'
      },
    },
  },
  groups: {
    tabs: {
      general: 'General',
    },
    platform: {
      badge: 'Platform',
      setAction: 'Set as platform company',
      unsetAction: 'Remove platform role',
      setDone: '"{name}" is now the platform company',
      unsetDone: '"{name}" is no longer the platform company',
    },
    modules: {
      title: 'Enabled modules',
      description: 'Enable or disable the modules available for this company.',
      notEnabled: 'Module not enabled',
      emailBuilder: {
        name: 'Email Builder',
        description: 'Create and edit responsive emails',
      },
      crmIntelligence: {
        name: 'CRM Intelligence',
        description: 'Dashboards and analytics',
        configHint: 'Advanced configuration in dedicated tab',
        toggleMovedHint: 'Module activation is in the General tab',
      },
      mcp: {
        name: 'MCP',
        description: 'Claude, ChatGPT and Copilot connected to LePatron',
        configHint: 'The tech admin then turns access on in the AI features',
        closeTitle: 'Close the MCP module?',
        close: 'Close the module',
        closeConfirm:
          ' | The only connection of {group} will be ended at once. Its user will connect their assistant again if the module reopens. | The {count} connections of {group} will be ended at once. Each user will connect their assistant again if the module reopens.',
        closeConfirmUnknown:
          'The connections of {group} will be ended at once. Each user will connect their assistant again if the module reopens.',
      },
    },
    mailingTab: {
      confirmationField: 'Type the email name to confirm',
      deleteWarningMessage:
        'You are about to delete the email: <strong>{name}</strong>.<br/>This action can\'t be undone.',
      deleteSuccessful: 'Email deleted',
      deleteFolderWarning:
        'You are about to delete the folder: <strong>{name}</strong> folder.<br/>This action can\'t be undone.',
      deleteFolderNotice:
        'Emails and folders contained in this folder will also be deleted',
      deleteFolderSuccessful: 'Folder deleted',
    },
    workspaceTab: {
      confirmationField: 'Type the workspace name to confirm',
      deleteNotice:
        'Emails and folders contained in the workspace will also be deleted',
      deleteWarningMessage:
        'You are about to delete the workspace: <strong>{name}</strong>.<br/>This action can\'t be undone.',
      deleteSuccessful: 'Workspace deleted',
      empty: 'No workspaces yet',
    },
    delete: {
      deleteWarningMessage:
        'You are about to delete the company: <strong>{name}</strong>.<br/>This action can\'t be undone.',
      confirmationField: 'Type the company name to confirm',
      deleteNotice:
        'Administrators, users, templates, workspaces, folders, emails and test lists will also be deleted.',
      successful: 'Company deleted',
    },
  },
  mailings: {
    noMailingsAvailable: 'No emails available',
    transfer: {
      label: 'Transfer email',
      success: 'Email transferred',
    },
    list: 'Search in the email list',
    creationNotice: 'Click on any of above templates to create email',
    filters: {
      title: 'Filters',
      createdBetween: 'Created between',
      updatedBetween: 'Updated between',
      and: 'and',
      searchPlaceholder: 'Search by name...',
      startDate: 'Start date',
      endDate: 'End date',
    },
    search: {
      scope: 'Search in',
      currentFolder: 'Current folder',
      allWorkspaces: 'All my workspaces',
      location: 'Location',
      noMatchInAllWorkspaces: 'No email matches your search in your workspaces',
      noMailingInAllWorkspaces: 'No email in your workspaces',
      noMatchInLocation: 'No email matches your search in this location',
      searchAllWorkspaces: 'Search all my workspaces',
      resetFilters: 'Reset filters',
      readOnly: 'Read only: open its location',
      activeFilters: '{n} active filter | {n} active filters',
    },
    deleteManySuccessful: 'Emails deleted',
    deleteConfirmationMessage:
      'You are about to delete all the selected emails.<br/>This action can\'t be undone.',
    downloadManyMailsWithoutPreview:
      'This email list does not contain previews so they will not be downloaded. Do you want to continue anyway?',
    downloadSingleMailWithoutPreview:
      'Cannot download an email without a preview. Please open the email at least once to generate one.',
    duplicate: 'Duplicate email',
    duplicateNotice: 'Are you sure to duplicate: <strong>{name}</strong> ?',
    name: 'Email name',
    errorPreview: 'No preview available for this email',
    locationUnreachable:
      'This workspace or folder is no longer available. Back to the first workspace.',
    subErrorPreview:
      'A preview will be generated when opening the email editor',
    subErrorPreviewReadOnly:
      'A preview will be generated when a member of the workspace opens the email in the editor',
    previewUnavailable: 'The preview could not be loaded',
    subPreviewUnavailable: 'Please try again, or contact your administrator',
    rename: 'Rename email',
    selectedCount: '{count} email selected | {count} emails selected',
    selectedMailings: 'email selected | emails selected',
    selectedShortCount: '{count} email| {count} emails',
    deleteCount: 'Delete {count} email | Delete {count} emails',
    downloadCount: 'Download {count} email | Download {count} emails',
    downloadFtp: 'Download FTP',
    downloadFtpCount:
      'Download ftp {count} email | Download ftp {count} emails',
    moveCount: 'Move {count} email | Move {count} emails',
    deleteNotice: 'This will definitely remove:',
    copyMailConfirmationMessage: 'Please choose the location of the copy:',
    copyMailConfirmationMessageWithName:
      'Please choose the location of the copy of email <strong>{name}</strong>:',
    copyMailSuccessful: 'Mail copied',
    moveMailConfirmationMessage: 'Please choose the destination:',
    moveMailConfirmationMessageWithName:
      'Please choose the destination of email <strong>{name}</strong>:',
    moveMailSuccessful: 'Email moved',
    moveManySuccessful: 'Emails moved',
    downloadManySuccessful: 'Emails download complete',
    downloadMailSuccessful: 'Email download complete',
    editTagsSuccessful: 'Tags updated',
    openComments: 'Open comments',
    openCommentsApproved: 'Approved — open comments',
    duplicateTranslate: 'Duplicate + Translate',
  },
  translation: {
    duplicateAndTranslate: 'Duplicate and translate',
    autoDetect: 'Auto-detect',
    sourceLanguage: 'Source language',
    targetLanguage: 'Target language',
    newName: 'New email name',
    translate: 'Translate',
    duplicateNotice: 'The email <strong>{name}</strong> will be duplicated and automatically translated.',
    noActiveIntegration: 'No active AI integration. Configure an integration in the company settings.',
    noLanguagesConfigured: 'No languages configured. Configure available languages in the company settings.',
    success: 'Email duplicated and translated successfully',
    successTitle: 'Translation complete',
    successMessage: 'Your email has been duplicated and translated successfully.',
    warningTitle: 'Please verify:',
    // Keyed as the server sends them in a job's warningKeys.
    warnings: {
      checkLinks: 'Links in the email',
      checkImages: 'Images containing text',
      checkVariant: 'Template variant if applicable',
      composedBlockUntranslated: 'Composed blocks: some could not be translated, or were rebuilt with a newer version of the block builder',
    },
    understood: 'Got it',
    translatingNotice: 'Translation in progress, please wait...',
    progressStarting: 'Starting translation...',
    progressBatch: 'Translating... (batch {current}/{total})',
    progressCompleted: 'Completed!',
    pleaseWait: 'Please wait...',
    cancelled: 'Translation cancelled',
    estimatedTime: '~{time} remaining',
    destination: 'Destination',
    destinationHint: 'Select where to create the translated copy',
  },
  template: {
    noId: 'No ID',
    noMarkup: 'No markup',
    markup: 'Markup',
    download: 'Download markup',
    preview: 'Download template',
    removeImages: 'Delete all images',
    imagesRemoved: 'Images deleted',
    deleteNotice:
      'Deleting a template will also remove every emails using this one',
  },
  tags: {
    list: 'Tags\' list',
    new: 'New tag',
    handle: 'Handle tags',
    tag: 'Tag',
  },
  users: {
    actions: {
      reset: 'Reset',
      send: 'Send',
      resend: 'Resend',
      activate: 'Activate user',
      deactivate: 'Deactivate user',
      sendPassword: 'Send password email',
      resendPassword: 'Resend password email',
      resetPassword: 'Reset password',
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
    roles: {
      superAdmin: 'Super admin',
      groupAdmin: 'Company admin',
      regularUser: 'Regular user',
      writer: 'Writer',
      reviewer: 'Reviewer',
      companyAdminTech: 'Tech admin',
      chip: {
        superAdmin: 'Super admin',
        groupAdmin: 'Admin',
      },
    },
    noUsersAvailable: 'No users available',
    readOnlyAccount:
      'This account has more rights than yours: you can see it, not change it.',
    sections: {
      statusSecurity: 'Status & Security',
      statusSecurityDescription:
        'Manage account status and password options.',
    },
    status: {
      confirmed: 'Active',
      saml: 'SSO',
      passwordSent: 'Pending',
      toInitialize: 'To initialize',
      deactivated: 'Deactivated',
    },
    statusDescription: {
      confirmed: 'The user has access to the platform.',
      saml: 'The user authenticates via SAML SSO.',
      passwordSent: 'A password email has been sent. Awaiting user confirmation.',
      toInitialize: 'The user has not yet received a password email.',
      deactivated: 'The user can no longer access the platform.',
    },
  },
  workspaces: {
    name: 'Name',
    description: 'Description',
    members: 'Users',
    membersDescription:
      'Select the users who will have access to this workspace.',
    userIsGroupAdmin: 'The user is a company admin',
    noUsersAvailable: 'No users available',
    sections: {
      info: 'Information',
      infoDescription: 'Set the workspace name.',
    },
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
    warningNoFTP:
      'You cannot add profile without having configured FTP server.',
    emptyState: 'No profile available',
    deleteWarningMessage:
      'You are about to delete the profile: <strong>{name}</strong>.<br/>This action can\'t be undone.',
    newProfile: 'New ESP profile',
    espType: 'ESP provider',
    espTypeDescription: 'Select the email service provider for this profile.',
    selectEsp: 'Email service provider',
    apiConfiguration: 'API configuration',
    apiConfigurationDescription:
      'Enter the API credentials for your ESP account.',
    senderConfiguration: 'Sender information',
    senderConfigurationDescription:
      'Configure the default sender details for emails sent via this profile.',
    databaseConfiguration: 'Database configuration',
    databaseConfigurationDescription:
      'Configure the database entity and target table settings.',
    targetTypeDescription:
      'Select the target type for Adobe Campaign deliveries.',
  },
  folders: {
    name: 'Folder name',
    nameUpdated: 'Folder renamed',
    renameTitle: 'Rename folder <strong>{name}</strong>',
    rename: 'Rename',
    created: 'Folder created',
    conflict: 'Folder already exists',
    hasChildren: 'This folder contains subfolders and cannot be moved to another folder',
    moveFolderConfirmationMessage: 'Please choose the destination:',
    moveFolderConfirmationMessageWithName:
      'Please choose the destination of folder <strong>{name}</strong>:',
    moveFolderSuccessful: 'Folder moved',
  },
  tableHeaders: {
    groups: {
      cdnDownload: 'CDN',
      ftpDownload: 'FTP',
      status: 'Status',
      esp: 'ESP',
      ai: 'AI',
      mcp: 'MCP',
    },
    users: {
      passwordMail: 'Password\' email',
    },
    templates: {
      markup: 'Markup?',
      coverImage: 'Preview?',
      imageCount: 'Images',
    },
    mailings: {
      rename: 'Rename',
      transfer: 'Transfer',
    },
    workspaces: {
      assigned: 'Access',
    },
  },
  trackingConfig: {
    sidebarLabel: 'Tracking',
    title: 'Global tracking',
    description:
      'Define UTM parameters automatically applied to every email (global configuration). Values defined here override any existing values in template links.',
    enabled: 'Enable global tracking',
    restrictValues:
      'Restrict to the parameters below (disable free-form input in the builder)',
    addParam: 'Add a parameter',
    key: 'Key',
    values: 'Allowed values',
    valuesHint: 'e.g. newsletter, promo (comma-separated)',
    required: 'Required',
    locked: 'Locked',
    lockedHint:
      'When enabled, users cannot enter a free-form value for this key — they must pick one of the values defined above.',
    lockedDisabledHint:
      'Define at least one possible value before locking this key.',
    empty: 'No tracking parameter defined',
    inheritedFromGroup: 'Inherited from the global configuration',
    cascade: {
      label: 'Tracking configuration for this template',
      inherit: 'Inherit from the global configuration',
      inheritDescription:
        'The parameters defined at the global level apply as-is.',
      extend: 'Inherit and add template-specific parameters',
      extendDescription:
        'Global parameters stay active; the ones added below extend them (or override on key conflict).',
      replace: 'Replace the global configuration with a template-specific one',
      replaceDescription:
        'Only the parameters defined below apply; the global configuration is ignored.',
    },
    validation: {
      emptyKey: 'Key is required',
      duplicateKey: 'This key is duplicated',
    },
    snackbars: {
      updated: 'Tracking configuration saved.',
      error: 'An error occurred while saving.',
    },
    builder: {
      requiredMissing: 'Required tracking parameters are missing',
      requiredMissingDescription:
        'Please fill in these parameters before downloading: {keys}',
    },
    templates: {
      sectionTitle: 'Per-template tracking overrides',
      sectionDescription:
        'You can override or extend the global configuration above for each template.',
      empty: 'No template available.',
      statusInherits: 'Inherits from the global configuration',
      statusMerge: 'Extends the global configuration',
      statusOverride: 'Specific configuration (overrides the global configuration)',
    },
  },
  personalizedVariables: {
    title: 'Custom variables',
    description:
      'Define custom variables that can be used in your email templates',
    empty: 'No variables defined yet',
    status: 'Status',
    label: 'Label',
    variable: 'Variable',
    actions: 'Actions',
    addRow: 'Add a variable',
    save: 'Save',
    delete: 'Delete',
    deleteTitle: 'Delete variable',
    deleteNotice: 'Are you sure you want to delete the variable "{variable}"?',
    validation: {
      required: 'This field is required.',
    },
    snackbars: {
      deleted: 'Variable deleted successfully.',
      updated: 'Variables saved successfully.',
      error: 'An error occurred. Please try again.',
    },
  },
  adobe: {
    targetTypes: {
      'NMS_DELIVERY': 'Delivery',
      'NMS_DELIVERY_MODEL': 'Delivery Template'
    }
  },
  exportOptions: {
    title: 'Export options',
    sections: {
      zipFormat: 'Zip file format',
      zipFormatDescription: 'Configure the structure of the zip file downloaded by users.',
      ftpHosting: 'FTP/SFTP hosting',
      ftpHostingDescription: 'Configure an FTP or SFTP server to automatically host email images.',
      cdnHosting: 'CDN hosting',
      cdnHostingDescription: 'Configure a custom CDN to host email images.',
    },
    cdnEndpointHint: 'Base URL of your CDN (without protocol)',
    cdnButtonLabelHint: 'Label displayed in the editor',
  },
  retex: {
    title: 'Session summaries',
    description:
      'With a feedback, the user may attach a summary of their session, to help the platform company improve its expertises and skills. It is kept only if the company allows it here, and the user agrees to it every time.',
    alwaysShared:
      'The rating and the comment of a feedback are always shared with the platform company, whether session summaries are allowed or not.',
    offForgets:
      'Turning it off erases the session summaries already kept, and shortens the comments of the feedbacks to 500 characters, the length allowed without them.',
    updated: 'Session summaries updated',
  },
  oauthConsent: {
    claimedName: '"{client}"',
    title: 'Connect {client} to LePatron',
    pageTitle: 'Connect an assistant to LePatron',
    loginHint: 'Log in to let your AI assistant access LePatron.',
    heading: '{client} asks to access your LePatron account',
    errorTitle: 'Cannot connect',
    changeAccount: 'Change account',
    switchAccount: 'Use another account',
    closeHint: 'You can close this window and start the connection again from your assistant.',
    canDo: 'This application will be able to',
    rights: {
      read: 'Read the expertises, the skills and your mailings',
      readHint: 'With your rights, exactly as in the app.',
      readOnly: 'Change, publish or delete nothing',
      readOnlyHint: 'It can only send your feedback on what LePatron gave you.',
    },
    registration: {
      dynamicTitle: 'Unverified application',
      dynamic:
        'It registered itself: LePatron cannot vouch for its name. Only go on if you just started the connection from it.',
      dynamicBadge: 'Name given by the application',
      metadataDocument: 'Identity verified by {host}',
      preRegistered: 'Declared by the company {company}',
    },
    allowWrite: 'Also propose drafts of skills and expertises',
    allowWriteHint:
      'Super admins only. Only a person publishes a draft. Tick it only for an assistant of the platform company.',
    group: 'Company',
    groupHint:
      'The assistant will only see this company. To read another one, connect it again.',
    pickGroup: 'Pick a company',
    footnote:
      'Valid for 90 days, revocable at any time from Connected applications. Once allowed, you will be sent back to {host}.',
    allow: 'Allow',
    allowIn: 'Allow in {group}',
    deny: 'Deny',
    expired:
      'This connection request has expired, or was started in another browser. Start the connection again from your assistant.',
    clientOfAnotherCompany:
      'This application is reserved for the users of the company that declared it.',
    accountCannotConnect:
      'This account cannot connect an assistant: log in with your user account.',
    noAccess:
      'Your company has no MCP access: ask its administrator to turn it on.',
    signInRequired:
      'Your session has expired: log in to LePatron again, then start the connection again from your assistant.',
    readScopeRequired:
      'The assistant must at least be able to read LePatron: start the connection again from your assistant.',
    noModule:
      'The MCP module is not included in your company\'s subscription: contact the platform company to add it.',
    noModuleCanOpen:
      'The MCP module is not included in the company\'s subscription. As a super admin, you can open it in its Modules, then turn its MCP access on.',
    noModuleCanOpenIn:
      'The MCP module is not included in the subscription of {group}. As a super admin, you can open it in its Modules, then turn its MCP access on.',
    noAccessCanOpen:
      'The company\'s MCP access is off. As a super admin, you can turn it on in its AI Features.',
    noAccessCanOpenIn:
      'The MCP access of {group} is off. As a super admin, you can turn it on in its AI Features.',
  },
  mcpClients: {
    pageTitle: 'MCP clients',
    description:
      'For an assistant that asks for a client ID and a secret, such as Copilot Studio in manual mode. Only the company\'s users can connect with them. Claude, ChatGPT and Microsoft 365 Copilot register themselves: they have nothing to do here.',
    listLabel: 'Registered clients',
    clientMeta: 'Created on {date} · secret sent: {authMethod}',
    clientIdLine: 'Client ID: {id}',
    secretFootnote:
      'The secret is only shown at creation. If it is lost, delete the client and create another one.',
    mcpOff:
      'The company\'s MCP access is off: these clients cannot connect. It is turned on in',
    add: 'Add a client',
    addDescription:
      'Copy the redirect URL the assistant shows on its set-up screen.',
    name: 'Name',
    nameHint: 'Shown to the user on the consent screen.',
    redirectUris: 'Redirect URLs',
    redirectUrisHint: 'One per line, over HTTPS, or over HTTP to localhost.',
    authMethod: 'Secret sent',
    authMethodHint:
      'Where the assistant sends the secret to LePatron. If unsure, keep “In the request body”.',
    advanced: 'Advanced setting: how the secret is sent',
    authMethods: {
      client_secret_post: 'In the request body',
      client_secret_basic: 'In the header (Basic)',
    },
    empty: 'No client registered',
    emptyHint:
      'That is the usual case: only a manual set-up of Copilot Studio asks for one.',
    loadError: 'The MCP clients could not be loaded.',
    createdBadge: 'Client created',
    createdTitle: 'Copy these values into “{name}”',
    secretOnce: 'The secret will never be shown again.',
    serverOnPage: 'The server addresses remain available on this page.',
    copySecretFirst: 'Copy the secret, or tick the box, to finish',
    secretSavedConfirm: 'I have saved this secret',
    secretDone: 'Done',
    copyFailed: 'The copy failed: select the value and copy it by hand.',
    copyField: 'Copy: {field}',
    deleteNamed: 'Delete {name}',
    copy: 'Copy',
    copied: 'Copied',
    deleteTitle: 'Delete this client?',
    deleteConfirm:
      'The assistant “{name}” will no longer be able to connect or renew its connections. Those under way stop at once.',
    deleted: 'Client deleted',
    serverTitle: 'Server settings',
    serverDescription:
      'What the assistant\'s set-up screen asks for, besides the client ID and the secret.',
    settings: {
      clientId: 'Client ID',
      clientSecret: 'Client secret',
      mcpUrl: 'MCP server URL',
      authorizationUrl: 'Authorization URL',
      tokenUrl: 'Token and refresh URL',
      scope: 'Scope',
      scopeHint:
        'Read, and send the user\'s feedback. Proposing drafts of skills and expertises (skills:write) is only granted to super admins, when they ask for it at connection.',
    },
    errors: {
      // The codes the API answers (ERROR_CODES.MCP_CLIENT_…).
      MCP_CLIENT_INVALID_NAME: 'Give a name of 1 to 100 characters.',
      MCP_CLIENT_INVALID_REDIRECT_URIS:
        'Give 1 to 10 redirect addresses, in HTTPS or to the user\'s own machine.',
      MCP_CLIENT_INVALID_AUTH_METHOD: 'Pick how the assistant sends the secret.',
      MCP_CLIENT_INVALID_METADATA:
        'LePatron would refuse this client when it connects: check its redirect addresses.',
      MCP_CLIENT_NOT_FOUND: 'This client no longer exists.',
      MCP_FORBIDDEN_COMPANY: 'You do not manage the MCP clients of this company.',
      nameTooLong: 'The name is at most 100 characters long.',
      redirectUrisRequired: 'At least one redirect URL is required.',
      redirectUrisInvalid:
        'Up to 10 URLs, over HTTPS (HTTP only to localhost), without a # fragment.',
      redirectUriRefused:
        '“{uri}” is refused: a redirect URL is over HTTPS, or over HTTP to localhost, without a # fragment.',
    },
  },
  connectedApplications: {
    pageTitle: 'Connected applications',
    description:
      'The AI assistants you connected to LePatron. Each reads LePatron with your rights, in the company chosen when connecting. One row per connection: an assistant connected from two machines shows twice. Revoke the ones you no longer use.',
    name: 'Application',
    group: 'Company',
    connectedAt: 'Connected on',
    lastUsedAt: 'Last used',
    neverUsed: 'Never used',
    empty: 'No connected applications.',
    loadError: 'Your connected applications could not be loaded.',
    revoke: 'Revoke',
    revokeOne: 'Revoke {name}, connected on {date}',
    revokeTitle: 'Revoke this connection?',
    revokeConfirm:
      'The connection of “{name}” made on {date} will lose its access to LePatron for the company {group} at once. Your other connections of this application stay. To use it here again, connect it again.',
    revoked: 'Connection revoked',
    groupCount:
      'No AI assistant connections | 1 AI assistant connection | {count} AI assistant connections',
    groupRevoke: 'Revoke all',
    groupRevokeTitle: 'Revoke every AI assistant connection?',
    groupRevokeConfirm:
      'Every AI assistant connection of the company {group} loses its access at once. Each user will have to connect their assistant again. | The AI assistant connection of the company {group} loses its access at once. Its user will have to connect it again. | The {count} AI assistant connections of the company {group} lose their access at once. Each user will have to connect theirs again.',
    groupCountError: 'The number of AI assistant connections is unavailable.',
    groupRevoked: 'AI assistant connections revoked',
    allGroups: 'All',
    noModule:
      'The MCP module is not included in the subscription of {group}: no assistant can connect to it.',
    accessOff:
      'MCP access is off for {group}: no assistant can connect to it, and its connections were ended when it was turned off.',
    errors: {
      MCP_CONNECTION_NOT_FOUND:
        'This connection no longer exists: it was already revoked.',
    },
  },
  mcpAccess: {
    title: 'MCP access',
    description:
      'Your users connect Claude, ChatGPT or Copilot to LePatron. The assistant reads with their rights, in this company only.',
    switch: 'Allow AI assistants to connect',
    on: 'On',
    off: 'Off',
    address: 'Address to give your users',
    addressHint:
      'They paste it in their assistant\'s connectors, then sign in with their LePatron account.',
    step1: 'You turn the access on for the company.',
    step2: 'Each user connects their assistant, with their own account.',
    step3: 'The assistant reads expertises, skills and mailings, and never changes your mailings.',
    copyAddress: 'Copy the MCP server address',
    clientsTitle: 'Clients registered by hand',
    clientsDescription:
      'Only Copilot Studio in manual mode needs one: Claude, ChatGPT and Microsoft 365 Copilot register themselves.',
    manageClients: 'Manage',
    turnOff: 'Turn off access',
    notIncluded: 'Not included',
    noModule:
      'The MCP module is not included in the subscription of {group}. Contact the platform company to add it.',
    moduleMissing:
      'The MCP module is not included in the subscription of {group}.',
    openModule: 'Open the module',
    offTitle: 'Turn MCP access off?',
    offConfirm:
      'Every assistant connected to the accounts of {group} will be disconnected at once. Turning it back on reconnects none: each user will connect theirs again.',
    updated: 'MCP access updated',
  },
  crmIntelligence: {
    title: 'CRM Intelligence',
    subtitle: 'Analytics dashboards',
    dashboards: 'Dashboards',
    selectDashboard: 'Select a dashboard from the left menu to get started.',
    noDashboards: 'No dashboards available',
    loadingDashboard: 'Loading dashboard...',
    marketing: {
      title: 'CRM Intelligence',
      subtitle: 'Centralize your CRM and Marketing KPIs in LePatron. Visualize your performance in real-time.',
      ctaPrimary: 'Request a demo',
      ctaSecondary: 'Learn more',
      featuresTitle: 'Drive your data-driven strategy',
      features: [
        {
          icon: 'area-chart',
          title: 'Campaign Performance',
          description: 'Track key metrics of your email sends in real-time.',
        },
        {
          icon: 'mail-check',
          title: 'Deliverability',
          description: 'Analyze your deliverability rates and identify issues.',
        },
        {
          icon: 'heart-handshake',
          title: 'Customer Engagement',
          description: 'Measure your audience engagement across all channels.',
        },
        {
          icon: 'dollar-sign',
          title: 'Marketing ROI',
          description: 'Calculate the return on investment of your campaigns.',
        },
        {
          icon: 'layout-dashboard',
          title: 'Custom Dashboards',
          description: 'Create dashboards tailored to your business needs.',
        },
        {
          icon: 'database',
          title: 'Metabase Integration',
          description: 'Connect your data sources via Metabase.',
        },
      ],
      footerCta: 'Ready to drive your performance?',
      screenshotAlt: 'CRM Intelligence Preview',
    },
    errors: {
      loadFailed: 'Unable to load the dashboard.',
      embedFailed: 'Error loading the dashboard.',
      dashboardAlreadyExists: 'A dashboard with this ID already exists for this integration.',
      fetchIntegrationsFailed: 'Unable to load integrations.',
      fetchDashboardsFailed: 'Unable to load dashboards.',
    },
    admin: {
      title: 'CRM Intelligence',
      description: 'Manage dashboard integrations for this company.',
      enabled: 'Enable CRM Intelligence',
      metabaseConfigHint: 'Configure Metabase connections in the Integrations tab.',
      goToIntegrations: 'Go to Integrations',
      metabaseConfig: 'Metabase Configuration',
      siteUrl: 'Metabase URL',
      invalidUrl: 'Invalid URL',
      siteUrlHint: 'E.g., https://metabase.example.com',
      secretKey: 'Embedding secret key',
      secretKeyHint: 'Find this key in Admin > Embedding > Static embedding',
      secretKeyHintEdit: 'Leave empty to keep current key',
      testConnection: 'Test connection',
      testConnectionSuccess: 'Configuration valid',
      testConnectionFailed: 'Configuration invalid',
      // Integrations section
      integrationsSection: 'Integrations',
      integrationsSectionHint: 'Configure connections to dashboarding tools (Metabase, etc.)',
      integrations: 'Integrations',
      addIntegration: 'Add integration',
      editIntegration: 'Edit integration',
      integrationName: 'Integration name',
      noIntegrations: 'No integrations configured',
      createSuccess: 'Integration created',
      deleteSuccess: 'Integration deleted',
      deleteError: 'Error deleting integration',
      deleteIntegrationConfirmTitle: 'Delete integration?',
      deleteIntegrationConfirmText: 'This action cannot be undone. Associated dashboards will no longer work.',
      saveSuccess: 'Configuration saved',
      saveError: 'Error saving configuration',
      // Dashboards section
      dashboardsSection: 'Dashboards',
      dashboardsSectionHint: 'Configure the dashboards displayed to users and their display order.',
      dashboards: 'Dashboards',
      addDashboard: 'Add dashboard',
      editDashboard: 'Edit dashboard',
      selectIntegration: 'Integration',
      integrationRequired: 'Please select an integration',
      dashboardId: 'Dashboard ID',
      dashboardIdHint: 'Number visible in Metabase URL',
      dashboardIdRequired: 'Dashboard ID is required',
      dashboardName: 'Display name',
      dashboardNameRequired: 'Name is required',
      dashboardDescription: 'Description',
      dashboardDescriptionPlaceholder: 'Optional dashboard description',
      noDashboards: 'No dashboards configured',
      noIntegrationsForDashboards: 'Create an integration first to add dashboards.',
      dashboardSaveSuccess: 'Dashboard saved',
      dashboardCreateSuccess: 'Dashboard created',
      dashboardSaveError: 'Error saving dashboard',
      dashboardDeleteSuccess: 'Dashboard deleted',
      dashboardDeleteError: 'Error deleting dashboard',
      deleteDashboardConfirmTitle: 'Delete dashboard?',
      deleteDashboardConfirmText: 'This action cannot be undone.',
      deleteDashboardConfirmTextWithName: 'Are you sure you want to delete the dashboard "{name}"? This action cannot be undone.',
      reorderError: 'Error reordering dashboards',
      moveUp: 'Move up',
      moveDown: 'Move down',
    },
  },
  modules: {
    emailBuilder: 'Email Builder',
    crmIntelligence: 'CRM Intelligence',
    settings: 'Settings',
    inactive: 'Not activated',
  },
  emailBuilder: {
    marketing: {
      title: 'Email Builder',
      subtitle:
        'Create professional responsive emails with our intuitive drag & drop editor.',
      ctaPrimary: 'Request a demo',
      ctaSecondary: 'Learn more',
      featuresTitle: 'Everything you need',
      features: [
        {
          icon: 'grip-vertical',
          title: 'Intuitive Drag & Drop',
          description: 'Build your emails visually, without any code.',
        },
        {
          icon: 'smartphone',
          title: 'Native Responsive',
          description: 'Emails optimized for all devices and email clients.',
        },
        {
          icon: 'puzzle',
          title: 'Reusable Blocks',
          description: 'Create a component library for your teams.',
        },
        {
          icon: 'palette',
          title: 'Built-in Design System',
          description: 'Follow your brand guidelines with custom templates.',
        },
        {
          icon: 'cloud-upload',
          title: 'Multi-ESP Export',
          description: 'Export to Sendinblue, Mailchimp, Actito and more.',
        },
        {
          icon: 'users',
          title: 'Team Collaboration',
          description: 'Work together with role management and workspaces.',
        },
      ],
      footerCta: 'Ready to create your first emails?',
      screenshotAlt: 'Email Builder Interface',
    },
  },
  sidebar: {
    modules: {
      emailBuilder: 'Email Builder',
      crmIntelligence: 'CRM Intelligence',
      deliverability: 'Deliverability',
      designSystem: 'Design System',
      aiStudio: 'AI Studio',
    },
    system: {
      settings: 'Settings',
      connectedApplications: 'Connected applications',
      help: 'Help',
      logout: 'Sign out',
    },
    aria: {
      closeNavigation: 'Close navigation',
      breadcrumb: 'Breadcrumb',
      moreActions: 'More actions',
    },
    settingsHeader: 'Settings',
    utilities: 'Utilities',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
    resizeHandle:
      'Resize sidebar (use arrow keys, Shift for larger steps, Home/End for min/max)',
    selectModule: 'Select a module to get started',
    moduleLockedLabel: '{module} (locked - upgrade required)',
    upgradeRequired: 'Upgrade required',
    upgradeMessage: 'The {module} module is not included in your current plan.',
    contactAdmin: 'Please contact your administrator or reach out to Badsender to enable this feature.',
    contactBadsender: 'Contact Badsender',
  },
  integrations: {
    // Keyed by the server error code, so a failed save can say what to fix
    // instead of showing the raw code.
    errors: {
      INTEGRATION_NAME_ALREADY_EXIST:
        'An integration of this company already has this name. Pick another one.',
      INTEGRATION_NOT_FOUND:
        'This integration no longer exists: it may have been deleted. Reload the page.',
      FORBIDDEN_INTEGRATION_ACCESS: 'You do not have access to this integration.',
      INTEGRATION_HOST_NOT_PUBLIC:
        'This address is private or local. For security reasons LePatron only calls public addresses: an AI hosted on your internal network cannot be reached from the server.',
      INTEGRATION_HOST_UNREACHABLE:
        'This domain name cannot be found. Check the spelling of the URL.',
      INTEGRATION_HOST_INVALID:
        'This URL is not valid. Expected a full address, e.g. https://example.com',
      INTEGRATION_HOST_HTTPS_REQUIRED:
        'This address must start with https://: the integration sends a key there, which would travel in clear over http.',
      INTEGRATION_API_KEY_REQUIRED:
        'The API address changed: enter the API key again.',
      INVALID_PRODUCT_ID: 'The Product ID contains digits only.',
      INTEGRATION_CONFIG_INVALID:
        'One of the integration settings is not valid for this provider.',
    },
    apiKeyRequiredOnHostChange:
      'The API address changed: enter the key again to confirm it should be sent there.',
    title: 'Integrations',
    name: 'Name',
    provider: 'Provider',
    status: 'Status',
    active: 'Active',
    apiKey: 'API Key',
    apiHost: 'API URL (optional)',
    apiKeyHintEdit: 'Leave empty to keep the current key',
    productId: 'Product ID',
    add: 'Add integration',
    edit: 'Edit integration',
    created: 'Integration created successfully',
    updated: 'Integration updated successfully',
    deleted: 'Integration deleted successfully',
    validate: 'Test connection',
    validationSuccess: 'Connection validated successfully',
    validationFailed: 'Credential validation failed',
    noIntegrations: 'No integrations configured',
    deleteConfirmTitle: 'Delete integration',
    deleteConfirmMessage: 'Are you sure you want to delete the integration "{name}"?',
    deleteWarningDashboards: 'Warning: {count} associated dashboard(s) will also be deleted.',
    categories: {
      bi: 'BI & Analytics',
      aiGeneration: 'AI - Generation',
      aiTranslation: 'AI - Translation',
      contentFeed: 'Content Feed',
    },
    statusLabels: {
      valid: 'Valid',
      invalid: 'Invalid',
      pending: 'Pending'
    },
    metabase: {
      apiKeyPlaceholder: 'Your Metabase API key',
      apiKeyLabel: 'Metabase Secret Key',
      apiHostHint: 'URL of your Metabase instance (e.g. https://metabase.example.com)'
    },
    openai: {
      apiKeyPlaceholder: 'sk-...',
      apiHostHint: 'Leave empty to use the official OpenAI API'
    },
    mistral: {
      apiKeyPlaceholder: 'Your Mistral API key',
      apiHostHint: 'Leave empty to use the official Mistral API'
    },
    infomaniak: {
      apiKeyPlaceholder: 'Your Infomaniak API key',
      productId: 'Product ID',
      productIdHint: 'Find your Product ID in the Infomaniak console > AI Tools',
      productIdInvalid: 'The Product ID contains digits only'
    },
    anthropic: {
      apiKeyPlaceholder: 'Your Anthropic API key',
      apiHostHint: 'Leave empty for the public Anthropic API; set it only if you go through a corporate gateway.'
    },
    gemini: {
      apiKeyPlaceholder: 'Your Google AI Studio API key',
      apiHostHint: 'Leave empty for the public Gemini API.'
    },
    azureOpenai: {
      apiKeyPlaceholder: 'Your Azure OpenAI API key',
      apiHostHint: 'Your Azure resource URL, e.g. https://my-instance.openai.azure.com. The deployment name stands in for the model.',
      reasoningModel: 'The deployment runs a reasoning model (gpt-5, o-series)',
      reasoningModelHint: 'Tick it if the deployment runs gpt-5, o1, o3 or o4: these models refuse temperature and max_tokens, and the deployment name gives no way to tell. It applies to every deployment used with this integration: if one of them is a reasoning model, tick it — the others keep working, they only lose the temperature setting.'
    },
    openaiCompatible: {
      apiKeyPlaceholder: 'Your endpoint API key',
      apiHostHint: 'Any endpoint speaking the OpenAI API. Private and loopback addresses are refused for security reasons.',
      supportsJsonMode: 'The endpoint supports JSON mode (response_format)',
      supportsJsonModeHint: 'Tick it only if the endpoint guarantees a valid JSON answer: skills then rely on it. Otherwise the answer is repaired afterwards.'
    },
    scaleway: {
      apiKeyPlaceholder: 'Your Scaleway API key',
      apiHostHint: 'Leave empty unless your account requires a project-scoped URL.'
    },
    ovh: {
      apiKeyPlaceholder: 'Your OVHcloud API key',
      apiHostHint: 'Leave empty for the public OVHcloud AI Endpoints.'
    },
    deepl: {
      apiKeyPlaceholder: 'Your DeepL API key',
      apiKeyHint: 'Your DeepL API key (Free or Pro)'
    },
    rss: {
      apiHostHint: 'Public RSS or Atom feed URL'
    },
    models: {
      fastEconomical: 'fast, economical',
      balanced: 'balanced',
      powerful: 'powerful',
      fast: 'fast',
      recommended: 'recommended',
    }
  },
  emailBuilderSettings: {
    title: 'Email Builder settings',
    sidebarLabel: 'Settings',
    metadata: {
      sectionTitle: 'Email metadata',
      sectionDescription:
        'Lets your team set a subject, a planned send date and an email type on each email, instead of retyping them on every send.',
      enabled: 'Enable email metadata',
      enabledHint:
        'While the option is off, these fields appear nowhere and the API refuses them; data already entered is kept.',
      taxonomyAction: 'Manage email types',
      taxonomyHint:
        'Email types are configured under Settings → General → Email types, independently of this option.',
    },
    snackbars: {
      invalid: 'The settings sent were not accepted.',
      updated: 'Email Builder settings updated',
      error: 'Could not update the settings',
    },
  },
  taxonomy: {
    active: 'Active',
    inactive: 'Inactive',
    title: 'Email types',
    sidebarLabel: 'Email types',
    description:
      'Your email types, in your own words. The definition you give is what matters: it is the reference for your team, and the context for the AI. The six Badsender types are your starting point: rename them, narrow them, deactivate the ones you do not use.',
    table: {
      label: 'Label',
      description: 'Definition',
      canonicalType: 'AI mapping',
      order: 'Order',
      isActive: 'Status',
    },
    canonicalTypes: {
      editorial: 'Editorial',
      promotional: 'Promotional',
      service: 'Service',
      notification: 'Notification',
      transactional: 'Transactional',
      institutional: 'Institutional',
    },
    form: {
      createTitle: 'New email type',
      editTitle: 'Edit email type',
      label: 'Label',
      labelPlaceholder: 'Weekly newsletter',
      labelHint: 'The name your team actually uses.',
      labelRequired: 'A label is required',
      labelTooLong: 'The label cannot exceed {max} characters',
      description: 'Definition',
      descriptionPlaceholder:
        'Thursday morning send to the whole base: news and new products.',
      descriptionHint:
        'What this email type is for in your company, and when to use it. This text is what will guide the AI.',
      descriptionTooLong: 'The definition cannot exceed {max} characters',
      canonicalType: 'Matching AI email type',
      canonicalTypePlaceholder: 'None',
      canonicalTypeHint:
        'Optional. Bridges onto the AI vocabulary, so the right expertise loads whatever name you chose.',
      order: 'Order',
      orderHint: 'Display order in the lists.',
      status: 'Status',
      isActive: 'Active',
      isActiveHint:
        'A deactivated email type disappears from the pickers, but emails already using it keep it.',
    },
    deleteConfirmTitle: 'Delete this email type?',
    deleteConfirmMessage: 'The email type "{label}" will be deleted.',
    deleteConfirmHint:
      'If emails use it, the deletion will be refused — deactivate it instead.',
    loadError: {
      title: 'Could not load your email types',
      description:
        'The list could not be read. Nothing has been lost — try again.',
      action: 'Retry',
    },
    empty: {
      action: 'Create an email type',
      title: 'No email type yet',
      description:
        'Create the email types your team needs: the label and the definition are yours.',
    },
    errors: {
      limitReached: 'You have reached the maximum number of email types for this company.',
      labelAlreadyExists: 'An email type already uses this label.',
      inUse:
        'This email type is used by {count} email: deactivate it instead of deleting it. | This email type is used by {count} emails: deactivate it instead of deleting it.',
    },
    defaults: {
      action: 'Default email types',
      confirmTitle: 'Add the missing Badsender email types',
      confirmIntro:
        'The following email types will be created. You can then rename them, refine their definition, or deactivate them.',
      confirmNothing:
        'Your email types already cover the six Badsender types: there is nothing to add.',
      confirmSkipped:
        'Not created, one of your email types already uses their label: {labels}.',
      snackbarCreated: '{count} email type created | {count} email types created',
      snackbarNone: 'No email type to add',
    },
    snackbars: {
      created: 'Email type created',
      updated: 'Email type updated',
      deleted: 'Email type deleted',
    },
  },
  feedMappings: {
    title: 'Content Feeds',
    template: 'Template',
    block: 'Block',
    integration: 'Feed source',
    active: 'Active',
    add: 'Add feed mapping',
    edit: 'Edit feed mapping',
    created: 'Feed mapping created successfully',
    updated: 'Feed mapping updated successfully',
    deleted: 'Feed mapping deleted successfully',
    noFeedMappings: 'No content feed configured',
    loadingBlocks: 'Loading blocks...',
    noBlockFields: 'No mappable field was found for this block. Feed items cannot be mapped onto it — pick another block.',
    columnCount: 'Number of columns',
    columnCountHint: 'For multi-column blocks (e.g. a 3-across article block) — one field mapping per column',
    column: 'Column {n}',
    ctaDefaultLabel: 'Default CTA button label',
    ctaDefaultLabelHint: 'Applied when an item is inserted — editable afterwards in the builder',
    deleteConfirmTitle: 'Delete feed mapping',
    deleteConfirmMessage: 'Are you sure you want to delete this feed mapping?',
    fieldColumnHeader: 'Block field',
    roleColumnHeader: 'Comes from',
    roleNone: '— Ignore —',
    feedFields: {
      title: 'item title (title)',
      link: 'item link (link)',
      description: 'item description (description)',
      image: 'item image (image)',
      pubDate: 'item publication date (pubDate)',
      ctaLabel: 'default CTA label (static text)',
    },
  },
  superAdmins: {
    pageTitle: 'Super admins',
    add: 'Add a super admin',
    addDescription:
      'The account is created in the platform company. Then send it the password email from its row, as for any new account.',
    promote: 'Promote a member',
    promoteAction: 'Promote',
    promoteDescription:
      'Pick a member of the platform company: they become a super admin and keep their account. Like every super admin, they will have every right on every company, and work in Email Builder and CRM Intelligence on the company they select.',
    promoted: 'Super admin promoted',
    member: 'Member',
    noMember: 'No member of the platform company to promote.',
    noPlatformGroup:
      'No platform company is set up on this environment: no super admin can be created.',
    demote: {
      title: 'Revoke the super admin role',
      action: 'Revoke the role',
      notice:
        'This account will no longer be a super admin. Are you sure you want to revoke the role of',
    },
    loadError: 'The super admins could not be loaded. Reload the page.',
    errors: {
      FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE:
        'Only a super admin can grant or revoke this role.',
      FORBIDDEN_ROLE_GRANT:
        'You cannot give a role that has more rights than yours.',
      FORBIDDEN_USER_MANAGEMENT:
        'You cannot manage an account that has more rights than yours.',
      FORBIDDEN_SUPER_ADMIN_MANAGEMENT:
        'Only a super admin can manage a super admin.',
      FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION:
        'You cannot revoke your own super admin role.',
      FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION:
        'You cannot deactivate your own account.',
      SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP:
        'A super admin must belong to the platform company.',
      PLATFORM_GROUP_NOT_FOUND:
        'No platform company is set up on this environment.',
      PLATFORM_GROUP_HAS_SUPER_ADMINS:
        'This company hosts active super admins. To move it, set another company as the platform company with the configuration administrator: they will follow it. To unset it, that account must first deactivate or demote them.',
      INVALID_ROLE_PARAM: 'This role does not exist.',
    },
  },
  settingsNav: {
    categories: {
      superAdmin: 'Super Admin',
      general: 'General',
      emailBuilder: 'Email Builder',
      crmIntelligence: 'CRM Intelligence',
    },
    companiesList: 'Companies list',
    companiesEmpty: 'No companies yet',
    superAdminOnly: 'Super admin only',
    switchCompany: 'Pick a company…',
    selectedGroup: 'Selected company: {name}',
    selectionFailed: 'This company could not be selected. Try again.',
    colors: 'Colors',
  },
  aiFeatures: {
    title: 'AI Features',
    selectIntegration: 'Integration to use',
    noIntegration: '-- No integration --',
    noIntegrationsWarning: 'No AI integration configured. First add an integration in the Integrations tab.',
    integrationInactiveWarning: 'The selected integration is inactive. Activate it to use this feature.',
    comingSoon: 'Coming soon',
    upcomingFeatures: 'Upcoming features',
    upcomingFeaturesDescription: 'Discover the upcoming AI features currently in development.',
    translation: {
      title: 'Translation',
      description: 'Automatically translate your emails into different languages using AI.',
      enableLabel: 'Enable translation',
      on: 'On',
      off: 'Off',
      model: 'AI Model',
      modelHint: 'More powerful models are more accurate but slower and more expensive',
      availableLanguages: 'Available languages',
      languagesHint: 'Select at least 2 languages (source and target)',
      languagesSelected: '{count} language selected | {count} languages selected',
      minLanguagesError: 'Select at least 2 languages (one source and one target)',
      formality: 'Formality level',
      formalityHint: 'Applied to target languages that distinguish formal and informal address. Other languages keep a neutral tone.',
      formalityDefault: 'Default',
      formalityMore: 'Formal',
      formalityLess: 'Informal'
    },
    skill: {
      title: 'Skills engine',
      description: 'The model that runs the skills in LePatron (editor, Playground). A connected assistant uses its own model.',
      enableLabel: 'Enable the Skills engine',
      on: 'On',
      off: 'Off',
      model: 'AI model',
      modelHint: 'More powerful models are more accurate but slower and more expensive',
    },
    model: {
      defaultOption: 'Provider default ({model})',
      defaultOptionUnknown: 'Provider default',
      requiredPlaceholder: 'Type or pick a model',
      required: 'This provider has no default model: pick one, or every call will fail.',
      deprecated: 'deprecated',
      invalidId: 'Not saved — model identifiers accept letters, digits and . _ - : / @ only, no spaces.',
      customHint: 'Hand-typed model: it has not been checked against the provider.',
      loadFailed: 'Model list unavailable: only known models are offered. You can type an identifier.',
    },
    textGeneration: {
      title: 'Text generation',
      description: 'Generate personalized marketing content for your emails.'
    },
    qualityCheck: {
      title: 'Quality check',
      description: 'Automatically check the quality and consistency of your emails.'
    }
  },
  colors: {
    palette: 'Color palette',
    paletteDescription: 'These colors will be available in the email editor color picker for all users in this company.',
    addColor: 'Add',
    removeColor: 'Remove this color',
    hint: '{count}/21 colors • Click on a color to edit it',
  },
  templates: {
    noTemplates: 'No templates yet',
    deleteConfirmTitle: 'Delete template?',
    deleteWarningMessage: 'Are you sure you want to delete the template <strong>{name}</strong>? This action cannot be undone.',
    confirmationField: 'Type the template name to confirm',
    newTemplate: 'New template',
    generalInfo: 'General information',
    generalInfoDescription: 'Template name and description',
    templateFiles: 'Template files',
    templateFilesDescription: 'Upload the HTML markup and associated images',
    markup: 'Markup (HTML file)',
    markupUploaded: 'Markup uploaded',
    dropMarkupHere: 'Drop file here or click to select',
    markupFormats: 'Accepted format: .html',
    invalidMarkupFormat: 'Invalid format. Please upload an HTML file.',
    dropImagesHere: 'Drop images here or click to select',
    imageFormats: 'Accepted formats: PNG, JPG, GIF, WEBP',
    existingImages: '{count} uploaded images',
    newImages: '{count} new images to upload',
    removeAllImages: 'Remove all',
    imagesRemoved: 'Images removed successfully',
    previewDescription: 'Preview of the rendered template',
    regeneratePreview: 'Regenerate preview',
    filesAvailableAfterCreation: 'You can upload the HTML markup and images after creating the template.',
    advancedOptions: 'Advanced options',
    advancedOptionsDescription: 'Features you can enable on a per-template basis',
    htmlBlock: {
      name: 'HTML code block',
      description: 'Allows pasting free HTML code between two template blocks.',
      hint: 'The block will show up at the end of the editor palette.',
    },
    blockBuilder: {
      name: 'Block builder',
      description:
        'Lets users compose a block visually. LePatron writes the HTML.',
      hint: 'The block will show up at the end of the editor palette.',
    },
  },
  skillsImport: {
    open: 'Import',
    title: 'Import skills and expertises',
    file: 'Skills export (.json)',
    fileHint: 'A file exported from another LePatron instance, 5 MB at most.',
    preview: 'See the preview',
    reading: 'Reading the file…',
    from: 'Exported from {origin} by {by}, on {date}.',
    counter: '{count} item to import | {count} items to import',
    nothing: 'Nothing to import: everything is up to date or blocked.',
    otherFile: 'Choose another file',
    current: 'here: {version}',
    notJson: 'This file is not JSON.',
    tooLarge: 'This file is over 5 MB.',
    unreadable: 'This file is not a readable skills export: {message}',
    kinds: {
      expertise: 'Expertise',
      skill: 'Skill',
    },
    states: {
      new: 'New',
      update: 'Update',
      up_to_date: 'Up to date',
      blocked: 'Blocked',
    },
    reasons: {
      diverged: 'Same version, different content: the two instances diverged.',
      target_newer: 'A newer version exists here.',
      draft_open: 'A draft is open here: publish or delete it first.',
      archived: 'Archived here.',
      missing_schema: 'Its schema does not exist on this instance: it is not up to date.',
    },
    warnings: {
      missing_expertises: 'Expertises missing here and from the file: {ids}',
    },
  },
  aiSkills: {
    export: {
      all: 'Export all',
      selection: 'Export the selection',
      selected: '{count} item selected | {count} items selected',
      consumed: 'With the expertises these skills consume:',
      remove: 'Remove {id} from the export',
      done: 'Export downloaded.',
      failed: 'The export failed.',
    },
    feedback: {
      tab: 'Feedback',
      caption:
        'Feedback sent from connected AI assistants, with the version read and, when the company and the user agreed, the summary of the session.',
      empty: 'No feedback yet.',
      up: 'Positive feedback',
      down: 'Negative feedback',
      noComment: 'No comment',
      shown: '{shown} of {total}',
      more: 'Show more',
      retex: 'Session summary',
    },
    nature: 'Nature',
    natureHint:
      'A feature skill is called by LePatron (template, schemas, output contract). A task skill is a procedure an AI assistant follows. The skill has the nature of its published version: to change it, publish a version of the other nature.',
    natures: {
      feature: 'Feature skill',
      task: 'Task skill',
    },
    servedToAssistants: 'Offered to AI assistants',
    servedToAssistantsHint:
      'Served through MCP to connected assistants, without its output contract. Leave unchecked for a skill whose input the editor builds.',
    audience: 'Audience',
    audienceHint:
      'Who may use it. A new one stays with the platform company while it is proven: then open it to all companies.',
    audiences: {
      expertise: {
        platform: 'Platform company only (testing)',
        all:
          'All companies: in the editor, and in their assistant if they have MCP access',
      },
      featureSkill: {
        platform:
          'Platform company only (testing): the button is hidden for clients',
        all:
          'All companies: in the editor, and in their assistant if the box is checked and they have MCP access',
      },
      taskSkill: {
        platform: 'Platform company only (testing)',
        all: 'All companies that have MCP access',
      },
    },
    platformOnly: 'Platform company only',
    warningUnchecked: 'The warning about this change could not be checked.',
    savedWarningUnchecked:
      'Saved, but the warning about this change could not be checked.',
    openExpertises: {
      skillTitle: 'Open this skill to all companies',
      intro:
        'This skill consumes expertises kept to the platform company: the assistants of the other companies will follow it without them.',
      openToo: 'Open it to all companies too',
      openTooNamed: 'Open it to all companies too: {title}',
      appliesAtOnce:
        'Opening an expertise also applies it, at once, to the editor features of every company. With none checked, the skill opens without them.',
    },
    closeExpertise: {
      title: 'Keep this expertise to the platform company',
      intro:
        'These task skills, open to all companies, consume it: they will no longer receive it at the clients.',
    },
    pageTitle: 'Skills & Expertise',
    tabs: {
      skills: 'Skills',
      expertise: 'Expertise',
      invocations: 'Invocations',
      details: 'Details',
      versions: 'Versions',
    },
    actions: {
      archive: 'Archive',
    },
    filters: {
      category: 'Category',
      status: 'Status',
      skillId: 'Skill ID',
      feature: 'Feature',
      groupId: 'Company ID',
      includeNonProductive: 'Include tests (playground, poc.*)',
    },
    categories: {
      redaction: 'Copywriting',
      qc: 'QC',
      design: 'Design',
      html_integration: 'HTML integration',
      deliverability: 'Deliverability',
      translation: 'Translation',
      other: 'Other',
    },
    errors: {
      EXPERTISE_LIST_FILTER_INVALID:
        'The "{filter}" filter of the expertise list is not valid.',
      SKILL_CONSUMED_EXPERTISES_INVALID:
        'The expertises consumed must be a list of expertise ids.',
      SKILL_CONSUMED_EXPERTISES_TOO_MANY:
        'A version consumes {max} expertises at most.',
      SKILL_CONSUMED_EXPERTISES_DUPLICATED:
        'These expertises are consumed more than once: {expertiseIds}. Keep each of them once.',
      SKILL_CONSUMED_EXPERTISES_NOT_FOUND:
        'These expertises consumed do not exist: {expertiseIds}. Remove them from the version.',
      SKILL_OPEN_EXPERTISES_INVALID:
        'Only the published expertises this version consumes that are kept to the platform company open with the skill, and only when the skill opens to all companies.',
      SKILL_NOT_AVAILABLE_TO_COMPANY:
        'This feature is not available to your company yet.',
      SKILL_PROCEDURE_REQUIRED_TO_PUBLISH:
        'A task skill\'s procedure must be written before publishing this version.',
      SKILL_SCHEMAS_REQUIRED_TO_PUBLISH:
        'The input and output schemas must be set before publishing this version.',
      SKILL_TEMPLATE_UNKNOWN_FIELDS:
        'The template references fields absent from input schema "{schemaId}": {fields}. Fix the template or change the version input schema.',
      SKILL_VERSION_CHANGED:
        'This draft was changed meanwhile, by an assistant for instance. Reload it to see the new version before saving or publishing.',
    },
    warnings: {
      TEMPLATE_UNKNOWN_FIELDS:
        'The template references fields absent from input schema "{schemaId}": {fields}. They will interpolate empty at runtime — publication will be blocked.',
      TEMPLATE_MISSING_REQUIRED:
        'Required field(s) of schema "{schemaId}" not referenced in the template: {fields}.',
      TEMPLATE_MISSING_EXPERTISE:
        'The schema accepts expertises but the template does not insert them: they would be ignored at invocation.',
      CONSUMED_EXPERTISES_NOT_PUBLISHED:
        'These expertises consumed are not published: {expertiseIds}. The assistant does not receive them until they are.',
      CONSUMED_EXPERTISES_PLATFORM_ONLY:
        'These expertises consumed are kept to the platform company: {expertiseIds}. The assistants of the other companies follow this skill without them.',
      OPEN_EXPERTISES_FAILED:
        'The skill is saved, but these expertises could not be opened to all companies: {expertiseIds}. Open them from their details.',
    },
    emailTypes: {
      editorial: 'Editorial',
      promotional: 'Promotional',
      service: 'Service',
      notification: 'Notification',
      transactional: 'Transactional',
      institutional: 'Institutional',
    },
    statuses: {
      DRAFT: 'Draft',
      ACTIVE: 'Active',
      ARCHIVED: 'Archived',
      PUBLISHED: 'Published',
      SUCCESS: 'Success',
      VALIDATION_ERROR: 'Validation error',
      PROVIDER_ERROR: 'Provider error',
      TIMEOUT: 'Timeout',
      CANCELLED: 'Cancelled',
      CONFIG_ERROR: 'Config error',
    },
    skill: {
      intro: 'Versioned, governed AI prompts. Each skill is a reusable function that LePatron features can invoke (CTA copywriting, subject-line QC, block translation, etc.).',
      id: 'ID',
      idHint: 'Slug, dot-hierarchical — e.g. redaction.cta',
      idResetHint: 'Recompute identifier from Category and Title',
      technicalId: 'Technical identifier',
      inputSchemaId: 'Input schema',
      outputSchemaId: 'Output schema',
      schemasOnVersionNote:
        'Input/output schemas are chosen at the version level (Versions tab), like the prompts.',
      activeVersion: 'Active version',
      noActiveVersion: 'No active version',
      addSkill: 'Add skill',
      newSkill: 'New skill',
      noSkills: 'No skill yet',
      created: 'Skill created',
      archiveTitle: 'Archive this skill?',
      archiveBody: 'The skill will no longer be invokable. This action is reversible.',
      archived: 'Skill archived',
      testInPlayground: 'Test in the playground',
    },
    expertise: {
      intro: 'Badsender know-how documented in structured Markdown. Expertise modules are consumed as input by skills to provide business context (copywriting principles, design rules, deliverability guidance, etc.).',
      id: 'ID',
      idHint: 'Slug — e.g. redaction.cta.principles',
      idResetHint: 'Recompute identifier from Category, Scope and Title',
      scope: 'Scope',
      scopeHint: 'e.g. cta, subject, …',
      transversal: 'Transversal expertise',
      transversalHint:
        'Loaded by features whatever the requested scope (e.g. a brand voice). Still filtered by category, email type and language. Check deliberately — an expertise with no scope and not transversal is loaded nowhere.',
      transversalChip: 'Transversal',
      noScopeTooltip:
        'No scope: this expertise is loaded by no feature in filtered mode',
      impactTitle: 'Activation impact',
      impactLoadedBy: 'This expertise will be loaded by:',
      impactNone:
        'No declared feature currently loads this scope. The expertise stays usable by explicit selection (playground).',
      appliesToEmailTypes: 'Applies to email types',
      appliesToLanguages: 'Languages (empty = all)',
      technicalId: 'Technical identifier',
      createScope: 'Create scope "{value}"',
      categoryHelp:
        'Classifies the expertise by broad family. The category will also, eventually, determine which AI engine is used for this kind of feature.',
      scopeHelp:
        'Loading key: features fetch expertise by scope before calling the AI (e.g. CTA generation loads the "cta" scope).',
      emailTypeHelp:
        'Restricts the expertise to some email types (e.g. "promo"). Empty = all types.',
      languageHelp:
        'Languages of the content this know-how applies to — e.g. a French risky-words list only applies to FR content. Empty = all.',
      descriptionHelp:
        'Shown in the selectors (playground and features) to help pick the right expertise.',
      goodExamples: 'Good examples',
      badExamples: 'Bad examples',
      bodyLabel: 'Markdown body — use ## [section-id] Title',
      sectionIdHelp:
        '[section-id] sections structure the doctrine into identifiable bricks: they are listed in the Sections tab and will eventually allow targeted per-client overrides (design system). If several expertises cover the same concept, reuse the same section identifier (e.g. [length] for any length rule).',
      addExpertise: 'Add expertise',
      newExpertise: 'New expertise',
      noExpertise: 'No expertise yet',
      created: 'Expertise created',
      archiveTitle: 'Archive this expertise?',
      archiveBody: 'Skills referencing this expertise keep their existing context until a replacement is created. The action is reversible.',
      archived: 'Expertise archived',
      sectionsTab: 'Sections',
      sectionsCaption: 'Sections parsed from the active version body.',
      noSections: 'No sections detected.',
    },
    invocation: {
      intro: 'Observable log of every skill call. Monitor latency, token cost, validation or provider errors, and drill into the details of each execution.',
      when: 'When',
      version: 'Version',
      feature: 'Feature',
      latency: 'Latency',
      tokens: 'Tokens',
      group: 'Company',
      providerModel: 'Provider / Model',
      noInvocations: 'No invocation visible',
      noInvocationsHint: 'Test invocations are hidden by default — enable "Include tests" to show them.',
      dateFrom: 'From',
      dateTo: 'To',
      detailInput: 'Input',
      detailOutput: 'Output',
      detailResolvedConfig: 'Resolved config',
    },
    version: {
      reload: 'Reload',
      procedure: 'Procedure',
      procedureHint: 'What the assistant does, step by step, in Markdown.',
      consumedExpertises: 'Expertises consumed',
      consumedExpertisesHint:
        'In the order the assistant reads them. Their active version is attached to the skill.',
      consumedExpertisesEmpty: 'No expertise consumed.',
      consumedExpertisesAdd: 'Add an expertise',
      consumedExpertisesSearch: 'Search a published expertise by title or id',
      consumedExpertisesNoResult: 'No published expertise found.',
      consumedExpertisesSearchError: 'The search failed. Type again to retry.',
      consumedExpertisesMax: 'A version consumes {max} expertises at most.',
      consumedExpertisesLoadError: 'The expertises could not be loaded.',
      consumedExpertisesRetry: 'Retry',
      consumedExpertiseNotFound: 'Not found',
      consumedExpertiseNotFoundHint:
        'No expertise has this id: the assistant does not receive it. Remove it.',
      consumedExpertiseNotPublished: 'Not published',
      consumedExpertiseNotPublishedHint:
        'A draft, or archived: the assistant does not receive it until a version of it is published. Publish it, or remove it.',
      consumedExpertisePlatformOnlyHint:
        'Only the platform company\'s assistants receive it: open it to all companies for their assistants to receive it too.',
      consumedExpertiseUp: 'Move up',
      consumedExpertiseDown: 'Move down',
      consumedExpertiseRemove: 'Remove',
      systemPrompt: 'System prompt',
      skillBody: 'Skill body',
      inputTemplate: 'Input template (uses {input.*} placeholders)',
      newVersion: 'New version (draft)',
      newVersionShort: 'New version',
      versionCreated: 'Version created',
      draftSaved: 'Draft saved',
      unsavedChanges: 'Unsaved changes',
      activate: 'Activate',
      activateTitle: 'Activate this version',
      activateBody: 'Activating a version makes it immutable. Changelog and release notes are required.',
      platformOnlyReminder:
        'This item stays visible to the platform company only.',
      openToAll: 'Open it to all companies',
      openToAllNotice:
        'This item opens to all companies as soon as it is published.',
      activateBodyMinor: 'Activating this minor version makes it immutable and immediately changes the doctrine features consume. Changelog and notes are pre-filled from the draft (optional for a minor).',
      changelog: 'Changelog',
      changelogPlaceholder:
        'What changes vs the previous version — e.g. "Added the urgency rule, reworded the length criterion"',
      releaseNotes: 'Release notes',
      releaseNotesPlaceholder:
        'What to know about this version — e.g. "Tested on FR promo emails only; exceptions section to validate in the field"',
      outputFormatNote:
        'The JSON output format is added automatically from the output schema — do not write it.',
      schemasHelp:
        'Technical contract of the version: the input validates what features send and generates the playground form; the output is imposed on the LLM automatically. Schemas are defined in code — contact the dev team to add one.',
      placeholdersHelp:
        'Placeholders usable in the input template only — they are rejected in the system prompt and in the skill body. Derived from the input schema:',
      placeholdersRequiredHint:
        'Placeholders marked with an asterisk (*) map to fields required by the input schema.',
      placeholderCopyHint: 'Click to copy this placeholder',
      placeholderCopyFailed:
        'Copy is unavailable in this browser — select the placeholder text by hand.',
      placeholdersInvocationNote:
        'These fields are provided at invocation — only those referenced in the input template are sent to the LLM.',
      placeholdersExpertiseNote:
        '{token} carries the selected expertises: without it, they will not be seen by the model.',
      activated: 'Version activated',
      saveDraft: 'Save draft',
      duplicate: 'Duplicate',
      duplicateHint: 'Duplicate as a new major version',
      saveChanges: 'Save changes',
      newMinor: 'New minor version',
      newMinorHint: 'Quick fix, no doctrine change.',
      newMajor: 'New major version',
      newMajorHint: 'Rewrite or doctrine change.',
      deleteDraft: 'Delete draft',
      deleteDraftConfirm: 'Permanently delete this draft?',
      publish: 'Publish',
      publishMinorConfirm: 'Publish this minor version?',
      publishMinorBody: 'It will replace the currently active version.',
      readOnly: 'Read only',
      readOnlyHint: 'This version is published. To modify it, create a new minor or major version.',
    },
    logs: {
      tabLabel: 'Logs',
      hideTest: 'Hide test invocations',
      empty: 'No invocation for this skill.',
    },
  },
  aiPlayground: {
    pageTitle: 'AI Playground',
    intro: 'Compose, run and store test scenarios that combine a skill, expertise modules and parameters. Use it to iterate on a prompt, validate an update, or prototype a feature before writing it.',
    actions: {
      newScenario: 'New scenario',
      delete: 'Delete',
      execute: 'Run',
      markGolden: 'Mark as reference',
      unmarkGolden: 'Remove reference',
      compare: 'Compare with reference',
    },
    list: {
      empty: 'Create a scenario to test a skill with your expertise modules. No technical knowledge required.',
    },
    filters: {
      skill: 'Skill',
      tag: 'Tag',
      search: 'Search',
    },
    headers: {
      name: 'Name',
      skill: 'Skill',
      status: 'Status',
      golden: 'Reference',
      goldenTooltip:
        'A reference run is set — new runs can be compared against it',
      when: 'When',
      latency: 'Latency',
      tokens: 'Tokens',
      feedback: 'Feedback',
      lastRun: 'Last run',
      lastRunStatus: 'Status',
      runs: 'Runs',
    },
    form: {
      scenarioId: 'Identifier',
      scenarioIdHint: 'Unique slug — e.g. validation.cta.promo',
      name: 'Name',
      description: 'Description',
      tags: 'Tags',
      skillSection: 'Skill to invoke',
      skillSelector: 'Target skill',
      versionMode: 'Version',
      versionModeActive: 'Follow active',
      versionModePinned: 'Pinned version',
      versionPicker: 'Exact version',
      expertiseSection: 'Expertise modules',
      expertiseMode: 'Mode',
      expertiseModeNone: 'None',
      expertiseModeExplicit: 'Explicit selection',
      expertiseModeFilter: 'Dynamic filter',
      expertiseNoneWarning: 'No expertise will be injected. Make sure the skill is designed to run without expertise input.',
      expertiseSelector: 'Selected expertise',
      expertiseRecommended: 'Recommended for this skill',
      expertiseAll: 'All expertise modules',
      expertiseNotSupported:
        'This skill does not accept expertise input: the selection below is kept but will not be injected.',
      filterCategories: 'Categories',
      filterScope: 'Scope',
      filterScopeHint:
        'Query criterion: expertise whose scope matches will be loaded (e.g. "cta"). Required.',
      filterEmailType: 'Email type',
      filterEmailTypeHint:
        'Keeps only expertise applicable to this email type. Empty = all.',
      filterLanguage: 'Language',
      filterLanguageHint:
        'Keeps only expertise applicable to this language. Empty = all.',
      filterSelectScope: 'Select a scope to preview.',
      filterSelectCategory: 'Select at least one category to preview.',
      filterPreviewCount: '{count} expertise(s) match this filter.',
      filterPreviewPending: 'Counting…',
      expertiseModeHelp:
        'None: the skill is invoked without expertise. Explicit selection: you choose the expertises and their order — recommended for reproducible tests. Dynamic filter: expertises are loaded automatically from the criteria below (category, scope, email type, language). This is the mechanism production features use — it is what lets you enrich the doctrine without a redeploy.',
      filterOrderHint:
        'Load order: transversal expertises first, then alphabetical by identifier. For a custom order, use explicit selection.',
      expertiseOrderHint:
        'The order is the order of appearance in the prompt — place general expertises before specific ones.',
      inputSection: 'Request content',
      inputHint: 'Fill in what the skill should work on. Fields marked * are required.',
      inputInvalid: 'Invalid JSON',
      scenarioIdToggle: 'Technical identifier',
    },
    input: {
      modeForm: 'Form',
      modeJson: 'Advanced mode (JSON)',
      unknownTypeFallback: 'This skill uses an advanced input format — JSON editing required.',
      templateHelp: 'Template derived from the input schema:',
      insertTemplate: 'Insert template',
      manualExpertiseKey:
        'The "expertise" field is injected automatically from the selection above: your value is overwritten as soon as one expertise resolves.',
      unknownKeysWarning: 'Some fields do not match the skill\'s schema (kept, but rejected at run time): {keys}',
      expertiseInjected: 'The expertise selected above is added to the request automatically — nothing to type here.',
      skillChangeConfirmTitle: 'Change skill?',
      skillChangeConfirmBody: 'These fields are not used by the new skill: {fields}.',
      skillChangeKeepJson: 'Keep my input (JSON mode)',
      skillChangeProceed: 'Continue (drop listed fields)',
    },
    fieldLabels: {
      prompt: 'Instruction / request',
      context: 'Additional context',
      brief: 'Campaign brief',
      userInput: 'Additional instructions',
      subjectToEvaluate: 'Subject line to evaluate',
      emailContext: 'Email context',
    },
    fieldPlaceholders: {
      prompt: 'E.g.: Write a punchy CTA for a 20% off jackets promo…',
      context: 'E.g.: Young, casual brand voice, 25-35 audience…',
      brief: 'E.g.: Promote our new collection… Audience: … Offer: …',
    },
    validation: {
      required: 'The field "{field}" is required.',
      unrecognized: 'The field "{field}" is not expected by this skill. Switch to advanced mode to remove it, or check the selected skill.',
      length: 'The field "{field}" is too short or too long.',
      invalid: 'The field "{field}" has an invalid format.',
    },
    runs: {
      title: 'Run history',
      empty: 'No run yet on this scenario. Trigger one to start.',
      runOf: 'Run of {date}',
      executing: 'Running, may take up to 90 seconds…',
      budgetExhausted: 'Daily test budget reached (50/50). Try again tomorrow.',
      tabs: {
        input: 'Input',
        output: 'Output',
        raw: 'Output (JSON)',
        feedback: 'Feedback',
      },
      feedback: {
        rating: 'Rating',
        ratingPositive: 'Positive',
        ratingNeutral: 'Neutral',
        ratingNegative: 'Negative',
        score: 'Score (1 to 5)',
        comment: 'Comment',
        save: 'Save feedback',
        saved: 'Feedback saved',
      },
      compare: {
        title: 'Comparison against reference',
        golden: 'Reference',
        current: 'Selected run',
        noGolden: 'No reference set for this scenario.',
      },
      delete: 'Delete this run',
      deleted: 'Run deleted',
      deleteConfirm: 'Permanently delete this run?',
    },
    status: {
      SUCCESS: 'Success',
      VALIDATION_ERROR: 'Validation error',
      PROVIDER_ERROR: 'Provider error',
      TIMEOUT: 'Timeout',
      CANCELLED: 'Cancelled',
      CONFIG_ERROR: 'Config error',
    },
    deleteScenarioConfirm: 'Delete this scenario and all its runs?',
    created: 'Scenario created',
    updated: 'Scenario updated',
    deleted: 'Scenario deleted',
    goldenMarked: 'Reference updated',
    goldenUnmarked: 'Reference cleared',
  },
};
