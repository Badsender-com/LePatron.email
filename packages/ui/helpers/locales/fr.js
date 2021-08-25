export default {
  snackbars: {
    updated: 'Mis à jour',
    created: 'Crée',
    deleted: 'Supprimé',
    usersFetchError: 'Impossible d\'accéder à la liste des utilisateurs',
    emailSent: 'Un email a été envoyé',
  },
  global: {
    errors: {
      errorOccured: 'Une erreur est survenue',
      required: 'Ce champ est requis',
      userRequired: 'Un utilisateur est requis',
      nameRequired: 'Un nom est requis',
      entityRequired: 'L\'entité est requise',
      targetTableRequired: 'La table cible est requise',
      supportedLanguageIsRequired: 'La langue est requise',
      apiKeyInvalid: 'La clé API invalide',
      apiKeyRequired: 'La clé api est requise',
      senderNameRequired: 'Nom de l\'expéditeur est requis',
      senderMailRequired: 'Mail de l\'expéditeur est requis',
      WORKSPACE_ALREADY_EXISTS: 'Un workspace avec ce nom existe déjà',
      FORBIDDEN_WORKSPACE_CREATION:
        'Vous n\'avez pas les droits pour créer ce workspace',
      password: {
        error: {
          nouser: 'Utilisateur introuvable',
          incorrect: 'Identifiants incorrects',
        },
      },
      login: {
        error: {
          internal: 'Une erreur est survenue',
        },
      },
    },
    add: 'Ajouter',
    apiKey: 'Clé API',
    entity: 'Entité',
    encodingType: 'Type d\'encodage',
    targetTable: 'Table cible',
    supportedLanguage: 'La langue',
    profileName: 'Nom du profil ESP',
    addTags: 'Ajouter des labels',
    copyMail: 'Copier',
    copyMailAction: 'Créer une copie',
    moveFolderAction: 'Déplacer le dossier',
    moveMail: 'Déplacer',
    location: 'Destination',
    moveManyMail: 'Déplacer les emails',
    teams: 'Workspaces',
    newTemplate: 'Ajouter un template',
    newFolder: 'Ajouter un dossier',
    parentLocation: 'Emplacement du parent',
    template: 'Template | Templates',
    mailing: 'Email | Emails',
    newMailing: 'Ajouter un email',
    user: 'Utilisateur | Utilisateurs',
    newUser: 'Ajouter un utilisateur',
    newTeam: 'Ajouter un workspace',
    newProfile: 'Ajouter un profil ESP',
    editProfile: 'Éditer le profil ESP {name}',
    profile: 'ESP',
    newTag: 'Ajouter un tag',
    backToMails: 'Retour aux emails',
    backToGroups: 'Retour aux groupes',
    group: 'Groupe | Groupes',
    workspaces: 'Espaces de travail',
    newGroup: 'Ajouter un groupe',
    workspace: 'Workspace',
    newWorkspace: 'Ajouter un workspace',
    newMail: 'Nouvel email',
    image: 'Image | Images',
    actions: 'Actions',
    save: 'Enregistrer',
    settings: 'Réglages',
    cancel: 'Annuler',
    create: 'Créer',
    createTag: 'Créer un label',
    update: 'Mettre à jour',
    delete: 'Supprimer',
    reset: 'Réinitialiser',
    duplicate: 'Dupliquer',
    apply: 'Appliquer',
    confirm: 'Confirmer',
    close: 'Fermer',
    show: 'Visualiser',
    download: 'Télécharger',
    preview: 'Prévisualiser',
    previewMailAlt: 'Aperçu du template du mail',
    newPreview: 'Créer une prévisulisation',
    name: 'Nom',
    description: 'Description',
    author: 'Auteur',
    tags: 'Labels',
    password: 'Mot de passe',
    email: 'Email',
    enable: 'Activer',
    disable: 'Désactiver',
    enabled: 'Activé',
    disabled: 'Désactivé',
    status: 'Statut',
    createdAt: 'Créé le',
    updatedAt: 'Mis à jour le',
    edit: 'Modifier',
    move: 'Déplacer',
  },
  layout: {
    logout: 'Déconnexion',
  },
  forms: {
    group: {
      downloadWithoutEnclosingFolder: {
        label: 'Format du fichier zip',
        wrapped: 'Englober dans un dossier parent',
        unwrapped: 'Laisser les fichiers à la racine',
      },
      defaultWorkspace: {
        label: 'Nom du workspace par défaut',
      },
      status: {
        label: 'Statut',
        demo: 'Demo',
        inactive: 'Inactive',
        active: 'Active',
        requiredValidationMessage: 'Le statut est requis',
      },
      exportFtp: 'Exporter les images sur un FTP',
      exportCdn: 'Exporter les images sur un CDN',
      enable: 'Activer',
      ftpProtocol: 'Protocole FTP',
      host: 'Hôte',
      username: 'Identifiant',
      port: 'Port',
      path: 'Chemin du dossier',
      httpProtocol: 'Protocole HTTP',
      endpoint: 'Url racine des images',
      editorLabel: 'Libellé du bouton',
      entryPoint: 'Point d\'entrée',
      issuer: 'Issuer',
      userHasAccessToAllWorkspaces:
        'Les utilisateurs réguliers ont accès à tous les workspaces.',
    },
    template: {
      meta: 'Meta',
      files: 'Fichiers',
      markup: 'Markup',
    },
    user: {
      passwordConfirm: 'Confirmation du mot de passe',
      passwordReset: 'Réinitialisation du mot de passe',
      login: 'Connexion',
      adminLogin: 'Connexion Admin',
      sendLink: 'Envoyer le lien de réinitialisation',
      forgottenPassword: 'Mot de passe oublié ?',
      validate: 'Valider',
      errors: {
        password: {
          required: 'Un mot de passe est requis',
          confirm: 'Vous devez confirmer votre mot de passe',
          same: 'Vos mots de passe sont différents',
        },
        email: {
          required: 'Un email est requis',
          valid: 'Un email valide est requis',
        },
      },
    },
    workspace: {
      checkBoxError:
        'Je comprends que les emails et les dossiers contenus dans le workspace seront aussi supprimés',
      inputError: 'Le nom est requis',
      inputMaxLength: 'Le nom ne doit pas dépasser 70 caractères',
    },
    profile: {
      errors: {
        email: {
          valid: 'Un email valide est requis',
        },
        apiKey: {
          unauthorized: 'La clé API que vous avez fournie n\'est pas autorisée',
        },
      },
    },
  },
  groups: {
    tabs: {
      informations: 'Informations',
    },
    mailingTab: {
      confirmationField: 'Tapez le nom de l\'email pour confirmer',
      deleteWarningMessage:
        'Vous êtes sur le point de supprimer l\'email "<strong>{name}</strong>". Cette action est irréversible.',
      deleteSuccessful: 'Email supprimé',
      deleteFolderWarning:
        'Vous êtes sur le point de supprimer le dossier "<strong>{name}</strong>". Cette action est irréversible.',
      deleteFolderNotice:
        'Les emails et les dossiers que contient le dossier seront supprimés aussi',
      deleteFolderSuccessful: 'Dossier supprimé',
    },
    workspaceTab: {
      confirmationField: 'Tapez le nom du workspace pour confirmer',
      deleteWarningMessage:
        'Vous êtes sur le point de supprimer le workspace "<strong>{name}</strong>". Cette action est irréversible.',
      deleteNotice:
        'Les emails et les dossiers que contient le workspace seront supprimés aussi',
      deleteSuccessful: 'Workspace supprimé',
    },
  },
  mailings: {
    transfer: {
      label: 'Transférer l\'email',
      success: 'Email transféré',
    },
    creationNotice:
      'Cliquez sur l\'un des templates ci-dessous pour créer un nouvel email',
    list: 'Liste des emails',
    filters: {
      createdBetween: 'Crée entre le',
      updatedBetween: 'Mis à jour entre le',
      and: 'Et le',
    },
    deleteManySuccessful: 'Emails supprimés',
    deleteConfirmationMessage:
      'Vous êtes sur le point de supprimer les emails sélectionnés. Cette action est irréversible.',
    duplicate: 'Dupliquer l\'email',
    duplicateNotice:
      'Êtes-vous sûr de vouloir dupliquer <strong>{name}</strong> ?',
    name: 'Nom de l\'email',
    errorPreview: 'Pas d’aperçu disponible pour ce mail.',
    subErrorPreview:
      'Un aperçu sera généré lors de l\'ouverture de l\'éditeur du mail.',
    rename: 'Renommer l\'email',
    selectedCount: '{count} email sélectionné | {count} emails sélectionnés',
    selectedShortCount: '{count} email | {count} emails',
    deleteCount: 'Supprimer {count} email | Supprimer {count} emails',
    downloadCount: 'Télécharger {count} email | Télécharger {count} emails',
    moveCount: 'Déplacer {count} email | Déplacer {count} emails',
    deleteNotice: 'Cela supprimera définitivement:',
    copyMailConfirmationMessage:
      'Veuillez choisir l\'emplacement de la nouvelle copie',
    copyMailSuccessful: 'Email copié',
    moveMailConfirmationMessage: 'Veuillez choisir la destination',
    moveMailSuccessful: 'Email déplacé',
    downloadManySuccessful: 'Téléchargement des emails terminés',
    downloadMailSuccessful: 'Téléchargement d\'email terminé',
    moveManySuccessful: 'Emails déplacés',
    editTagsSuccessful: 'Labels mis à jour',
  },
  template: {
    noId: 'Aucun ID',
    noMarkup: 'Aucun markup',
    markup: 'Markup',
    download: 'Télécharger le markup',
    preview: 'Prévisualiser le template',
    removeImages: 'Supprimer toute les images',
    imagesRemoved: 'Images supprimées',
    deleteNotice:
      'Supprimer un template supprimera aussi tout les emails utilisant celui-ci',
  },
  tags: {
    list: 'Liste des labels',
    new: 'Nouveau label',
    handle: 'Gérer les labels',
  },
  users: {
    actions: {
      reset: 'Réinitialiser',
      send: 'Envoyer',
      resend: 'Renvoyer',
    },
    passwordTooltip: {
      reset: 'Réinitialiser le mot de passe',
      send: 'Envoyer l\'email de mot de passe',
      resend: 'Renvoyer l\'email de mot de passe',
    },
    enableNotice: 'Êtes-vous sûr de vouloir activer',
    disableNotice: 'Êtes-vous sûr de vouloir désactiver',
    passwordNotice: {
      reset: 'Êtes-vous sûr de vouloir réinitialiser le mot de passe de',
      send: 'Êtes-vous sûr de vouloir envoyer l\'email de mot de passe à',
      resend: 'Êtes-vous sûr de vouloir renvoyer l\'email de mot de passe à',
    },
    email: 'Email',
    lang: 'Langue',
    details: 'Informations',
    role: 'Rôle',
    tooltip: {
      noPassword: 'Désactivé à cause de l\'authenfication SAML',
    },
  },
  workspaces: {
    name: 'Nom',
    description: 'Descritpion',
    members: 'Membres',
    userIsGroupAdmin: 'L\'utilisateur est un administrateur du groupe',
  },
  profiles: {
    name: 'Nom',
    type: 'Type',
    senderName: 'Nom de l\'expéditeur',
    senderMail: 'Adresse email de l\'expéditeur',
    replyTo: 'Adresse email de réponse',
    createdAt: 'Data de création',
    actions: 'Actions',
    edit: 'Editer',
    delete: 'Supprimer',
    contentSendType: 'Le type du contenu',
    emptyState: 'Aucun profil disponible',
    warningNoFTP:
      'Vous ne pouvez pas ajouter de profil sans avoir configuré le serveur FTP',
    deleteWarningMessage:
      'Vous êtes sur le point de supprimer le profil "<strong>{name}</strong>".Cette action ne peut pas être annulée.',
  },
  folders: {
    name: 'Nom du dossier',
    nameUpdated: 'Dossier renommé',
    renameTitle:
      'Renommer le dossier <strong class="black--text">{name}</strong> ',
    rename: 'Renommer',
    created: 'Dossier créé',
    conflict: 'Le dossier existe déjà',
    moveFolderConfirmationMessage: 'Veuillez choisir la destination',
    moveFolderSuccessful: 'Dossier déplacé',
  },
  tableHeaders: {
    groups: {
      downloadWithoutEnclosingFolder: 'Télécharger sans dossier parent',
      cdnDownload: 'Téléchargement CDN',
      ftpDownload: 'Téléchargement FTP',
      status: 'Statut',
    },
    users: {
      passwordMail: 'Email de mot de passe',
    },
    templates: {
      markup: 'Markup?',
    },
    mailings: {
      rename: 'Renommer',
      transfer: 'Transférer',
    },
  },
};
