export default {
  snackbars: {
    updated: 'Mis à jour',
    created: 'Créé',
    deleted: 'Supprimé',
    usersFetchError: 'Impossible d\'accéder à la liste des utilisateurs :(',
    emailSent: 'L\'email a bien été envoyé',
  },
  global: {
    errors: {
      errorOccured: 'Oups ! Une erreur est survenue :(',
      required: 'Ce champ est obligatoire',
      userRequired: 'Veuillez saisir un utilisateur',
      nameRequired: 'Veuillez saisir un nom',
      entityRequired: 'Veuillez choisir une entité',
      targetTableRequired: 'Veuillez choisir une table cible',
      supportedLanguageIsRequired: 'Veuillez définir La langue',
      apiKeyInvalid: 'La clé API est invalide',
      apiKeyRequired: 'Veuillez saisir une clé API',
      senderNameRequired: 'Veuillez saisir un nom d\'expéditeur',
      senderMailRequired: 'Veuillez saisir l\'adresse email de l\'expéditeur',
      WORKSPACE_ALREADY_EXISTS: 'Un workspace avec le même nom existe déjà',
      FORBIDDEN_WORKSPACE_CREATION: 'Vous n\'avez pas les droits pour créer ce workspace',
      emailsGroupExist: 'Ce nom de liste de test est déjà utilisé',
      password: {
        error: {
          nouser: 'Cet utilisateur est introuvable',
          incorrect: 'Les identifiants saisis sont incorrects',
        },
      },
      login: {
        error: {
          internal: 'Oups ! Une erreur est survenue :(',
        },
      },
    },
    add: 'Ajouter',
    apiKey: 'Clé API',
    entity: 'Entité',
    encodingType: 'Type d\'encodage',
    targetTable: 'Table cible',
    supportedLanguage: 'Langue',
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
    parentLocation: 'Emplacement du dossier parent',
    template: 'Template | Templates',
    mailing: 'Email | Emails',
    newMailing: 'Ajouter un email',
    user: 'Utilisateur | Utilisateurs',
    newUser: 'Ajouter un utilisateur',
    newEmailsGroup: 'Ajouter une liste de test',
    editEmailsGroup: 'Modifier la liste de test',
    newTeam: 'Ajouter un workspace',
    editTeam: 'Modifier le workspace',
    newProfile: 'Ajouter un profil ESP',
    editProfile: 'Modifier le profil ESP {name}',
    profile: 'ESP',
    newTag: 'Ajouter un label',
    backToMails: 'Retourner aux emails',
    backToGroups: 'Retourner aux groupes',
    group: 'Groupe | Groupes',
    workspaces: 'Espaces de travail',
    newGroup: 'Ajouter un groupe',
    workspace: 'Workspace',
    newWorkspace: 'Ajouter un workspace',
    newMail: 'Créer un email',
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
    previewMailAlt: 'Aperçu de l\'email',
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
    emailsGroups: 'Listes de test',
    emailsGroupsEmpty: 'Aucune liste de test disponible',
    continue: 'Continuer',
    downloadFtp: 'Télécharger FTP',
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
      color: {
        label: 'Couleurs personnalisées',
       },
      defaultWorkspace: {
        label: 'Nom du workspace par défaut',
      },
      status: {
        label: 'Statut',
        demo: 'Démo',
        inactive: 'Inactif',
        active: 'Actif',
        requiredValidationMessage: 'Veuillez choisir un statut',
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
      endpoint: 'URL racine des images',
      editorLabel: 'Libellé du bouton',
      entryPoint: 'Point d\'entrée',
      issuer: 'Issuer',
      userHasAccessToAllWorkspaces: 'Donner accès à tous les workspaces aux utilisateurs standards',
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
      adminLogin: 'Connexion administrateur',
      sendLink: 'Envoyer le lien de réinitialisation',
      forgottenPassword: 'Mot de passe oublié ?',
      validate: 'Valider',
      errors: {
        password: {
          required: 'Veuillez saisir un mot de passe',
          confirm: 'Veuillez confirmer votre mot de passe',
          same: 'Les mots de passe saisis sont différents',
        },
        email: {
          required: 'Veuillez saisir une adresse email',
          valid: 'L\'adresses email doit être valide',
        },
      },
      tooltip: {
        noPassword: 'Désactivé à cause de l\'authenfication SAML',
      },
    },
    emailsGroup: {
      emails: 'Emails',
      emailsPlaceholder: 'Exemple: email.01@domaine.com;email.02@domaine.com;',
      errors: {
        name: {
          required: 'Veuillez saisir un nom de liste de test',
        },
        emails: {
          required: 'Veuillez saisir au moins une adresse email',
          emailsValid: 'Il semblerait qu\'il y ait des adresses emails non valides',
        },
      },
      deleteNotice: 'Vous êtes sur le point de supprimer cette liste de test. Cette action est irréversible.',
      deleteSuccess: 'La liste de test a bien été supprimé',
    },
    workspace: {
      checkBoxError: 'Je comprends que les emails et les dossiers contenus dans le workspace seront aussi supprimés',
      inputError: 'Veuillez saisir un nom',
      inputMaxLength: 'Le nom ne doit pas dépasser 70 caractères',
      moveFolderConfirmationMessage: 'Veuillez choisir la destination',
    },
    profile: {
      errors: {
        email: {
          valid: 'Veuillez saisir une adresse email valide',
        },
        apiKey: {
          unauthorized: 'La clé API fournie n\'est pas autorisée :(',
        },
      },
    },
  },
  groups: {
    tabs: {
      informations: 'Informations',
    },
    mailingTab: {
      confirmationField: 'Veuillez saisir le nom de l\'email pour confirmer',
      deleteWarningMessage: 'Vous êtes sur le point de supprimer l\'email : <strong>{name}</strong>. Cette action est irréversible.',
      deleteSuccessful: 'L\'email a bien été supprimé',
      deleteFolderWarning: 'Vous êtes sur le point de supprimer le dossier : <strong>{name}</strong>. Cette action est irréversible.',
      deleteFolderNotice: 'Les emails et dossiers contenus dans ce dossier seront également supprimés.',
      deleteFolderSuccessful: 'Le dossier a bien été supprimé',
    },
    workspaceTab: {
      confirmationField: 'Veuillez saisir le nom du workspace pour confirmer',
      deleteWarningMessage: 'Vous êtes sur le point de supprimer le workspace : <strong>{name}</strong>. Cette action est irréversible.',
      deleteNotice: 'Les emails et dossiers contenus dans ce workspace seront également supprimés.',
      deleteSuccessful: 'Le workspace a bien été supprimé',
    },
    delete: {
      'deleteWarningMessage': 'Vous êtes sur le point de supprimer le groupe "<strong>{name}</strong>".Cette action est irréversible.',
      'confirmationField': 'Tapez le nom du groupe pour confirmer',
      'deleteNotice': 'Les administrateurs, utilisteurs, templates, workspaces, répertoires, emails et groupes de testes seront supprimés aussi',
      'successful': 'Le groupe a bien été supprimé'
    },
  },
  mailings: {
    transfer: {
      label: 'Transférer l\'email',
      success: 'L\'email a bien été transféré',
    },
    creationNotice: 'Veuillez choisir un template afin de créer un nouvel email',
    list: '🔎 Rechercher dans la liste d\'emails',
    filters: {
      createdBetween: 'Créé entre le',
      updatedBetween: 'Mis à jour entre le',
      and: 'et le',
    },
    deleteManySuccessful: 'Les emails ont bien été supprimés',
    deleteConfirmationMessage: 'Vous êtes sur le point de supprimer l\'ensemble des emails sélectionnés. Cette action est irréversible.',
    duplicate: 'Dupliquer l\'email',
    duplicateNotice: 'Êtes-vous sûr de vouloir dupliquer l\'email : <strong>{name}</strong> ?',
    name: 'Nom de l\'email',
    downloadManyMailsWithoutPreview: 'Cette liste d\'emails ne contient pas de prévisualisation, ils ne pourront pas tous être téléchargés. Voulez vous continuer quand même ?',
    downloadSingleMailWithoutPreview: 'Impossible de télécharger un email sans aperçu. Veuillez ouvrir l\'email dans l\'éditeur pour en générer un.',
    errorPreview: 'Pas d’aperçu disponible pour cet email',
    subErrorPreview: 'L\'aperçu sera généré lors de l\'ouverture dans l\'éditeur',
    rename: 'Renommer l\'email',
    selectedCount: '{count} email sélectionné | {count} emails sélectionnés',
    selectedShortCount: '{count} email | {count} emails',
    deleteCount: 'Supprimer {count} email | Supprimer {count} emails',
    downloadCount: 'Télécharger {count} email | Télécharger {count} emails',
    downloadFtpCount: 'Télécharger en FTP {count} email | Télécharger en FTP {count} emails',
    moveCount: 'Déplacer {count} email | Déplacer {count} emails',
    deleteNotice: 'Cela supprimera définitivement :',
    copyMailConfirmationMessage: 'Veuillez choisir l\'emplacement de la nouvelle copie',
    copyMailSuccessful: 'L\'email a bien été copié',
    moveMailConfirmationMessage: 'Veuillez choisir la destination',
    moveMailSuccessful: 'L\'email a bien été déplacé',
    downloadManySuccessful: 'Les emails ont bien été téléchargés',
    downloadMailSuccessful: 'L\'email a bien été téléchargé',
    moveManySuccessful: 'Les emails ont bien été déplacés',
    editTagsSuccessful: 'Les labels ont bien été mis à jour',
  },
  template: {
    noId: 'Aucun ID',
    noMarkup: 'Aucun markup',
    markup: 'Markup',
    download: 'Télécharger le markup',
    preview: 'Prévisualiser le template',
    removeImages: 'Supprimer toutes les images',
    imagesRemoved: 'Les images ont bien été supprimées',
    deleteNotice: 'Supprimer un template supprimera aussi tout les emails utilisant ce template',
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
    email: 'Adressse email',
    lang: 'Langue',
    details: 'Informations',
    role: 'Rôle',
  },
  workspaces: {
    name: 'Nom',
    description: 'Descritpion',
    members: 'Utilisateurs',
    userIsGroupAdmin: 'L\'utilisateur est un administrateur du groupe',
  },
  profiles: {
    name: 'Nom',
    type: 'Type',
    senderName: 'Nom de l\'expéditeur',
    senderMail: 'Adresse email de l\'expéditeur',
    replyTo: 'Adresse email de réponse',
    createdAt: 'Date de création',
    actions: 'Actions',
    edit: 'Modifier',
    delete: 'Supprimer',
    contentSendType: 'Le type du contenu',
    emptyState: 'Aucun profil disponible',
    warningNoFTP: 'Vous ne pouvez pas ajouter de profil sans avoir configuré un serveur FTP au préalable.',
    deleteWarningMessage: 'Vous êtes sur le point de supprimer le profil : <strong>{name}</strong>. Cette action est irréversible.',
  },
  folders: {
    name: 'Nom du dossier',
    nameUpdated: 'Le dossier a bien été renommé',
    renameTitle: 'Renommer le dossier : <strong>{name}</strong>',
    rename: 'Renommer',
    created: 'Le dossier a bien été créé',
    conflict: 'Un dossier avec le même nom existe déjà',
    moveFolderConfirmationMessage: 'Veuillez choisir la destination',
    moveFolderSuccessful: 'Le dossier a bien été déplacé',
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
