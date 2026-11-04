export default {
  twoFactor: {
    code: {
      label: 'Code',
      submit: 'Valider',
      hints: {
        totp: 'Saisissez le code à 6 chiffres affiché par votre application d’authentification.',
        email: 'Saisissez le code à 6 chiffres reçu par email.',
      },
      recoveryHint:
        'Sans votre méthode de vérification ? Saisissez l’un de vos codes de secours.',
      incorrect: 'Code incorrect',
      expired: 'Étape expirée : saisissez de nouveau votre mot de passe.',
      trustDevice: 'Faire confiance à cet appareil pendant 30 jours',
      resend: 'Renvoyer un code',
      sent: 'Un nouveau code vous a été envoyé',
    },
    setup: {
      intro:
        'Votre entreprise demande une double authentification : après votre mot de passe, vous saisirez un code.',
      choose: 'Comment recevoir vos codes ?',
      methods: {
        totp: 'Une application d’authentification sur mon téléphone',
        email: 'Un code par email',
      },
      start: 'Continuer',
      emailSent:
        'Un code vient de vous être envoyé par email : saisissez-le pour activer la double authentification.',
      scan: 'Scannez ce QR code avec votre application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password…), puis saisissez le code qu’elle affiche.',
      qrCodeAlt: 'QR code de configuration',
      manual: 'Ou saisissez cette clé dans l’application :',
      confirm: 'Activer',
    },
    recoveryCodes: {
      intro:
        'Chaque code de secours vous connecte une fois, sans votre méthode de vérification. Gardez-les en lieu sûr : ils ne seront plus affichés.',
      copy: 'Copier',
      copied: 'Codes copiés',
      download: 'Télécharger',
      noted: 'J’ai noté mes codes de secours',
      continue: 'Continuer',
    },
    group: {
      title: 'Double authentification',
      description:
        'Chaque membre de l’entreprise saisit un code après son mot de passe. Ceux qui ne l’ont pas encore configurée le feront à leur prochaine connexion.',
      switch: 'Exiger la double authentification',
      saml: 'Cette entreprise se connecte en SSO : la double authentification relève de son fournisseur d’identité.',
      updated: 'Paramètre enregistré',
      required: 'Exigée pour tous les membres.',
      notRequired: 'Non exigée.',
      managedByTech: 'Seul un administrateur technique peut modifier ce paramètre.',
    },
    users: {
      column: 'Double auth.',
      methods: { totp: 'Application', email: 'Email' },
      notSetUp: 'Non configurée',
      reset: 'Réinitialiser la double authentification',
      resetNotice:
        'Ses sessions seront fermées et il la configurera de nouveau à sa prochaine connexion. Réinitialiser la double authentification de',
      resetDone: 'Double authentification réinitialisée',
      emailLocked:
        'Double authentification configurée : seul un administrateur technique peut changer l’adresse.',
    },
    passwordSet: 'Mot de passe enregistré : connectez-vous pour continuer.',
  },
  snackbars: {
    updated: 'Mis à jour',
    created: 'Créé',
    deleted: 'Supprimé',
    usersFetchError: 'Impossible d\'accéder à la liste des utilisateurs :(',
    groupFetchError: 'Impossible de charger les données de l\'entreprise :(',
    emailSent: 'L\'email a bien été envoyé',
  },
  global: {
    errors: {
      typeCampagneRequired: 'Le type de campagne est requis.',
      errorOccured: 'Oups ! Une erreur est survenue :(',
      passwordLinkExpired:
        'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau depuis la page de connexion.',
      tooManyRequests:
        'Trop de tentatives. Réessayez plus tard.',
      createMailingFailed: 'Une erreur est survenue lors de la création du mailing',
      required: 'Ce champ est obligatoire',
      userRequired: 'Veuillez saisir un utilisateur',
      nameRequired: 'Veuillez saisir un nom',
      replyToRequired: 'Veuillez saisir un email de réponse',
      entityRequired: 'Veuillez choisir une entité',
      databaseEntityRequired: 'Veuillez choisir une entité de base de données',
      targetTableRequired: 'Veuillez choisir une table cible',
      supportedLanguageIsRequired: 'Veuillez définir La langue',
      apiKeyInvalid: 'La clé API est invalide',
      apiKeyRequired: 'Veuillez saisir une clé API',
      secretKeyRequired: 'Veuillez saisir une clé secrète',
      adobeImsUrlRequired : 'Veuillez saisir une adresse de login',
      adobeBaseUrlRequired: 'Veuillez saisir une adresse',
      senderNameRequired: 'Veuillez saisir un nom d\'expéditeur',
      senderMailRequired: 'Veuillez saisir l\'adresse email de l\'expéditeur',
      WORKSPACE_ALREADY_EXISTS: 'Un workspace avec le même nom existe déjà',
      FORBIDDEN_WORKSPACE_CREATION:
        'Vous n\'avez pas les droits pour créer ce workspace',
      INVALID_SSH_KEY_FORMAT:
        'Format de clé SSH invalide. Formats acceptés : PEM ou OpenSSH.',
      INCOMPLETE_SSH_KEY: 'Clé SSH incomplète : marqueur de fin manquant.',
      FTP_MISSING_SSH_KEY: 'Aucune clé SSH configurée pour cette entreprise.',
      FTP_NOT_ENABLED: 'Le FTP n\'est pas activé pour cette entreprise.',
      FTP_CONNECTION_AUTH_FAILED:
        'Échec de l\'authentification. Vérifiez vos identifiants (mot de passe ou clé SSH).',
      FTP_CONNECTION_HOST_NOT_FOUND: 'Hôte introuvable.',
      FTP_CONNECTION_REFUSED: 'Connexion refusée.',
      FTP_CONNECTION_INVALID_KEY: 'Clé SSH invalide ou format non supporté.',
      FTP_CONNECTION_TIMEOUT: 'Délai de connexion dépassé.',
      FTP_CONNECTION_HANDSHAKE_FAILED:
        'Échec de la négociation SSH. Le serveur utilise peut-être des algorithmes non supportés.',
      FTP_PATH_NOT_FOUND: 'Chemin introuvable sur le serveur.',
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
      session: {
        replaced: 'Vous avez été déconnecté car vous vous êtes connecté depuis un autre endroit.',
        expired: 'Votre session a expiré. Veuillez vous reconnecter.',
      },
    },
    add: 'Ajouter',
    apiKey: 'Clé API',
    secretKey: 'Clé secrète',
    adobeImsUrl : 'Url de login Adobe',
    adobeBaseUrl : 'Url de base d\'Adobe',
    adobeBaseUrlHelper: 'L’URL sera complétée automatiquement par /jsp/soaprouter.jsp et /jsp/uploadFile.jsp',
    targetType: 'Type du connecteur :',
    entity: 'Entité',
    databaseEntity: 'Entité de base de données',
    routingEntity: 'Entité de routage',
    routingEntityHint: 'Configuration d\'envoi (expéditeur, DKIM). Par défaut : identique à l\'entité de base de données.',
    encodingType: 'Type d\'encodage',
    targetTable: 'Table cible',
    supportedLanguage: 'Langue',
    profileName: 'Nom du profil ESP',
    typeCampagne: 'Type de Campagne',
    addTags: 'Ajouter des labels',
    copyMail: 'Copier',
    copyMailAction: 'Créer une copie',
    moveFolderAction: 'Déplacer le dossier',
    moveMail: 'Déplacer',
    location: 'Destination',
    moveManyMail: 'Déplacer les emails',
    teams: 'Workspaces',
    newTemplate: 'Ajouter un template',
    newFolder: 'Nouveau dossier',
    parentLocation: 'Destination',
    template: 'Template | Templates',
    mailing: 'Email | Emails',
    newMailing: 'Nouvel email',
    user: 'Utilisateur | Utilisateurs',
    newUser: 'Ajouter un utilisateur',
    editUser: 'Modifier l\'utilisateur',
    newEmailsGroup: 'Ajouter une liste de test',
    editEmailsGroup: 'Modifier la liste de test',
    newTeam: 'Ajouter un workspace',
    editTeam: 'Modifier le workspace',
    newProfile: 'Ajouter un profil ESP',
    editProfile: 'Modifier le profil ESP {name}',
    profile: 'ESP',
    newTag: 'Ajouter un label',
    backToMails: 'Retourner aux emails',
    backToGroups: 'Retourner aux entreprises',
    group: 'Entreprise | Entreprises',
    workspaces: 'Espaces de travail',
    newGroup: 'Ajouter une entreprise',
    newCompany: 'Ajouter une company',
    companyName: 'Nom de la company',
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
    clear: 'Effacer',
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
    title: 'Titre',
    savedSuccessfully: 'Enregistré',
    search: 'Rechercher',
    externalUsername: 'Nom externe',
    description: 'Description',
    author: 'Auteur',
    tags: 'Tags',
    password: 'Mot de passe',
    email: 'Email',
    enable: 'Activer',
    disable: 'Désactiver',
    enabled: 'Activé',
    disabled: 'Désactivé',
    status: 'Statut',
    createdAt: 'Créé le',
    updatedAt: 'Mis à jour le',
    comments: 'Commentaires',
    edit: 'Modifier',
    move: 'Déplacer',
    moveTo: 'Déplacer vers…',
    emailsGroups: 'Listes de test',
    variables: 'Variables',
    emailsGroupsEmpty: 'Aucune liste de test disponible',
    continue: 'Continuer',
    all: 'Tout',
    downloadFtp: 'Télécharger FTP',
    noData: 'Aucune donnée disponible',
  },
  layout: {
    logout: 'Déconnexion',
    help: 'Besoin d\'aide ?',
  },
  forms: {
    group: {
      sections: {
        generalInfo: 'Informations générales',
        imageHosting: 'Hébergement des images',
        authentication: 'Authentification',
        authenticationDescription: 'Configurez l\'authentification SAML pour permettre à vos utilisateurs de se connecter avec leur compte d\'entreprise.',
        permissions: 'Permissions',
        permissionsDescription: 'Gérez les droits d\'accès des utilisateurs aux différents workspaces.',
        companyInfo: 'Informations de l\'entreprise',
        companyInfoDescription: 'Renseignez les informations principales de l\'entreprise.',
      },
      enableSaml: 'Activer l\'authentification SAML',
      entryPointHint: 'URL de connexion fournie par votre fournisseur d\'identité',
      issuerHint: 'Identifiant unique de votre application chez le fournisseur',
      idpCertHint:
        'Certificat de signature du fournisseur d\'identité (PEM), présent dans ses métadonnées SAML. Obligatoire : sans lui, la connexion SSO n\'est pas proposée.',
      dangerZone: {
        title: 'Zone de danger',
        description: 'Les actions dans cette zone sont irréversibles. Procédez avec prudence.',
        deleteCompany: 'Supprimer l\'entreprise',
        deleteTitle: 'Supprimer l\'entreprise',
      },
      name: 'Nom de l\'entreprise',
      downloadWithoutEnclosingFolder: {
        label: 'Format du fichier zip',
        wrapped: 'Englober dans un dossier parent',
        unwrapped: 'Laisser les fichiers à la racine',
      },
      color: {
        label: 'Couleurs personnalisées',
        description: 'Définissez les couleurs disponibles dans l\'éditeur d\'email pour cette entreprise.',
      },
      defaultWorkspace: {
        label: 'Nom du workspace par défaut',
        hint: 'Laisser vide pour utiliser le nom par défaut',
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
      samlAuthentication: 'Authentification SAML',
      enable: 'Activer',
      ftpProtocol: 'Protocole FTP',
      host: 'Hôte',
      username: 'Identifiant',
      port: 'Port',
      path: 'Chemin du dossier',
      httpProtocol: 'Protocole HTTP',
      endpoint: 'URL racine des images',
      editorLabel: 'Libellé du bouton',
      ftpAuthType: 'Méthode d\'authentification',
      ftpSshKey: 'Clé SSH privée',
      ftpSshKeyPlaceholder: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
      testFtpConnection: 'Tester la connexion',
      ftpConnectionSuccess: 'Connexion réussie',
      entryPoint: 'Point d\'entrée',
      issuer: 'Issuer',
      idpCert: 'Certificat du fournisseur d\'identité',
      userHasAccessToAllWorkspaces:
        'Donner accès à tous les workspaces aux utilisateurs standards',
    },
    template: {
      meta: 'Meta',
      files: 'Fichiers',
      markup: 'Markup',
    },
    user: {
      name: 'Nom de l\'utilisateur',
      externalUsername: 'Nom d\'utilisateur externe',
      optional: ' (Optionnel)',
      passwordConfirm: 'Confirmation du mot de passe',
      passwordReset: 'Réinitialisation du mot de passe',
      login: 'Connexion',
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
      emailsHint: 'Séparez les adresses email par des points-virgules (;)',
      configuration: 'Configuration de la liste de test',
      configurationDescription:
        'Définissez le nom et les adresses email pour cette liste de test',
      errors: {
        name: {
          required: 'Veuillez saisir un nom de liste de test',
        },
        emails: {
          required: 'Veuillez saisir au moins une adresse email',
          emailsValid:
            'Il semblerait qu\'il y ait des adresses emails non valides',
        },
      },
      deleteNotice:
        'Vous êtes sur le point de supprimer cette liste de test. Cette action est irréversible.',
      deleteSuccess: 'La liste de test a bien été supprimée',
    },
    workspace: {
      checkBoxError:
        'Je comprends que les emails et les dossiers contenus dans le workspace seront aussi supprimés',
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
        default:
           'Une erreur s\'est produite. Veuillez réessayer.',
        creation :
            'Une erreur est survenue lors de la création du connecteur. Contactez le support avec l\'identifiant : {logId}.',
        update : 'Une erreur est survenue lors de la modification du connecteur. Contactez le support avec l\'identifiant : {logId}.',
        invalidClient : 'Clé api invalide.',
        invalidSecret : 'Clé secrète invalide.'
      },
    },
  },
  groups: {
    tabs: {
      general: 'Général',
    },
    platform: {
      badge: 'Plateforme',
      setAction: 'Définir comme entreprise plateforme',
      unsetAction: 'Retirer le rôle plateforme',
      setDone: '« {name} » est désormais l\'entreprise plateforme',
      unsetDone: '« {name} » n\'est plus l\'entreprise plateforme',
    },
    modules: {
      title: 'Modules activés',
      description: 'Activez ou désactivez les modules disponibles pour cette entreprise.',
      notEnabled: 'Module non activé',
      emailBuilder: {
        name: 'Email Builder',
        description: 'Création et édition d\'emails responsive',
      },
      crmIntelligence: {
        name: 'CRM Intelligence',
        description: 'Tableaux de bord et analytics',
        configHint: 'Configuration avancée dans l\'onglet dédié',
        toggleMovedHint:
          'L\'activation du module se fait depuis l\'onglet Général',
      },
      mcp: {
        name: 'MCP',
        description: 'Connexion de Claude, ChatGPT et Copilot à LePatron',
        configHint:
          'L\'admin technique active ensuite l\'accès dans Fonctionnalités IA',
        closeTitle: 'Fermer le module MCP\u00a0?',
        close: 'Fermer le module',
        closeConfirm:
          ' | La seule connexion de l\'entreprise {group} sera coupée tout de suite. Son utilisateur devra reconnecter son assistant si le module rouvre. | Les {count} connexions de l\'entreprise {group} seront coupées tout de suite. Chaque utilisateur devra reconnecter son assistant si le module rouvre.',
        closeConfirmUnknown:
          'Les connexions de l\'entreprise {group} seront coupées tout de suite. Chaque utilisateur devra reconnecter son assistant si le module rouvre.',
      },
    },
    mailingTab: {
      confirmationField: 'Veuillez saisir le nom de l\'email pour confirmer',
      deleteWarningMessage:
        'Vous êtes sur le point de supprimer l\'email : <strong>{name}</strong>.<br/>Cette action est irréversible.',
      deleteSuccessful: 'L\'email a bien été supprimé',
      deleteFolderWarning:
        'Vous êtes sur le point de supprimer le dossier : <strong>{name}</strong>.<br/>Cette action est irréversible.',
      deleteFolderNotice:
        'Les emails et dossiers contenus dans ce dossier seront également supprimés.',
      deleteFolderSuccessful: 'Le dossier a bien été supprimé',
    },
    workspaceTab: {
      confirmationField: 'Veuillez saisir le nom du workspace pour confirmer',
      deleteWarningMessage:
        'Vous êtes sur le point de supprimer le workspace : <strong>{name}</strong>.<br/>Cette action est irréversible.',
      deleteNotice:
        'Les emails et dossiers contenus dans ce workspace seront également supprimés.',
      deleteSuccessful: 'Le workspace a bien été supprimé',
      empty: 'Aucun workspace pour le moment',
    },
    delete: {
      deleteWarningMessage:
        'Vous êtes sur le point de supprimer l\'entreprise : <strong>{name}</strong>.<br/>Cette action est irréversible.',
      confirmationField: 'Tapez le nom de l\'entreprise pour confirmer',
      deleteNotice:
        'Les administrateurs, utilisateurs, templates, workspaces, répertoires, emails et listes de test seront également supprimés.',
      successful: 'L\'entreprise a bien été supprimée',
    },
  },
  mailings: {
    noMailingsAvailable: 'Aucun email disponible',
    transfer: {
      label: 'Transférer l\'email',
      success: 'L\'email a bien été transféré',
    },
    creationNotice:
      'Veuillez choisir un template afin de créer un nouvel email',
    list: 'Rechercher dans la liste d\'emails',
    filters: {
      title: 'Filtres',
      createdBetween: 'Créé entre le',
      updatedBetween: 'Mis à jour entre le',
      and: 'et le',
      searchPlaceholder: 'Rechercher par nom...',
      startDate: 'Date début',
      endDate: 'Date fin',
    },
    search: {
      scope: 'Rechercher dans',
      currentFolder: 'Dossier courant',
      allWorkspaces: 'Tous mes espaces de travail',
      location: 'Emplacement',
      noMatchInAllWorkspaces:
        'Aucun email ne correspond à votre recherche dans vos espaces de travail',
      noMailingInAllWorkspaces: 'Aucun email dans vos espaces de travail',
      noMatchInLocation:
        'Aucun email ne correspond à votre recherche dans cet emplacement',
      searchAllWorkspaces: 'Chercher dans tous mes espaces de travail',
      resetFilters: 'Réinitialiser les filtres',
      readOnly: 'Lecture seule : ouvrez son emplacement',
      activeFilters: '{n} filtre actif | {n} filtres actifs',
    },
    deleteManySuccessful: 'Les emails ont bien été supprimés',
    deleteConfirmationMessage:
      'Vous êtes sur le point de supprimer l\'ensemble des emails sélectionnés.<br/>Cette action est irréversible.',
    duplicate: 'Dupliquer l\'email',
    duplicateNotice:
      'Êtes-vous sûr de vouloir dupliquer l\'email : <strong>{name}</strong> ?',
    name: 'Nom de l\'email',
    downloadManyMailsWithoutPreview:
      'Cette liste d\'emails ne contient pas de prévisualisation, ils ne pourront pas tous être téléchargés. Voulez vous continuer quand même ?',
    downloadSingleMailWithoutPreview:
      'Impossible de télécharger un email sans aperçu. Veuillez ouvrir l\'email dans l\'éditeur pour en générer un.',
    errorPreview: 'Pas d’aperçu disponible pour cet email',
    locationUnreachable:
      'Ce workspace ou ce dossier n’est plus accessible. Retour au premier workspace.',
    subErrorPreview: 'L\'aperçu sera généré lors de l\'ouverture dans l\'éditeur',
    subErrorPreviewReadOnly:
      'L’aperçu sera généré quand un membre du workspace ouvrira l’email dans l’éditeur',
    previewUnavailable: 'L’aperçu n’a pas pu être chargé',
    subPreviewUnavailable: 'Veuillez réessayer, ou contacter votre administrateur',
    rename: 'Renommer l\'email',
    selectedCount: '{count} email sélectionné | {count} emails sélectionnés',
    selectedMailings: 'email sélectionné | emails sélectionnés',
    selectedShortCount: '{count} email | {count} emails',
    deleteCount: 'Supprimer {count} email | Supprimer {count} emails',
    downloadCount: 'Télécharger {count} email | Télécharger {count} emails',
    downloadFtp: 'Télécharger FTP',
    downloadFtpCount:
      'Télécharger en FTP {count} email | Télécharger en FTP {count} emails',
    moveCount: 'Déplacer {count} email | Déplacer {count} emails',
    deleteNotice: 'Cela supprimera définitivement :',
    copyMailConfirmationMessage: 'Veuillez choisir l\'emplacement de la copie :',
    copyMailConfirmationMessageWithName:
      'Veuillez choisir l\'emplacement de la copie de l\'email <strong>{name}</strong> :',
    copyMailSuccessful: 'L\'email a bien été copié',
    moveMailConfirmationMessage: 'Veuillez choisir la destination :',
    moveMailConfirmationMessageWithName:
      'Veuillez choisir la destination de l\'email <strong>{name}</strong> :',
    moveMailSuccessful: 'L\'email a bien été déplacé',
    downloadManySuccessful: 'Les emails ont bien été téléchargés',
    downloadMailSuccessful: 'L\'email a bien été téléchargé',
    moveManySuccessful: 'Les emails ont bien été déplacés',
    editTagsSuccessful: 'Les labels ont bien été mis à jour',
    openComments: 'Ouvrir les commentaires',
    openCommentsApproved: 'Validé — ouvrir les commentaires',
    duplicateTranslate: 'Dupliquer + Traduire',
  },
  translation: {
    duplicateAndTranslate: 'Dupliquer et traduire',
    autoDetect: 'Détection automatique',
    sourceLanguage: 'Langue source',
    targetLanguage: 'Langue cible',
    newName: 'Nom du nouvel email',
    translate: 'Traduire',
    duplicateNotice: 'L\'email <strong>{name}</strong> sera dupliqué et traduit automatiquement.',
    noActiveIntegration: 'Aucune intégration IA active. Configurez une intégration dans les paramètres de l\'entreprise.',
    noLanguagesConfigured: 'Aucune langue configurée. Configurez les langues disponibles dans les paramètres de l\'entreprise.',
    success: 'Email dupliqué et traduit avec succès',
    successTitle: 'Traduction effectuée',
    successMessage: 'Votre email a été dupliqué et traduit avec succès.',
    warningTitle: 'Pensez à vérifier :',
    // Keyed as the server sends them in a job's warningKeys.
    warnings: {
      checkLinks: 'Les liens présents dans l\'email',
      checkImages: 'Les images contenant du texte',
      checkVariant: 'La variante de template si applicable',
      composedBlockUntranslated: 'Les blocs composés : certains n\'ont pas pu être traduits, ou ont été reconstruits avec une version plus récente du constructeur de blocs',
    },
    understood: 'J\'ai compris',
    translatingNotice: 'Traduction en cours, veuillez patienter...',
    progressStarting: 'Démarrage de la traduction...',
    progressBatch: 'Traduction en cours... (lot {current}/{total})',
    progressCompleted: 'Terminé !',
    pleaseWait: 'Veuillez patienter...',
    cancelled: 'Traduction annulée',
    estimatedTime: '~{time} restantes',
    destination: 'Destination',
    destinationHint: 'Sélectionnez où créer la copie traduite',
  },
  template: {
    noId: 'Aucun ID',
    noMarkup: 'Aucun markup',
    markup: 'Markup',
    download: 'Télécharger le markup',
    preview: 'Prévisualiser le template',
    removeImages: 'Supprimer toutes les images',
    imagesRemoved: 'Les images ont bien été supprimées',
    deleteNotice:
      'Supprimer un template supprimera aussi tout les emails utilisant ce template',
  },
  tags: {
    list: 'Liste des labels',
    new: 'Nouveau label',
    handle: 'Gérer les labels',
    tag: 'Label',
  },
  users: {
    actions: {
      reset: 'Réinitialiser',
      send: 'Envoyer',
      resend: 'Renvoyer',
      activate: 'Activer l\'utilisateur',
      deactivate: 'Désactiver l\'utilisateur',
      sendPassword: 'Envoyer l\'email de mot de passe',
      resendPassword: 'Renvoyer l\'email de mot de passe',
      resetPassword: 'Réinitialiser le mot de passe',
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
    email: 'Adresse email',
    lang: 'Langue',
    details: 'Informations',
    role: 'Rôle',
    roles: {
      superAdmin: 'Super administrateur',
      groupAdmin: 'Administrateur de l\'entreprise',
      regularUser: 'Utilisateur',
      writer: 'Rédacteur',
      reviewer: 'Relecteur',
      companyAdminTech: 'Admin technique',
      chip: {
        superAdmin: 'Super admin',
        groupAdmin: 'Admin',
      },
    },
    noUsersAvailable: 'Aucun utilisateur disponible',
    readOnlyAccount:
      'Ce compte a plus de droits que le vôtre : vous pouvez le consulter, pas le modifier.',
    sections: {
      statusSecurity: 'Statut & Sécurité',
      statusSecurityDescription:
        'Gérez le statut du compte et les options de mot de passe.',
    },
    status: {
      confirmed: 'Actif',
      saml: 'SSO',
      passwordSent: 'En attente',
      toInitialize: 'À initialiser',
      deactivated: 'Désactivé',
    },
    statusDescription: {
      confirmed: 'L\'utilisateur a accès à la plateforme.',
      saml: 'L\'utilisateur se connecte via SSO (authentification unique).',
      passwordSent:
        'Un email d\'initialisation a été envoyé, en attente de confirmation.',
      toInitialize: 'L\'utilisateur n\'a pas encore reçu d\'email de mot de passe.',
      deactivated: 'L\'utilisateur ne peut plus accéder à la plateforme.',
    },
  },
  workspaces: {
    name: 'Nom',
    description: 'Description',
    members: 'Utilisateurs',
    membersDescription:
      'Sélectionnez les utilisateurs qui auront accès à ce workspace.',
    userIsGroupAdmin: 'L\'utilisateur est un administrateur de l\'entreprise',
    noUsersAvailable: 'Aucun utilisateur disponible',
    sections: {
      info: 'Informations',
      infoDescription: 'Définissez le nom du workspace.',
    },
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
    warningNoFTP:
      'Vous ne pouvez pas ajouter de profil sans avoir configuré un serveur FTP au préalable.',
    deleteWarningMessage:
      'Vous êtes sur le point de supprimer le profil : <strong>{name}</strong>.<br/>Cette action est irréversible.',
    newProfile: 'Nouveau profil ESP',
    espType: 'Fournisseur ESP',
    espTypeDescription:
      'Sélectionnez le fournisseur de services email pour ce profil.',
    selectEsp: 'Fournisseur de services email',
    apiConfiguration: 'Configuration API',
    apiConfigurationDescription:
      'Entrez les identifiants API de votre compte ESP.',
    senderConfiguration: 'Informations expéditeur',
    senderConfigurationDescription:
      'Configurez les informations par défaut de l\'expéditeur pour les emails envoyés via ce profil.',
    databaseConfiguration: 'Configuration base de données',
    databaseConfigurationDescription:
      'Configurez l\'entité de base de données et la table cible.',
    targetTypeDescription:
      'Sélectionnez le type de cible pour les envois Adobe Campaign.',
  },
  folders: {
    name: 'Nom du dossier',
    nameUpdated: 'Le dossier a bien été renommé',
    renameTitle: 'Renommer le dossier <strong>{name}</strong>',
    rename: 'Renommer',
    created: 'Le dossier a bien été créé',
    conflict: 'Un dossier avec le même nom existe déjà',
    hasChildren:
      'Ce dossier contient des sous-dossiers et ne peut pas être déplacé vers un autre dossier',
    moveFolderConfirmationMessage: 'Veuillez choisir la destination :',
    moveFolderConfirmationMessageWithName:
      'Veuillez choisir la destination du dossier <strong>{name}</strong> :',
    moveFolderSuccessful: 'Le dossier a bien été déplacé',
  },
  tableHeaders: {
    groups: {
      cdnDownload: 'CDN',
      ftpDownload: 'FTP',
      status: 'Statut',
      esp: 'ESP',
      ai: 'IA',
      mcp: 'MCP',
    },
    users: {
      passwordMail: 'Email de mot de passe',
    },
    templates: {
      markup: 'Markup?',
      coverImage: 'Aperçu?',
      imageCount: 'Images',
    },
    mailings: {
      rename: 'Renommer',
      transfer: 'Transférer',
    },
    workspaces: {
      assigned: 'Accès',
    },
  },
  trackingConfig: {
    sidebarLabel: 'Tracking',
    title: 'Tracking global',
    description:
      'Définissez les paramètres UTM appliqués automatiquement à tous les emails (configuration globale). Les valeurs renseignées ici écrasent celles déjà présentes dans les liens.',
    enabled: 'Activer le tracking global',
    restrictValues:
      'Limiter aux paramètres ci-dessous (désactiver la saisie libre dans le builder)',
    addParam: 'Ajouter un paramètre',
    key: 'Clé',
    values: 'Valeurs possibles',
    valuesHint: 'ex : newsletter, promo (séparés par des virgules)',
    required: 'Obligatoire',
    locked: 'Verrouillé',
    lockedHint:
      'Si activé, l\'utilisateur ne peut pas saisir de valeur libre pour cette clé : il doit choisir parmi les valeurs définies ci-dessus.',
    lockedDisabledHint:
      'Définissez au moins une valeur possible pour pouvoir verrouiller cette clé.',
    empty: 'Aucun paramètre de tracking défini',
    inheritedFromGroup: 'Hérité de la configuration globale',
    cascade: {
      label: 'Configuration du tracking pour ce template',
      inherit: 'Hériter de la configuration globale',
      inheritDescription:
        'Les paramètres définis au niveau global s\'appliquent tels quels.',
      extend: 'Hériter et ajouter des paramètres spécifiques',
      extendDescription:
        'Les paramètres globaux restent actifs ; ceux ajoutés ci-dessous viennent les compléter (ou les remplacer pour une clé en conflit).',
      replace: 'Remplacer la configuration globale par une configuration spécifique',
      replaceDescription:
        'Seuls les paramètres définis ci-dessous sont appliqués ; la configuration globale est ignorée.',
    },
    validation: {
      emptyKey: 'La clé est requise',
      duplicateKey: 'Cette clé est dupliquée',
    },
    snackbars: {
      updated: 'Configuration de tracking enregistrée.',
      error: 'Erreur lors de l\'enregistrement.',
    },
    builder: {
      requiredMissing: 'Paramètres de tracking obligatoires manquants',
      requiredMissingDescription:
        'Veuillez renseigner ces paramètres avant de télécharger : {keys}',
    },
    templates: {
      sectionTitle: 'Tracking spécifique par template',
      sectionDescription:
        'Vous pouvez surcharger ou compléter la configuration globale ci-dessus pour chaque template.',
      empty: 'Aucun template disponible.',
      statusInherits: 'Hérite de la configuration globale',
      statusMerge: 'Configuration complémentaire à la configuration globale',
      statusOverride: 'Configuration spécifique (remplace la configuration globale)',
    },
  },
  personalizedVariables: {
    title: 'Variables personnalisées',
    description:
      'Définissez des variables personnalisées utilisables dans vos templates email',
    empty: 'Aucune variable définie',
    status: 'Statut',
    label: 'Libellé',
    variable: 'Variable',
    actions: 'Actions',
    addRow: 'Ajouter une variable',
    save: 'Enregistrer',
    delete: 'Supprimer',
    deleteTitle: 'Supprimer la variable',
    deleteNotice:
      'Êtes-vous sûr de vouloir supprimer la variable "{variable}" ?',
    validation: {
      required: 'Ce champ est requis.',
    },
    snackbars: {
      deleted: 'Variable supprimée avec succès.',
      updated: 'Variables enregistrées avec succès.',
      error: 'Une erreur s\'est produite. Veuillez réessayer.',
    },
  },
  adobe: {
    targetTypes: {
      'NMS_DELIVERY': 'Livrable',
      'NMS_DELIVERY_MODEL': 'Modèle de livrable'
    }
  },
  integrations: {
    // Keyed by the server error code, so a failed save can say what to fix
    // instead of showing the raw code.
    errors: {
      INTEGRATION_NAME_ALREADY_EXIST:
        'Une intégration porte déjà ce nom dans cette entreprise. Choisissez-en un autre.',
      INTEGRATION_NOT_FOUND:
        'Cette intégration n\'existe plus : elle a peut-être été supprimée. Rechargez la page.',
      FORBIDDEN_INTEGRATION_ACCESS:
        'Vous n\'avez pas accès à cette intégration.',
      INTEGRATION_HOST_NOT_PUBLIC:
        'Cette adresse est privée ou locale. Pour des raisons de sécurité, LePatron n\'appelle que des adresses publiques : une IA hébergée sur votre réseau interne n\'est pas joignable depuis le serveur.',
      INTEGRATION_HOST_UNREACHABLE:
        'Ce nom de domaine est introuvable. Vérifiez l\'orthographe de l\'URL.',
      INTEGRATION_HOST_INVALID:
        'Cette URL n\'est pas valide. Attendu : une adresse complète, par exemple https://exemple.com',
      INTEGRATION_HOST_HTTPS_REQUIRED:
        'Cette adresse doit commencer par https:// : l\'intégration y envoie une clé, qui circulerait en clair en http.',
      INTEGRATION_API_KEY_REQUIRED:
        'L\'adresse de l\'API a changé : saisissez à nouveau la clé API.',
      INVALID_PRODUCT_ID: 'Le Product ID ne contient que des chiffres.',
      INTEGRATION_CONFIG_INVALID:
        'Un réglage de l\'intégration n\'est pas valide pour ce fournisseur.',
    },
    apiKeyRequiredOnHostChange:
      'L\'adresse de l\'API a changé : saisissez à nouveau la clé pour confirmer qu\'elle doit y être envoyée.',
    title: 'Intégrations',
    name: 'Nom',
    provider: 'Fournisseur',
    status: 'Statut',
    active: 'Actif',
    apiKey: 'Clé API',
    apiHost: 'URL de l\'API (optionnel)',
    apiKeyHintEdit: 'Laissez vide pour conserver la clé actuelle',
    productId: 'ID du produit',
    add: 'Ajouter une intégration',
    edit: 'Modifier l\'intégration',
    created: 'Intégration créée avec succès',
    updated: 'Intégration mise à jour avec succès',
    deleted: 'Intégration supprimée avec succès',
    validate: 'Tester la connexion',
    validationSuccess: 'Connexion validée avec succès',
    validationFailed: 'Échec de la validation des identifiants',
    noIntegrations: 'Aucune intégration configurée',
    deleteConfirmTitle: 'Supprimer l\'intégration',
    deleteConfirmMessage: 'Êtes-vous sûr de vouloir supprimer l\'intégration "{name}" ?',
    deleteWarningDashboards: 'Attention : {count} tableau(x) de bord associé(s) seront également supprimés.',
    categories: {
      bi: 'BI & Analytics',
      aiGeneration: 'IA - Génération',
      aiTranslation: 'IA - Traduction',
      contentFeed: 'Flux de contenu',
    },
    statusLabels: {
      valid: 'Validé',
      invalid: 'Invalide',
      pending: 'En attente'
    },
    metabase: {
      apiKeyPlaceholder: 'Votre clé secrète Metabase',
      apiKeyLabel: 'Clé secrète Metabase',
      apiHostHint: 'URL de votre instance Metabase (ex: https://metabase.example.com)'
    },
    openai: {
      apiKeyPlaceholder: 'sk-...',
      apiHostHint: 'Laissez vide pour utiliser l\'API officielle OpenAI'
    },
    mistral: {
      apiKeyPlaceholder: 'Votre clé API Mistral',
      apiHostHint: 'Laissez vide pour utiliser l\'API officielle Mistral'
    },
    infomaniak: {
      apiKeyPlaceholder: 'Votre clé API Infomaniak',
      productId: 'Product ID',
      productIdHint: 'Trouvez votre Product ID dans la console Infomaniak > AI Tools',
      productIdInvalid: 'Le Product ID ne contient que des chiffres'
    },
    anthropic: {
      apiKeyPlaceholder: 'Votre clé API Anthropic',
      apiHostHint: 'Laissez vide pour l\'API publique Anthropic ; à renseigner uniquement si vous passez par une passerelle d\'entreprise.'
    },
    gemini: {
      apiKeyPlaceholder: 'Votre clé API Google AI Studio',
      apiHostHint: 'Laissez vide pour l\'API publique Gemini.'
    },
    azureOpenai: {
      apiKeyPlaceholder: 'Votre clé API Azure OpenAI',
      apiHostHint: 'URL de votre ressource Azure, par exemple https://mon-instance.openai.azure.com. Le nom du déploiement tient lieu de modèle.',
      reasoningModel: 'Le déploiement utilise un modèle de raisonnement (gpt-5, série o)',
      reasoningModelHint: 'À cocher si le déploiement tourne sur gpt-5, o1, o3 ou o4 : ces modèles refusent la température et max_tokens, et le nom du déploiement ne permet pas de le deviner. Le réglage vaut pour tous les déploiements utilisés avec cette intégration : si l\'un d\'eux est un modèle de raisonnement, cochez-le, les autres modèles fonctionnent aussi (ils perdent seulement le réglage de température).'
    },
    openaiCompatible: {
      apiKeyPlaceholder: 'La clé API de votre endpoint',
      apiHostHint: 'Tout endpoint compatible avec l\'API OpenAI. Les adresses privées et locales sont refusées pour des raisons de sécurité.',
      supportsJsonMode: 'L\'endpoint gère le mode JSON (response_format)',
      supportsJsonModeHint: 'À cocher seulement si l\'endpoint garantit une réponse JSON valide : les skills s\'appuient alors dessus. Sinon, la réponse est réparée après coup.'
    },
    scaleway: {
      apiKeyPlaceholder: 'Votre clé API Scaleway',
      apiHostHint: 'Laissez vide sauf si votre compte impose une URL propre à un projet.'
    },
    ovh: {
      apiKeyPlaceholder: 'Votre clé API OVHcloud',
      apiHostHint: 'Laissez vide pour les AI Endpoints publics d\'OVHcloud.'
    },
    deepl: {
      apiKeyPlaceholder: 'Votre clé API DeepL',
      apiKeyHint: 'Votre clé API DeepL (Free ou Pro)'
    },
    rss: {
      apiHostHint: 'URL publique du flux RSS ou Atom'
    },
    models: {
      fastEconomical: 'rapide, économique',
      balanced: 'équilibré',
      powerful: 'puissant',
      fast: 'rapide',
      recommended: 'recommandé',
    }
  },
  emailBuilderSettings: {
    title: 'Réglages Email Builder',
    sidebarLabel: 'Configuration',
    metadata: {
      sectionTitle: 'Métadonnées des emails',
      sectionDescription:
        'Permet de renseigner un objet, une date d\'envoi prévue et une typologie sur chaque email, au lieu de les ressaisir à chaque envoi.',
      enabled: 'Activer les métadonnées des emails',
      enabledHint:
        'Lorsque l\'option est désactivée, ces champs n\'apparaissent nulle part et l\'API les refuse ; les données déjà saisies sont conservées.',
      taxonomyAction: 'Gérer les typologies',
      taxonomyHint:
        'Les typologies d\'email se configurent dans Paramètres → Général → Typologies, indépendamment de cette option.',
    },
    snackbars: {
      invalid: 'Les réglages envoyés n\'ont pas été acceptés.',
      updated: 'Réglages Email Builder mis à jour',
      error: 'La mise à jour des réglages a échoué',
    },
  },
  taxonomy: {
    active: 'Actif',
    inactive: 'Inactif',
    title: 'Typologies d\'email',
    sidebarLabel: 'Typologies',
    description:
      'Vos typologies d\'email, dans vos mots. La définition que vous en donnez est ce qui compte : elle sert de référence à vos équipes, et de contexte à l\'IA. Les six typologies Badsender vous servent de socle : renommez-les, précisez-les, désactivez celles qui ne vous servent pas.',
    table: {
      label: 'Libellé',
      description: 'Définition',
      canonicalType: 'Correspondance IA',
      order: 'Ordre',
      isActive: 'Statut',
    },
    canonicalTypes: {
      editorial: 'Éditorial',
      promotional: 'Promotionnel',
      service: 'Serviciel',
      notification: 'Suivi',
      transactional: 'Transactionnel',
      institutional: 'Institutionnel',
    },
    form: {
      createTitle: 'Nouvelle typologie',
      editTitle: 'Modifier la typologie',
      label: 'Libellé',
      labelPlaceholder: 'Infolettre hebdomadaire',
      labelHint: 'Le nom que vos équipes utilisent réellement.',
      labelRequired: 'Le libellé est obligatoire',
      labelTooLong: 'Le libellé ne peut pas dépasser {max} caractères',
      description: 'Définition',
      descriptionPlaceholder:
        'Envoi du jeudi matin à toute la base, actualités et nouveautés produits.',
      descriptionHint:
        'À quoi sert cette typologie chez vous, et quand l\'utiliser. C\'est ce texte qui guidera l\'IA.',
      descriptionTooLong: 'La définition ne peut pas dépasser {max} caractères',
      canonicalType: 'Typologie IA correspondante',
      canonicalTypePlaceholder: 'Aucune',
      canonicalTypeHint:
        'Facultatif. Fait le lien avec le vocabulaire de l\'IA, pour charger la bonne expertise quel que soit le nom que vous avez choisi.',
      order: 'Ordre',
      orderHint: 'Ordre d\'affichage dans les listes.',
      status: 'Statut',
      isActive: 'Actif',
      isActiveHint:
        'Une typologie désactivée disparaît des listes de choix, mais les emails qui l\'utilisent la conservent.',
    },
    deleteConfirmTitle: 'Supprimer cette typologie ?',
    deleteConfirmMessage: 'La typologie « {label} » sera supprimée.',
    deleteConfirmHint:
      'Si des emails l\'utilisent, la suppression sera refusée : désactivez-la plutôt.',
    loadError: {
      title: 'Impossible de charger vos typologies',
      description:
        "La liste n'a pas pu être lue. Rien n'est perdu — réessayez.",
      action: 'Réessayer',
    },
    empty: {
      action: 'Créer une typologie',
      title: 'Aucune typologie pour le moment',
      description:
        'Créez les typologies dont vos équipes ont besoin : leur libellé et leur définition sont les vôtres.',
    },
    errors: {
      limitReached: 'Vous avez atteint le nombre maximum de typologies pour cette entreprise.',
      labelAlreadyExists: 'Une typologie porte déjà ce libellé.',
      inUse:
        'Cette typologie est utilisée par {count} email : désactivez-la plutôt que de la supprimer. | Cette typologie est utilisée par {count} emails : désactivez-la plutôt que de la supprimer.',
    },
    defaults: {
      action: 'Typologies par défaut',
      confirmTitle: 'Ajouter les typologies Badsender manquantes',
      confirmIntro:
        'Les typologies suivantes vont être créées. Vous pourrez ensuite les renommer, préciser leur définition ou les désactiver.',
      confirmNothing:
        'Vos typologies couvrent déjà les six types Badsender : il n\'y a rien à ajouter.',
      confirmSkipped:
        'Non créées, leur libellé est déjà utilisé par une de vos typologies : {labels}.',
      snackbarCreated:
        '{count} typologie créée | {count} typologies créées',
      snackbarNone: 'Aucune typologie à ajouter',
    },
    snackbars: {
      created: 'Typologie créée',
      updated: 'Typologie mise à jour',
      deleted: 'Typologie supprimée',
    },
  },
  feedMappings: {
    title: 'Flux de contenu',
    template: 'Template',
    block: 'Bloc',
    integration: 'Source du flux',
    active: 'Actif',
    add: 'Ajouter un mapping de flux',
    edit: 'Modifier le mapping de flux',
    created: 'Mapping de flux créé avec succès',
    updated: 'Mapping de flux mis à jour avec succès',
    deleted: 'Mapping de flux supprimé avec succès',
    noFeedMappings: 'Aucun flux de contenu configuré',
    loadingBlocks: 'Chargement des blocs...',
    noBlockFields:
      'Aucun champ mappable n\'a été trouvé pour ce bloc. Les items du flux ne peuvent pas y être mappés — choisissez un autre bloc.',
    columnCount: 'Nombre de colonnes',
    columnCountHint:
      'Pour les blocs multi-colonnes (ex: bloc articles sur 3 colonnes) — un mapping de champs par colonne',
    column: 'Colonne {n}',
    ctaDefaultLabel: 'Libellé par défaut du bouton CTA',
    ctaDefaultLabelHint:
      'Appliqué lors de l\'insertion d\'un item — reste modifiable ensuite dans l\'éditeur',
    deleteConfirmTitle: 'Supprimer le mapping de flux',
    deleteConfirmMessage:
      'Êtes-vous sûr de vouloir supprimer ce mapping de flux ?',
    fieldColumnHeader: 'Champ du bloc',
    roleColumnHeader: 'Correspond à',
    roleNone: '— Ignorer —',
    feedFields: {
      title: 'titre de l\'item (title)',
      link: 'lien de l\'item (link)',
      description: 'description de l\'item (description)',
      image: 'image de l\'item (image)',
      pubDate: 'date de publication (pubDate)',
      ctaLabel: 'libellé CTA par défaut (texte statique)',
    },
  },
  exportOptions: {
    title: 'Options d\'export',
    sections: {
      zipFormat: 'Format du fichier zip',
      zipFormatDescription: 'Configurez la structure du fichier zip téléchargé par les utilisateurs.',
      ftpHosting: 'Hébergement FTP/SFTP',
      ftpHostingDescription: 'Configurez un serveur FTP ou SFTP pour héberger automatiquement les images des emails.',
      cdnHosting: 'Hébergement CDN',
      cdnHostingDescription: 'Configurez un CDN personnalisé pour héberger les images des emails.',
    },
    cdnEndpointHint: 'URL de base de votre CDN (sans protocole)',
    cdnButtonLabelHint: 'Libellé affiché dans l\'éditeur',
  },
  retex: {
    title: 'Retour d\'expérience',
    description:
      'Avec un avis, l\'utilisateur peut joindre le résumé de sa session, pour aider l\'entreprise plateforme à améliorer ses expertises et skills. Il n\'est conservé que si l\'entreprise l\'autorise ici, et que l\'utilisateur l\'accepte à chaque fois.',
    alwaysShared:
      'La note et le commentaire des avis sont toujours partagés avec l\'entreprise plateforme, que le retour d\'expérience soit autorisé ou non.',
    offForgets:
      'Le désactiver efface les résumés de session déjà conservés, et raccourcit les commentaires des avis à 500 caractères, la longueur permise sans eux.',
    updated: 'Retour d\'expérience mis à jour',
  },
  oauthConsent: {
    claimedName: '« {client} »',
    title: 'Connecter {client} à LePatron',
    pageTitle: 'Connecter un assistant à LePatron',
    loginHint: 'Connectez-vous pour autoriser votre assistant IA à accéder à LePatron.',
    heading: '{client} demande l\'accès à votre compte LePatron',
    errorTitle: 'Connexion impossible',
    changeAccount: 'Changer de compte',
    switchAccount: 'Utiliser un autre compte',
    closeHint: 'Vous pouvez fermer cette fenêtre et relancer la connexion depuis votre assistant.',
    canDo: 'Cette application pourra',
    rights: {
      read: 'Lire les expertises, les skills et vos mailings',
      readHint: 'Avec vos droits, exactement comme dans l\'application.',
      readOnly: 'Rien modifier, publier ni supprimer',
      readOnlyHint:
        'Il peut seulement envoyer vos avis sur ce que LePatron vous a donné.',
    },
    registration: {
      dynamicTitle: 'Application non vérifiée',
      dynamic:
        'Elle s\'est enregistrée elle-même : LePatron ne peut pas garantir son nom. Ne continuez que si vous venez de lancer la connexion depuis elle.',
      dynamicBadge: 'Nom déclaré par l\'application',
      metadataDocument: 'Identité vérifiée par {host}',
      preRegistered: 'Déclarée par l\'entreprise {company}',
    },
    allowWrite: 'Proposer aussi des brouillons de skills et d\'expertises',
    allowWriteHint:
      'Réservé aux super admins. Seule une personne publie un brouillon. À ne cocher que pour un assistant de l\'entreprise plateforme.',
    group: 'Entreprise',
    groupHint:
      'L\'assistant ne verra que cette entreprise. Pour en lire une autre, connectez-le à nouveau.',
    pickGroup: 'Choisissez une entreprise',
    footnote:
      'Valable 90 jours, révocable à tout moment depuis Applications connectées. Après accord, vous serez renvoyé vers {host}.',
    allow: 'Autoriser',
    allowIn: 'Autoriser dans l\'entreprise {group}',
    deny: 'Refuser',
    expired:
      'Cette demande de connexion a expiré, ou a été lancée depuis un autre navigateur. Relancez la connexion depuis votre assistant.',
    clientOfAnotherCompany:
      'Cette application est réservée aux utilisateurs de l\'entreprise qui l\'a déclarée.',
    accountCannotConnect:
      'Ce compte ne peut pas connecter d\'assistant : connectez-vous avec votre compte utilisateur.',
    noAccess:
      'Votre entreprise n\'a pas l\'accès MCP : demandez à son administrateur de l\'activer.',
    signInRequired:
      'Votre session a expiré : reconnectez-vous à LePatron, puis relancez la connexion depuis votre assistant.',
    readScopeRequired:
      'L\'assistant doit au moins pouvoir lire LePatron : relancez la connexion depuis votre assistant.',
    noModule:
      'Le module MCP n\'est pas inclus dans l\'abonnement de votre entreprise : contactez l\'entreprise plateforme pour l\'ajouter.',
    noModuleCanOpen:
      'Le module MCP n\'est pas inclus dans l\'abonnement de l\'entreprise. En tant que super admin, vous pouvez l\'ouvrir dans ses Modules, puis activer son accès MCP.',
    noModuleCanOpenIn:
      'Le module MCP n\'est pas inclus dans l\'abonnement de l\'entreprise {group}. En tant que super admin, vous pouvez l\'ouvrir dans ses Modules, puis activer son accès MCP.',
    noAccessCanOpen:
      'L\'accès MCP de l\'entreprise est désactivé. En tant que super admin, vous pouvez l\'activer dans ses Fonctionnalités IA.',
    noAccessCanOpenIn:
      'L\'accès MCP de l\'entreprise {group} est désactivé. En tant que super admin, vous pouvez l\'activer dans ses Fonctionnalités IA.',
  },
  mcpClients: {
    pageTitle: 'Clients MCP',
    description:
      'Pour un assistant qui demande un identifiant et un secret, comme Copilot Studio en mode manuel. Seuls les utilisateurs de l\'entreprise peuvent se connecter avec. Claude, ChatGPT et Microsoft 365 Copilot s\'enregistrent seuls : ils n\'ont rien à faire ici.',
    listLabel: 'Clients enregistrés',
    clientMeta: 'Créé le {date} · envoi du secret : {authMethod}',
    clientIdLine: 'Identifiant : {id}',
    secretFootnote:
      'Le secret n\'est montré qu\'à la création. S\'il est perdu, supprimez le client et créez-en un autre.',
    mcpOff:
      'L\'accès MCP de l\'entreprise est coupé : ces clients ne peuvent pas se connecter. Il s\'active dans',
    add: 'Ajouter un client',
    addDescription:
      'Recopiez l\'URL de redirection que l\'assistant affiche dans son écran de configuration.',
    name: 'Nom',
    nameHint: 'Montré à l\'utilisateur sur l\'écran de consentement.',
    redirectUris: 'URL de redirection',
    redirectUrisHint: 'Une par ligne, en HTTPS, ou en HTTP vers localhost.',
    authMethod: 'Envoi du secret',
    authMethodHint:
      'Où l\'assistant envoie le secret à LePatron. Dans le doute, gardez « Dans le corps de la requête ».',
    advanced: 'Réglage avancé : envoi du secret',
    authMethods: {
      client_secret_post: 'Dans le corps de la requête',
      client_secret_basic: 'Dans l\'en-tête (Basic)',
    },
    empty: 'Aucun client enregistré',
    emptyHint:
      'C\'est le cas normal : seule une configuration manuelle de Copilot Studio en demande un.',
    loadError: 'Impossible de charger les clients MCP.',
    createdBadge: 'Client créé',
    createdTitle: 'Copiez ces valeurs dans « {name} »',
    secretOnce: 'Le secret ne sera plus jamais affiché.',
    serverOnPage: 'Les adresses du serveur restent disponibles sur cette page.',
    copySecretFirst: 'Copiez le secret, ou cochez la case, pour terminer',
    secretSavedConfirm: 'J\'ai enregistré ce secret',
    secretDone: 'Terminer',
    copyFailed:
      'La copie a échoué : sélectionnez la valeur et copiez-la à la main.',
    copyField: 'Copier : {field}',
    deleteNamed: 'Supprimer {name}',
    copy: 'Copier',
    copied: 'Copié',
    deleteTitle: 'Supprimer ce client ?',
    deleteConfirm:
      'L\'assistant « {name} » ne pourra plus se connecter ni renouveler ses connexions. Celles en cours s\'arrêtent aussitôt.',
    deleted: 'Client supprimé',
    serverTitle: 'Paramètres du serveur',
    serverDescription:
      'Ce que l\'écran de configuration de l\'assistant demande, en plus de l\'identifiant et du secret.',
    settings: {
      clientId: 'Identifiant client (client ID)',
      clientSecret: 'Secret client (client secret)',
      mcpUrl: 'URL du serveur MCP',
      authorizationUrl: 'URL d\'autorisation',
      tokenUrl: 'URL du token et de renouvellement',
      scope: 'Scope',
      scopeHint:
        'Lire, et envoyer les avis de l\'utilisateur. Proposer des brouillons de skills et d\'expertises (skills:write) n\'est accordé qu\'aux super admins, sur leur demande à la connexion.',
    },
    errors: {
      // The codes the API answers (ERROR_CODES.MCP_CLIENT_…).
      MCP_CLIENT_INVALID_NAME: 'Donnez un nom de 1 à 100 caractères.',
      MCP_CLIENT_INVALID_REDIRECT_URIS:
        'Indiquez de 1 à 10 adresses de redirection, en HTTPS ou vers la machine de l\'utilisateur.',
      MCP_CLIENT_INVALID_AUTH_METHOD:
        'Choisissez comment l\'assistant envoie le secret.',
      MCP_CLIENT_INVALID_METADATA:
        'LePatron refuserait ce client à sa connexion : vérifiez ses adresses de redirection.',
      MCP_CLIENT_NOT_FOUND: 'Ce client n\'existe plus.',
      MCP_FORBIDDEN_COMPANY:
        'Vous ne gérez pas les clients MCP de cette entreprise.',
      nameTooLong: 'Le nom fait au plus 100 caractères.',
      redirectUrisRequired: 'Au moins une URL de redirection est requise.',
      redirectUrisInvalid:
        'Jusqu\'à 10 URL, en HTTPS (HTTP seulement vers localhost), sans fragment #.',
      redirectUriRefused:
        '« {uri} » est refusée : une URL de redirection est en HTTPS, ou en HTTP vers localhost, sans fragment #.',
    },
  },
  connectedApplications: {
    pageTitle: 'Applications connectées',
    description:
      'Les assistants IA que vous avez connectés à LePatron. Chacun lit LePatron avec vos droits, dans l\'entreprise choisie à la connexion. Une ligne par connexion : un assistant connecté depuis deux machines apparaît deux fois. Révoquez celles que vous n\'utilisez plus.',
    name: 'Application',
    group: 'Entreprise',
    connectedAt: 'Connectée le',
    lastUsedAt: 'Dernière utilisation',
    neverUsed: 'Jamais utilisée',
    empty: 'Aucune application connectée.',
    loadError: 'Impossible de charger vos applications connectées.',
    revoke: 'Révoquer',
    revokeOne: 'Révoquer {name}, connectée le {date}',
    revokeTitle: 'Révoquer cette connexion\u00a0?',
    revokeConfirm:
      'La connexion de « {name} » du {date} perdra aussitôt son accès à LePatron pour l\'entreprise {group}. Vos autres connexions de cette application restent. Pour l\'utiliser à nouveau ici, il faudra la reconnecter.',
    revoked: 'Connexion révoquée',
    groupCount:
      'Aucune connexion d\'assistant IA | 1 connexion d\'assistant IA | {count} connexions d\'assistants IA',
    groupRevoke: 'Tout révoquer',
    groupRevokeTitle: 'Révoquer toutes les connexions d\'assistants IA\u00a0?',
    groupRevokeConfirm:
      'Les connexions d\'assistants IA de l\'entreprise {group} perdent aussitôt leur accès. Chaque utilisateur devra reconnecter son assistant. | La connexion d\'assistant IA de l\'entreprise {group} perd aussitôt son accès. Son utilisateur devra la reconnecter. | Les {count} connexions d\'assistants IA de l\'entreprise {group} perdent aussitôt leur accès. Chaque utilisateur devra reconnecter les siennes.',
    groupCountError: 'Nombre de connexions d\'assistants IA indisponible.',
    groupRevoked: 'Connexions d\'assistants IA révoquées',
    allGroups: 'Toutes',
    noModule:
      'Le module MCP n\'est pas inclus dans l\'abonnement de l\'entreprise {group} : aucun assistant ne peut s\'y connecter.',
    accessOff:
      'L\'accès MCP est désactivé pour l\'entreprise {group} : aucun assistant ne peut s\'y connecter, et ses connexions ont été coupées à sa désactivation.',
    errors: {
      MCP_CONNECTION_NOT_FOUND:
        'Cette connexion n\'existe plus : elle a déjà été révoquée.',
    },
  },
  mcpAccess: {
    title: 'Accès MCP',
    description:
      'Vos utilisateurs connectent Claude, ChatGPT ou Copilot à LePatron. L\'assistant lit avec leurs droits, dans cette entreprise seulement.',
    switch: 'Autoriser la connexion des assistants IA',
    on: 'Activé',
    off: 'Désactivé',
    address: 'Adresse à donner à vos utilisateurs',
    addressHint:
      'Ils la collent dans les connecteurs de leur assistant, puis se connectent avec leur compte LePatron.',
    step1: 'Vous activez l\'accès pour l\'entreprise.',
    step2: 'Chaque utilisateur connecte son assistant, avec son propre compte.',
    step3: 'L\'assistant lit expertises, skills et mailings, sans modifier vos mailings.',
    copyAddress: 'Copier l\'adresse du serveur MCP',
    clientsTitle: 'Clients enregistrés à la main',
    clientsDescription:
      'Seul Copilot Studio en mode manuel en a besoin : Claude, ChatGPT et Microsoft 365 Copilot s\'enregistrent seuls.',
    manageClients: 'Gérer',
    turnOff: 'Couper l\'accès',
    notIncluded: 'Non inclus',
    noModule:
      'Le module MCP n\'est pas inclus dans l\'abonnement de l\'entreprise {group}. Contactez l\'entreprise plateforme pour l\'ajouter.',
    moduleMissing:
      'Le module MCP n\'est pas inclus dans l\'abonnement de l\'entreprise {group}.',
    openModule: 'Ouvrir le module',
    offTitle: 'Couper l\'accès MCP ?',
    offConfirm:
      'Tous les assistants connectés aux comptes de l\'entreprise {group} seront déconnectés tout de suite. Le réactiver ne les reconnectera pas : chaque utilisateur devra connecter le sien à nouveau.',
    updated: 'Accès MCP mis à jour',
  },
  crmIntelligence: {
    title: 'CRM Intelligence',
    subtitle: 'Tableaux de bord analytiques',
    dashboards: 'Tableaux de bord',
    selectDashboard: 'Sélectionnez un tableau de bord dans le menu de gauche pour commencer.',
    noDashboards: 'Aucun tableau de bord disponible',
    loadingDashboard: 'Chargement du tableau de bord...',
    marketing: {
      title: 'CRM Intelligence',
      subtitle: 'Centralisez vos KPIs CRM et Marketing dans LePatron. Visualisez vos performances en temps réel.',
      ctaPrimary: 'Demander une démo',
      ctaSecondary: 'En savoir plus',
      featuresTitle: 'Pilotez votre stratégie data-driven',
      features: [
        {
          icon: 'area-chart',
          title: 'Performance campagnes',
          description: 'Suivez les métriques clés de vos envois email en temps réel.',
        },
        {
          icon: 'mail-check',
          title: 'Délivrabilité',
          description: 'Analysez vos taux de délivrabilité et identifiez les problèmes.',
        },
        {
          icon: 'heart-handshake',
          title: 'Engagement client',
          description: 'Mesurez l\'engagement de vos audiences sur tous les canaux.',
        },
        {
          icon: 'euro',
          title: 'ROI Marketing',
          description: 'Calculez le retour sur investissement de vos campagnes.',
        },
        {
          icon: 'layout-dashboard',
          title: 'Dashboards personnalisés',
          description: 'Créez des tableaux de bord adaptés à vos besoins métier.',
        },
        {
          icon: 'database',
          title: 'Intégration Metabase',
          description: 'Connectez vos sources de données via Metabase.',
        },
      ],
      footerCta: 'Prêt à piloter votre performance ?',
      screenshotAlt: 'Aperçu CRM Intelligence',
    },
    errors: {
      loadFailed: 'Impossible de charger le tableau de bord.',
      embedFailed: 'Erreur lors du chargement du tableau de bord.',
      dashboardAlreadyExists: 'Un tableau de bord avec cet ID existe déjà pour cette intégration.',
      fetchIntegrationsFailed: 'Impossible de charger les intégrations.',
      fetchDashboardsFailed: 'Impossible de charger les tableaux de bord.',
    },
    admin: {
      title: 'CRM Intelligence',
      description: 'Gérez les intégrations de tableaux de bord pour cette entreprise.',
      enabled: 'Activer CRM Intelligence',
      metabaseConfigHint: 'Configurez les connexions Metabase dans l\'onglet Intégrations.',
      goToIntegrations: 'Aller aux Intégrations',
      metabaseConfig: 'Configuration Metabase',
      siteUrl: 'URL Metabase',
      invalidUrl: 'URL invalide',
      siteUrlHint: 'Ex: https://metabase.example.com',
      secretKey: 'Clé secrète d\'embedding',
      secretKeyHint: 'Trouvez cette clé dans Admin > Embedding > Static embedding',
      secretKeyHintEdit: 'Laissez vide pour conserver la clé actuelle',
      testConnection: 'Tester la connexion',
      testConnectionSuccess: 'Configuration valide',
      testConnectionFailed: 'Configuration invalide',
      // Integrations section
      integrationsSection: 'Intégrations',
      integrationsSectionHint: 'Configurez les connexions aux outils de dashboarding (Metabase, etc.)',
      integrations: 'Intégrations',
      addIntegration: 'Ajouter une intégration',
      editIntegration: 'Modifier l\'intégration',
      integrationName: 'Nom de l\'intégration',
      noIntegrations: 'Aucune intégration configurée',
      createSuccess: 'Intégration créée',
      deleteSuccess: 'Intégration supprimée',
      deleteError: 'Erreur lors de la suppression',
      deleteIntegrationConfirmTitle: 'Supprimer l\'intégration ?',
      deleteIntegrationConfirmText: 'Cette action est irréversible. Les tableaux de bord associés ne fonctionneront plus.',
      saveSuccess: 'Configuration sauvegardée',
      saveError: 'Erreur lors de la sauvegarde',
      // Dashboards section
      dashboardsSection: 'Tableaux de bord',
      dashboardsSectionHint: 'Configurez les dashboards affichés aux utilisateurs et leur ordre d\'apparition.',
      dashboards: 'Tableaux de bord',
      addDashboard: 'Ajouter un tableau de bord',
      editDashboard: 'Modifier le tableau de bord',
      selectIntegration: 'Intégration',
      integrationRequired: 'Veuillez sélectionner une intégration',
      dashboardId: 'ID du dashboard',
      dashboardIdHint: 'Numéro visible dans l\'URL Metabase',
      dashboardIdRequired: 'L\'ID du dashboard est requis',
      dashboardName: 'Nom affiché',
      dashboardNameRequired: 'Le nom est requis',
      dashboardDescription: 'Description',
      dashboardDescriptionPlaceholder: 'Description optionnelle du tableau de bord',
      noDashboards: 'Aucun tableau de bord configuré',
      noIntegrationsForDashboards: 'Créez d\'abord une intégration pour ajouter des tableaux de bord.',
      dashboardSaveSuccess: 'Tableau de bord sauvegardé',
      dashboardCreateSuccess: 'Tableau de bord créé',
      dashboardSaveError: 'Erreur lors de la sauvegarde du tableau de bord',
      dashboardDeleteSuccess: 'Tableau de bord supprimé',
      dashboardDeleteError: 'Erreur lors de la suppression du tableau de bord',
      deleteDashboardConfirmTitle: 'Supprimer le tableau de bord ?',
      deleteDashboardConfirmText: 'Cette action est irréversible.',
      deleteDashboardConfirmTextWithName: 'Voulez-vous vraiment supprimer le tableau de bord « {name} » ? Cette action est irréversible.',
      reorderError: 'Erreur lors du réordonnancement',
      moveUp: 'Monter',
      moveDown: 'Descendre',
    },
  },
  modules: {
    emailBuilder: 'Email Builder',
    crmIntelligence: 'CRM Intelligence',
    settings: 'Paramètres',
    inactive: 'Non activé',
  },
  emailBuilder: {
    marketing: {
      title: 'Email Builder',
      subtitle:
        'Créez des emails responsives professionnels avec notre éditeur drag & drop intuitif.',
      ctaPrimary: 'Demander une démo',
      ctaSecondary: 'En savoir plus',
      featuresTitle: 'Tout ce dont vous avez besoin',
      features: [
        {
          icon: 'grip-vertical',
          title: 'Drag & Drop intuitif',
          description: 'Construisez vos emails visuellement, sans aucune ligne de code.',
        },
        {
          icon: 'smartphone',
          title: 'Responsive natif',
          description: 'Emails optimisés pour tous les appareils et clients email.',
        },
        {
          icon: 'puzzle',
          title: 'Blocs réutilisables',
          description: 'Créez une bibliothèque de composants pour vos équipes.',
        },
        {
          icon: 'palette',
          title: 'Design system intégré',
          description: 'Respectez votre charte graphique avec des templates personnalisés.',
        },
        {
          icon: 'cloud-upload',
          title: 'Export multi-ESP',
          description: 'Exportez vers Sendinblue, Mailchimp, Actito et bien d\'autres.',
        },
        {
          icon: 'users',
          title: 'Collaboration équipe',
          description: 'Travaillez à plusieurs avec gestion des droits et workspaces.',
        },
      ],
      footerCta: 'Prêt à créer vos premiers emails ?',
      screenshotAlt: 'Interface Email Builder',
    },
  },
  sidebar: {
    modules: {
      emailBuilder: 'Email Builder',
      crmIntelligence: 'CRM Intelligence',
      deliverability: 'Délivrabilité',
      designSystem: 'Design System',
      aiStudio: 'AI Studio',
    },
    system: {
      settings: 'Paramètres',
      connectedApplications: 'Applications connectées',
      help: 'Aide',
      logout: 'Se déconnecter',
    },
    aria: {
      closeNavigation: 'Fermer la navigation',
      breadcrumb: 'Fil d\'Ariane',
      moreActions: 'Plus d\'actions',
    },
    settingsHeader: 'Paramètres',
    utilities: 'Utilitaires',
    collapse: 'Réduire la barre latérale',
    expand: 'Développer la barre latérale',
    resizeHandle:
      'Redimensionner la barre latérale (utilisez les flèches, Shift pour de plus grands pas, Début/Fin pour min/max)',
    selectModule: 'Sélectionnez un module pour commencer',
    moduleLockedLabel: '{module} (verrouillé - mise à niveau requise)',
    upgradeRequired: 'Mise à niveau requise',
    upgradeMessage: 'Le module {module} n\'est pas inclus dans votre plan actuel.',
    contactAdmin: 'Veuillez contacter votre administrateur ou Badsender pour activer cette fonctionnalité.',
    contactBadsender: 'Contacter Badsender',
  },
  superAdmins: {
    pageTitle: 'Super administrateurs',
    add: 'Ajouter un super administrateur',
    addDescription:
      'Le compte est créé dans l\'entreprise plateforme. Envoyez-lui ensuite l\'email de mot de passe depuis sa ligne, comme pour tout nouveau compte.',
    promote: 'Promouvoir un membre',
    promoteAction: 'Promouvoir',
    promoteDescription:
      'Choisissez un membre de l\'entreprise plateforme : il deviendra super administrateur en gardant son compte. Comme tout super administrateur, il aura tous les droits sur chaque entreprise, et travaillera dans Email Builder et CRM Intelligence sur l\'entreprise qu\'il sélectionne.',
    promoted: 'Super administrateur promu',
    member: 'Membre',
    noMember: 'Aucun membre de l\'entreprise plateforme à promouvoir.',
    noPlatformGroup:
      'Aucune entreprise plateforme n\'est configurée sur cet environnement : aucun super administrateur ne peut être créé.',
    demote: {
      title: 'Retirer le rôle de super administrateur',
      action: 'Retirer le rôle',
      notice:
        'Ce compte ne sera plus super administrateur. Êtes-vous sûr de vouloir retirer le rôle de',
    },
    loadError:
      'Impossible de charger les super administrateurs. Rechargez la page.',
    errors: {
      FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE:
        'Seul un super administrateur peut attribuer ou retirer ce rôle.',
      FORBIDDEN_ROLE_GRANT:
        'Vous ne pouvez pas attribuer un rôle qui a plus de droits que le vôtre.',
      FORBIDDEN_USER_MANAGEMENT:
        'Vous ne pouvez pas gérer un compte qui a plus de droits que le vôtre.',
      FORBIDDEN_SUPER_ADMIN_MANAGEMENT:
        'Seul un super administrateur peut gérer un super administrateur.',
      FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION:
        'Vous ne pouvez pas retirer votre propre rôle de super administrateur.',
      FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION:
        'Vous ne pouvez pas désactiver votre propre compte.',
      SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP:
        'Un super administrateur doit appartenir à l\'entreprise plateforme.',
      PLATFORM_GROUP_NOT_FOUND:
        'Aucune entreprise plateforme n\'est configurée sur cet environnement.',
      PLATFORM_GROUP_HAS_SUPER_ADMINS:
        'Cette entreprise héberge des super administrateurs actifs. Pour déplacer le rôle plateforme, activez-le sur une autre entreprise avec le compte administrateur de la configuration : ils le suivront. Pour le retirer, ce compte doit d\'abord les désactiver ou les rétrograder.',
      INVALID_ROLE_PARAM: 'Ce rôle n\'existe pas.',
    },
  },
  settingsNav: {
    categories: {
      superAdmin: 'Super administrateur',
      general: 'Général',
      emailBuilder: 'Email Builder',
      crmIntelligence: 'CRM Intelligence',
    },
    companiesList: 'Liste des entreprises',
    companiesEmpty: 'Aucune entreprise pour le moment',
    superAdminOnly: 'Super administrateur uniquement',
    switchCompany: 'Choisir une entreprise…',
    selectedGroup: 'Entreprise sélectionnée : {name}',
    selectionFailed: 'Impossible de sélectionner cette entreprise. Réessayez.',
    colors: 'Couleurs',
  },
  aiFeatures: {
    title: 'Fonctionnalités IA',
    selectIntegration: 'Intégration à utiliser',
    noIntegration: '-- Aucune intégration --',
    noIntegrationsWarning: 'Aucune intégration IA configurée. Ajoutez d\'abord une intégration dans l\'onglet Intégrations.',
    integrationInactiveWarning: 'L\'intégration sélectionnée est inactive. Activez-la pour utiliser cette fonctionnalité.',
    comingSoon: 'Bientôt disponible',
    upcomingFeatures: 'Fonctionnalités à venir',
    upcomingFeaturesDescription: 'Découvrez les prochaines fonctionnalités IA en cours de développement.',
    translation: {
      title: 'Traduction',
      description: 'Traduisez automatiquement vos emails dans différentes langues grâce à l\'IA.',
      enableLabel: 'Activer la traduction',
      on: 'Activée',
      off: 'Désactivée',
      model: 'Modèle IA',
      modelHint: 'Les modèles plus puissants sont plus précis mais plus lents et coûteux',
      availableLanguages: 'Langues disponibles',
      languagesHint: 'Sélectionnez au moins 2 langues (source et cible)',
      languagesSelected: '{count} langue sélectionnée | {count} langues sélectionnées',
      minLanguagesError: 'Sélectionnez au moins 2 langues (une source et une cible)',
      formality: 'Niveau de formalité',
      formalityHint: 'Appliqué aux langues cibles qui distinguent les registres (vouvoiement, tutoiement…). Les autres restent en ton neutre.',
      formalityDefault: 'Par défaut',
      formalityMore: 'Formel',
      formalityLess: 'Informel'
    },
    skill: {
      title: 'Moteur Skills',
      description: 'Le modèle qui exécute les skills dans LePatron (éditeur, Playground). Un assistant connecté utilise son propre modèle.',
      enableLabel: 'Activer le moteur Skills',
      on: 'Activé',
      off: 'Désactivé',
      model: 'Modèle IA',
      modelHint: 'Les modèles plus puissants sont plus précis mais plus lents et coûteux',
    },
    model: {
      defaultOption: 'Par défaut du fournisseur ({model})',
      defaultOptionUnknown: 'Par défaut du fournisseur',
      requiredPlaceholder: 'Saisissez ou choisissez un modèle',
      required: 'Ce fournisseur n\'a pas de modèle par défaut : choisissez-en un, sans quoi les appels échoueront.',
      deprecated: 'obsolète',
      invalidId: 'Non enregistré : un identifiant de modèle accepte uniquement lettres, chiffres et . _ - : / @, sans espace.',
      customHint: 'Modèle saisi manuellement : il n\'a pas été vérifié auprès du fournisseur.',
      loadFailed: 'Liste des modèles indisponible : seuls les modèles connus sont proposés. Vous pouvez saisir un identifiant.',
    },
    textGeneration: {
      title: 'Génération de texte',
      description: 'Générez du contenu marketing personnalisé pour vos emails.'
    },
    qualityCheck: {
      title: 'Contrôle qualité',
      description: 'Vérifiez automatiquement la qualité et la cohérence de vos emails.'
    }
  },
  colors: {
    palette: 'Palette de couleurs',
    paletteDescription: 'Ces couleurs seront proposées dans le sélecteur de couleurs de l\'éditeur d\'email pour tous les utilisateurs de cette entreprise.',
    addColor: 'Ajouter',
    removeColor: 'Supprimer cette couleur',
    hint: '{count}/21 couleurs • Cliquez sur une couleur pour la modifier',
  },
  templates: {
    noTemplates: 'Aucun template pour le moment',
    deleteConfirmTitle: 'Supprimer le template ?',
    deleteWarningMessage: 'Êtes-vous sûr de vouloir supprimer le template <strong>{name}</strong> ? Cette action est irréversible.',
    confirmationField: 'Tapez le nom du template pour confirmer',
    newTemplate: 'Nouveau template',
    generalInfo: 'Informations générales',
    generalInfoDescription: 'Nom et description du template',
    templateFiles: 'Fichiers du template',
    templateFilesDescription: 'Uploadez le markup HTML et les images associées',
    markup: 'Markup (fichier HTML)',
    markupUploaded: 'Markup uploadé',
    dropMarkupHere: 'Glissez un fichier ici ou cliquez pour sélectionner',
    markupFormats: 'Format accepté : .html',
    invalidMarkupFormat: 'Format invalide. Veuillez uploader un fichier HTML.',
    dropImagesHere: 'Glissez des images ici ou cliquez pour sélectionner',
    imageFormats: 'Formats acceptés : PNG, JPG, GIF, WEBP',
    existingImages: '{count} images uploadées',
    newImages: '{count} nouvelles images à uploader',
    removeAllImages: 'Supprimer tout',
    imagesRemoved: 'Images supprimées avec succès',
    previewDescription: 'Aperçu du template rendu',
    regeneratePreview: 'Régénérer l\'aperçu',
    filesAvailableAfterCreation: 'Vous pourrez uploader le markup HTML et les images après la création du template.',
    advancedOptions: 'Options avancées',
    advancedOptionsDescription: 'Fonctionnalités activables template par template',
    htmlBlock: {
      name: 'Bloc Code HTML',
      description: 'Permet de coller du code HTML libre entre deux blocs du template.',
      hint: 'Le bloc apparaîtra en fin de palette dans l\'éditeur.',
    },
    blockBuilder: {
      name: 'Composer un bloc',
      description:
        'Permet de composer un bloc visuellement. C\'est LePatron qui écrit le HTML.',
      hint: 'Le bloc apparaîtra en fin de palette dans l\'éditeur.',
    },
  },
  skillsImport: {
    open: 'Importer',
    title: 'Importer des skills et expertises',
    file: 'Export de skills (.json)',
    fileHint: 'Un fichier exporté d\'une autre instance LePatron, 5 Mo au plus.',
    preview: 'Voir l\'aperçu',
    from: 'Exporté de {origin} par {by}, le {date}.',
    counter: '{count} élément à importer | {count} éléments à importer',
    nothing: 'Rien à importer : tout est à jour ou bloqué.',
    otherFile: 'Choisir un autre fichier',
    current: 'ici : {version}',
    notJson: 'Ce fichier n\'est pas du JSON.',
    tooLarge: 'Ce fichier dépasse 5 Mo.',
    unreadable: 'Ce fichier n\'est pas un export de skills lisible : {message}',
    run: 'Importer la sélection',
    report: {
      created: '{count} créé | {count} créés',
      updated: '{count} mis à jour | {count} mis à jour',
      skipped: '{count} ignoré | {count} ignorés',
      failed: '{count} en échec | {count} en échec',
      publish: 'Ces brouillons attendent d\'être relus et publiés :',
      nothing: 'Aucun brouillon n\'a été écrit.',
      failedItem: '{id} : {message}',
      skippedItem: '{id} : {reason}',
    },
    importFailed: 'L\'import a échoué : {message}',
    kinds: {
      expertise: 'Expertise',
      skill: 'Skill',
    },
    states: {
      new: 'Nouveau',
      update: 'Mise à jour',
      up_to_date: 'À jour',
      blocked: 'Bloqué',
    },
    reasons: {
      diverged: 'Même version, contenu différent : les deux instances ont divergé.',
      target_newer: 'Une version plus récente existe ici.',
      draft_open: 'Un brouillon est ouvert ici : publiez-le ou supprimez-le d\'abord.',
      archived: 'Archivé ici.',
      version_exists: 'Cette version existe déjà ici, sans être la version active.',
      missing_schema: 'Son schéma n\'existe pas sur cette instance : elle n\'est pas à jour.',
      not_in_file: 'Absent du fichier importé.',
    },
    warnings: {
      missing_expertises: 'Expertises absentes ici et du fichier : {ids}',
      nature_differs: 'Autre nature ici : la version importée sera un brouillon « {nature} », et la publier changera la nature de ce skill.',
    },
  },
  aiSkills: {
    export: {
      all: 'Tout exporter',
      selection: 'Exporter la sélection',
      selected: '{count} élément sélectionné | {count} éléments sélectionnés',
      consumed: 'Avec les expertises que consomment ces skills :',
      remove: 'Retirer {id} de l\'export',
      done: 'Export téléchargé.',
      failed: 'L\'export a échoué.',
      failedBecause: 'L\'export a échoué : {reason}',
    },
    follow: {
      title: 'Origine sur cette copie',
      description:
        'Cette instance est une copie : elle suit les skills et expertises de la production, telles que les clients les vivent. Le travail fait ici n\'est jamais perdu : quand le suivi doit le remplacer, il le met en brouillon dans un nouvel élément de la copie.',
      production: 'Production : {origin}',
      now: 'Suivre maintenant',
      running: 'Suivi en cours…',
      never: 'La production n\'a encore jamais été suivie.',
      last: 'Dernier suivi le {date} par {by}',
      lastNight: 'Dernier suivi le {date}, par le suivi de nuit',
      nightlyOn: 'Le suivi de nuit est actif sur cette instance.',
      nightlyOff:
        'Le suivi de nuit n\'est pas actif sur cette instance : seul le bouton suit la production.',
      lock: 'Un suivi est en cours depuis le {date}, lancé par {by}.',
      lockNight: 'Le suivi de nuit est en cours depuis le {date}.',
      alreadyRunning:
        'Un suivi est déjà en cours : attendez qu\'il se termine pour en lancer un autre.',
      loadError: 'Le suivi de la production n\'a pas pu être chargé.',
      done: 'Production suivie.',
      donePartial:
        'Production suivie en partie : certains éléments sont en échec.',
      partialHint:
        'Certains éléments n\'ont pas pu être écrits ; les autres ont suivi la production.',
      statuses: {
        succeeded: 'Réussi',
        partial: 'Réussi en partie',
        failed: 'Échoué',
      },
      outcomes: {
        created: '{count} élément ajouté | {count} éléments ajoutés',
        updated: '{count} élément mis à jour | {count} éléments mis à jour',
        moved:
          '{count} travail de la copie mis de côté | {count} travaux de la copie mis de côté',
        removedDrafts: '{count} brouillon supprimé | {count} brouillons supprimés',
        removed: '{count} élément supprimé | {count} éléments supprimés',
        upToDate: '{count} élément déjà à jour | {count} éléments déjà à jour',
        kept:
          '{count} élément gardé sur cette copie | {count} éléments gardés sur cette copie',
        failed: '{count} élément en échec | {count} éléments en échec',
      },
      movedLabel: 'Travail de la copie mis de côté',
      moved: '« {id} » : le travail fait sur la copie est en brouillon dans',
      keptLabel: 'Gardés sur cette copie',
      productionChanged: 'la production a changé',
      removedLabel: 'Supprimés : la production ne les a plus',
      removedDraft: 'brouillon {version} de « {id} » supprimé',
      removedItem: '« {id} » supprimé',
      warningsLabel: 'À vérifier',
      warnings: {
        missing_expertises:
          '« {id} » consomme des expertises absentes de cette copie : {ids}.',
        other: '« {id} » est à vérifier.',
      },
      itemFailed: 'Cet élément n\'a pas pu être écrit.',
      failuresLabel: 'Éléments en échec',
      nothingWritten: 'Rien n\'a été écrit.',
      reasons: {
        not_configured:
          'Cette instance n\'est configurée pour suivre aucune production.',
        invalid_address:
          'L\'adresse de la production n\'est pas une adresse https valide.',
        unreachable: 'La production n\'a pas pu être jointe.',
        token_refused:
          'La production a refusé le jeton de lecture : il a peut-être été révoqué.',
        production_error: 'La production a répondu par une erreur.',
        unreadable:
          'La réponse de la production n\'a pas pu être lue : les deux instances n\'ont peut-être pas la même version de LePatron.',
      },
    },
    readTokens: {
      title: 'Jetons de lecture',
      description:
        'Une copie (recette, développement) suit les skills et expertises de cette instance avec un jeton de lecture. Un jeton ne lit rien d\'autre.',
      descriptionOnCopy:
        'Cette instance est une copie : les jetons de lecture se créent sur la production. Révoquez ici ceux qui restent.',
      listLabel: 'Jetons de lecture actifs',
      add: 'Créer un jeton',
      addDescription:
        'Un jeton par copie : vous pourrez révoquer celle que vous retirez sans toucher aux autres.',
      name: 'Nom',
      nameHint: 'La copie qu\'il sert, par exemple « Recette ».',
      nameTooLong: 'Le nom compte 100 caractères au plus.',
      meta: 'Créé le {date} · {lastUse}',
      lastUsed: 'dernière utilisation le {date}',
      neverUsed: 'jamais utilisé',
      empty: 'Aucun jeton de lecture.',
      emptyHint:
        'Créez-en un pour chaque copie qui suit les skills et expertises de cette instance.',
      emptyOnCopy: 'Une copie ne sert de source à aucune autre instance.',
      footnote:
        'Le jeton n\'est montré qu\'à la création. S\'il est perdu, révoquez-le et créez-en un autre.',
      createdBadge: 'Jeton créé',
      createdTitle: 'Le jeton « {name} »',
      token: 'Jeton',
      copy: 'Copier',
      copied: 'Copié',
      copyToken: 'Copier le jeton',
      once: 'Ce jeton ne sera plus affiché : copiez-le maintenant dans la configuration de la copie.',
      copyFirst: 'Copiez le jeton, ou cochez la case, pour terminer.',
      copyFailed:
        'La copie a échoué : sélectionnez le jeton et copiez-le à la main.',
      savedConfirm: 'J\'ai enregistré ce jeton',
      saved: 'J\'ai enregistré le jeton',
      revoke: 'Révoquer',
      revokeNamed: 'Révoquer le jeton « {name} »',
      revokeTitle: 'Révoquer ce jeton ?',
      revokeConfirm:
        'La copie qui utilise « {name} » ne pourra plus lire cette instance. Un jeton révoqué ne se rétablit pas.',
      revoked: 'Jeton révoqué.',
      loadError: 'Les jetons de lecture n\'ont pas pu être chargés.',
    },
    copy: {
      panelLabel: 'Origine sur cette copie',
      origins: {
        followed: 'Suit la production',
        followedHint: 'Le suivi de la production le garde égal à la production.',
        kept: 'Gardé sur cette copie',
        keptHint:
          'Le suivi ne le touche plus : il signale seulement que la production a changé.',
        local: 'Écrit sur cette copie',
        localHint:
          'Le suivi le laisse tel quel, sauf si la production a un élément du même identifiant : il le reprend alors, et le travail de la copie part dans un élément à part.',
        notFollowed: 'Pas encore suivi',
        notFollowedHint:
          'Cette copie n\'a pas encore suivi la production : au premier suivi, un élément du même identifiant en production le reprendra.',
        copied: 'Travail de la copie',
        copiedHint:
          'Le travail fait sur cette copie, mis de côté d\'un autre élément : le suivi le laisse tel quel.',
      },
      openOrigin: 'Ouvrir l\'élément d\'origine « {id} »',
      explain: {
        followed:
          'Le suivi le garde égal à la production. Ce qui est écrit ici part, au suivi suivant, dans un nouvel élément « (travail de la copie) ».',
        kept: 'Le suivi ne le touche plus : il signale seulement que la production a changé.',
        local:
          'Le suivi le laisse tel quel, sauf si la production a un élément du même identifiant : il le reprend alors, et le travail de la copie part dans un élément à part, « (travail de la copie) ».',
        notFollowed:
          'Cette copie n\'a pas encore suivi la production. Au premier suivi, si la production a un élément du même identifiant, le suivi le reprend, et le travail de la copie part dans un élément à part, « (travail de la copie) ».',
        copied:
          'Le travail fait sur cette copie, d\'après l\'élément lié. Le suivi le laisse tel quel.',
      },
      keep: 'Garder sur cette copie',
      keptDone: 'Gardé sur cette copie : le suivi ne le touche plus.',
      publishKept:
        'Cochée, le suivi ne touchera plus cet élément : il signalera seulement que la production a changé.',
      publishFollowed:
        'Décochée, l\'élément suit toujours la production : au prochain suivi, la version publiée ici part dans un nouvel élément « (travail de la copie) », en brouillon, sauf si la production publie la même.',
      publishLocal:
        'Décochée, le suivi laisse cet élément tel quel tant que la production n\'a pas d\'élément du même identifiant ; si elle en a un, la version publiée ici part dans un nouvel élément « (travail de la copie) », en brouillon.',
      follow: 'Suivre la production',
      followTitle: 'Suivre de nouveau la production ?',
      followConfirm:
        'Au prochain suivi, cet élément redevient celui de la production. Ce qui a été écrit ici, brouillon ou version publiée, part en brouillon dans un nouvel élément de la copie : rien n\'est perdu.',
      followDone: 'Cet élément suivra la production au prochain suivi.',
      duplicate: 'Dupliquer sur cette copie',
      duplicateHint:
        'Crée un élément de cette copie, avec le contenu de la version choisie en brouillon, réservé à l\'entreprise plateforme et non servi aux assistants. Le suivi le laisse tel quel.',
      duplicateVersion: 'Version',
      duplicateSubmit: 'Dupliquer',
      duplicateDone: 'Élément dupliqué sur cette copie.',
    },
    feedback: {
      tab: 'Avis',
      caption:
        'Les avis envoyés depuis les assistants IA connectés, avec la version lue et, quand l\'entreprise et l\'utilisateur l\'ont accepté, le retour d\'expérience de la session.',
      empty: 'Aucun avis pour l\'instant.',
      up: 'Avis positif',
      down: 'Avis négatif',
      noComment: 'Sans commentaire',
      shown: '{shown} sur {total}',
      more: 'Afficher plus',
      retex: 'Retour d\'expérience',
    },
    nature: 'Nature',
    natureHint:
      'Un Skill de fonctionnalité est appelé par LePatron (modèle, schémas, contrat de sortie). Un Skill de tâche est une procédure qu\'un assistant IA suit. Le Skill a la nature de sa version publiée : pour en changer, publiez une version de l\'autre nature.',
    natures: {
      feature: 'Skill de fonctionnalité',
      task: 'Skill de tâche',
    },
    servedToAssistants: 'Proposé aux assistants IA',
    servedToAssistantsHint:
      'Servi via MCP aux assistants connectés, sans son contrat de sortie. À laisser décoché pour un Skill dont l\'entrée est construite par l\'éditeur.',
    audience: 'Audience',
    audienceHint:
      'Qui peut s\'en servir. Une nouvelle fiche reste réservée à l\'entreprise plateforme le temps de l\'éprouver : ouvrez-la ensuite à toutes les entreprises.',
    audiences: {
      expertise: {
        platform: 'Entreprise plateforme uniquement (en test)',
        all:
          'Toutes les entreprises : dans l\'éditeur, et dans leur assistant si elles ont l\'accès MCP',
      },
      featureSkill: {
        platform:
          'Entreprise plateforme uniquement (en test) : le bouton est masqué chez les clients',
        all:
          'Toutes les entreprises : dans l\'éditeur, et dans leur assistant si la case est cochée et qu\'elles ont l\'accès MCP',
      },
      taskSkill: {
        platform: 'Entreprise plateforme uniquement (en test)',
        all: 'Toutes les entreprises qui ont l\'accès MCP',
      },
    },
    platformOnly: 'Entreprise plateforme uniquement',
    warningUnchecked:
      'L\'avertissement lié à ce changement n\'a pas pu être vérifié.',
    savedWarningUnchecked:
      'Enregistré, mais l\'avertissement lié à ce changement n\'a pas pu être vérifié.',
    openExpertises: {
      skillTitle: 'Ouvrir ce Skill à toutes les entreprises',
      intro:
        'Ce Skill consomme des Expertises réservées à l\'entreprise plateforme : les assistants des autres entreprises le suivront sans elles.',
      openToo: 'L\'ouvrir aussi à toutes les entreprises',
      openTooNamed: 'L\'ouvrir aussi à toutes les entreprises : {title}',
      appliesAtOnce:
        'Ouvrir une Expertise l\'applique aussi, tout de suite, aux fonctionnalités de l\'éditeur de toutes les entreprises. Sans case cochée, le Skill s\'ouvre sans elles.',
    },
    closeExpertise: {
      title: 'Réserver cette Expertise à l\'entreprise plateforme',
      intro:
        'Ces Skills de tâche, ouverts à toutes les entreprises, la consomment : ils ne la recevront plus chez les clients.',
    },
    usedByFeature: {
      badge: 'Utilisé par une fonctionnalité',
      filter: 'Utilisé par une fonctionnalité',
      features: 'Utilisé par les fonctionnalités',
      none: 'Aucune fonctionnalité ne l\'utilise.',
      hint: 'Déduit des déclarations des fonctionnalités, jamais saisi à la main.',
    },
    pageTitle: 'Skills & Expertise',
    tabs: {
      skills: 'Skills',
      expertise: 'Expertise',
      invocations: 'Invocations',
      sync: 'Production et copies',
      details: 'Détails',
      versions: 'Versions',
    },
    actions: {
      archive: 'Archiver',
    },
    filters: {
      category: 'Catégorie',
      status: 'Statut',
      skillId: 'Identifiant skill',
      feature: 'Fonctionnalité',
      groupId: 'Identifiant de l\'entreprise',
      includeNonProductive: 'Inclure les tests (playground, poc.*)',
    },
    categories: {
      redaction: 'Rédaction',
      qc: 'Contrôle qualité',
      design: 'Design',
      html_integration: 'Intégration HTML',
      deliverability: 'Délivrabilité',
      translation: 'Traduction',
      other: 'Autre',
    },
    errors: {
      EXPERTISE_LIST_FILTER_INVALID:
        'Le filtre « {filter} » de la liste des Expertises n\'est pas valide.',
      SKILL_CONSUMED_EXPERTISES_INVALID:
        'Les Expertises consommées doivent être une liste d\'identifiants d\'Expertise.',
      SKILL_CONSUMED_EXPERTISES_TOO_MANY:
        'Une version consomme au plus {max} Expertises.',
      SKILL_CONSUMED_EXPERTISES_DUPLICATED:
        'Ces Expertises sont consommées plusieurs fois : {expertiseIds}. Gardez-en une seule fois chacune.',
      SKILL_CONSUMED_EXPERTISES_NOT_FOUND:
        'Ces Expertises consommées n\'existent pas : {expertiseIds}. Retirez-les de la version.',
      SKILL_OPEN_EXPERTISES_INVALID:
        'Seules les Expertises publiées que cette version consomme et qui sont réservées à l\'entreprise plateforme s\'ouvrent avec le Skill, et seulement quand le Skill s\'ouvre à toutes les entreprises.',
      SKILL_NOT_AVAILABLE_TO_COMPANY:
        'Cette fonctionnalité n\'est pas encore disponible pour votre entreprise.',
      SKILL_PROCEDURE_REQUIRED_TO_PUBLISH:
        'La procédure d\'un Skill de tâche doit être rédigée avant de publier cette version.',
      SKILL_SCHEMAS_REQUIRED_TO_PUBLISH:
        'Les schémas d\'entrée et de sortie doivent être renseignés avant de publier cette version.',
      SKILL_TEMPLATE_UNKNOWN_FIELDS:
        'Le template référence des champs absents du schéma d\'entrée « {schemaId} » : {fields}. Corrigez le template ou changez le schéma d\'entrée de la version.',
      SKILL_VERSION_CHANGED:
        'Ce brouillon a été modifié entre-temps, par exemple par un assistant. Rechargez-le pour voir la nouvelle version avant d\'enregistrer ou de publier.',
      SKILLS_EXPORT_NOT_FOUND:
        '{id} n\'existe pas : rechargez la liste, puis exportez de nouveau.',
      SKILLS_EXPORT_ARCHIVED:
        '{id} est archivé : il ne s\'exporte plus. Rechargez la liste, puis exportez de nouveau.',
      SKILLS_EXPORT_NOT_PUBLISHED:
        '{id} n\'a aucune version publiée : seule une version publiée s\'exporte.',
      SKILLS_EXPORT_FORMAT_UNKNOWN:
        'Ce fichier n\'est pas un export de skills que cette instance lit : elle lit le format {expected}.',
      SKILLS_EXPORT_INVALID:
        'Ce fichier n\'est pas un export de skills lisible : le champ « {field} » est refusé.',
      SKILLS_EXPORT_FIELD_MISSING:
        'Ce fichier n\'est pas un export de skills lisible : le champ « {field} » manque.',
      SKILLS_EXPORT_FIELD_WRONG_TYPE:
        'Ce fichier n\'est pas un export de skills lisible : le champ « {field} » n\'a pas le bon type.',
      SKILLS_EXPORT_FIELD_NOT_ALLOWED:
        'Ce fichier n\'est pas un export de skills lisible : la valeur du champ « {field} » n\'est pas permise.',
      SKILLS_EXPORT_FIELD_TOO_BIG:
        'Ce fichier n\'est pas un export de skills lisible : le champ « {field} » dépasse la taille permise.',
      SKILLS_EXPORT_FIELD_TOO_SMALL:
        'Ce fichier n\'est pas un export de skills lisible : le champ « {field} » est vide ou trop petit.',
      SKILLS_EXPORT_FIELD_DUPLICATE:
        'Ce fichier n\'est pas un export de skills lisible : le champ « {field} » répète un élément déjà présent.',
      SKILLS_SELECTION_INVALID:
        'La sélection n\'est pas une liste d\'identifiants : « {field} ».',
      SKILLS_IMPORT_ARCHIVED:
        '{id} est archivé ici : la version {version} n\'a pas été importée.',
      SKILLS_IMPORT_DRAFT_OPEN:
        'Un brouillon est ouvert sur {id} : publiez-le ou supprimez-le, puis importez de nouveau la version {version}.',
      SKILLS_IMPORT_VERSION_NOT_AHEAD:
        'La version {version} de {id} n\'est pas plus récente que celles d\'ici : elle n\'a pas été importée.',
      SKILLS_IMPORT_CHANGED:
        '{id} a été modifié pendant l\'import : importez de nouveau la version {version}.',
      SKILL_SCHEMA_NOT_IN_CODE:
        'Le schéma « {schemaId} » n\'existe pas encore dans le code de cette instance : la version se publiera quand ce code sera déployé.',
      SKILLS_READ_TOKEN_NAME_INVALID:
        'Le nom du jeton compte de 1 à {max} caractères.',
      SKILLS_READ_TOKEN_NOT_FOUND:
        'Ce jeton de lecture n\'existe pas ou a déjà été révoqué : rechargez la liste.',
      SKILLS_READ_TOKEN_REQUIRED:
        'Un jeton de lecture valide est nécessaire.',
      SKILLS_READ_TOKEN_ON_COPY:
        'Cette instance est une copie : elle suit la production et ne donne pas de jeton de lecture.',
      SKILLS_NOT_A_COPY:
        'Cette instance n\'est pas une copie : elle ne suit aucune production.',
      SKILLS_FOLLOW_RUNNING:
        'Un suivi de la production est déjà en cours : attendez qu\'il se termine.',
      SKILLS_FOLLOW_NOT_CONFIGURED:
        'Cette instance n\'est configurée pour suivre aucune production.',
      SKILLS_FOLLOW_INVALID_ADDRESS:
        'L\'adresse de la production n\'est pas une adresse https valide.',
      SKILLS_FOLLOW_UNREACHABLE:
        'La production n\'a pas pu être jointe.',
      SKILLS_FOLLOW_TOKEN_REFUSED:
        'La production a refusé le jeton de lecture : il a peut-être été révoqué.',
      SKILLS_FOLLOW_PRODUCTION_ERROR:
        'La production a répondu par une erreur.',
      SKILLS_FOLLOW_UNREADABLE:
        'La réponse de la production n\'a pas pu être lue : les deux instances n\'ont peut-être pas la même version de LePatron.',
      SKILLS_FOLLOW_INTERRUPTED:
        'Le suivi a été interrompu avant sa fin.',
      SKILLS_FOLLOW_FAILED:
        'Le suivi s\'est arrêté sur une erreur inattendue : ce qu\'il a déjà écrit reste, suivez de nouveau la production.',
      SKILLS_FOLLOW_ITEM_UNREADABLE:
        'La production a envoyé cet élément sous une forme que cette copie ne lit pas (champ « {field} »).',
      SKILLS_FOLLOW_ITEM_CHANGED:
        'Cet élément a été modifié sur la copie pendant le suivi : il n\'a pas été écrasé. Suivez de nouveau la production.',
      SKILLS_FOLLOW_ITEM_INVALID:
        'Cette copie refuse ce que la production tient pour cet élément, par exemple un schéma absent de son code.',
      SKILLS_FOLLOW_ITEM_FAILED:
        'Cet élément n\'a pas pu être suivi.',
      SKILLS_COPY_ITEM_NOT_FOUND:
        '{id} n\'existe pas sur cette copie : rechargez la liste.',
      SKILLS_COPY_VERSION_NOT_FOUND:
        'La version {version} de {id} n\'existe pas sur cette copie.',
      SKILLS_COPY_ID_TAKEN:
        'Trop d\'éléments portent déjà le travail de la copie de {id} : supprimez-en avant d\'en créer un autre.',
      SKILL_TEST_CASE_INVALID:
        'Un cas de test est incomplet : chaque cas a besoin d\'un nom et d\'une entrée.',
      SKILL_PUBLICATION_GUARD_REQUIRED:
        'Une fonctionnalité utilise cette version : vérifiez-la avant de la publier.',
    },
    publishDrafts: {
      action: 'Publier les brouillons',
      title: 'Publier les brouillons sélectionnés',
      intro: 'Chaque élément publie son brouillon. Une seule vérification couvre tout ce que ces brouillons touchent, puis ils sont publiés un par un.',
      targets: '{count} brouillon(s) à publier :',
      nothing: 'Aucun brouillon à publier dans cette sélection.',
      skippedLabel: 'Laissés de côté :',
      noGuard: 'Aucune fonctionnalité n\'utilise ces brouillons : ils se publient sans vérification.',
      publish: 'Publier',
      published: '{count} brouillon(s) publié(s).',
      report: 'Résultat de la publication',
      publishedLabel: 'Publiés :',
      warnedLabel: 'Publiés, avec un avertissement\u00a0:',
      failedLabel: 'Non publiés :',
      close: 'Fermer',
      cancelled: 'Publication annulée : les brouillons restent des brouillons.',
      skipped: {
        not_found: 'introuvable',
        archived: 'archivé : réactivez-le depuis sa page',
        no_draft: 'aucun brouillon',
        several_drafts: 'plusieurs brouillons : publiez celui de votre choix depuis sa page',
      },
      failures: {
        guard_required: 'utilisé par une fonctionnalité, à vérifier avant de publier',
        not_found: 'version introuvable',
        draft_changed: 'modifié depuis sa lecture : rechargez sa page avant de le publier',
        not_draft: 'n\'est plus un brouillon',
        release_notes_required: 'version majeure : renseignez le changelog et les notes de version sur sa page',
        failed: 'la publication a échoué',
      },
    },
    publicationGuard: {
      title: 'Vérifier avant de publier',
      intro: 'LePatron rejoue les cas de test des skills de fonctionnalité concernées, avec la version active puis avec cette version. Un écart vous avertit sans bloquer : vous décidez.',
      usedBy: 'Utilisée par : {features}.',
      calls: '{calls} appel(s) à l\'IA, avec le moteur IA du groupe plateforme.',
      missing: 'Sans cas de test, donc non vérifiée(s) : {skills}.',
      noCase: 'Aucun cas de test à rejouer : relisez la version avant de la publier.',
      run: 'Lancer la vérification',
      running: 'Vérification en cours, un appel après l\'autre…',
      summary: '{cases} cas rejoué(s), {failed} en écart.',
      before: 'Version active',
      after: 'Cette version',
      noBefore: 'Pas encore publiée',
      same: 'Sortie identique',
      contractOk: 'Respecte le contrat de sortie',
      publish: 'Publier',
      publishAnyway: 'Publier malgré les écarts',
      cancel: 'Annuler la publication',
      cancelled: 'Publication annulée : la version reste un brouillon.',
      errors: {
        OUTPUT_CONTRACT: 'La réponse ne respecte pas le contrat de sortie.',
        INPUT_INVALID: 'L\'entrée du cas ne respecte plus le schéma d\'entrée.',
        CALL_FAILED: 'L\'appel à l\'IA a échoué.',
      },
    },
    testCases: {
      title: 'Cas de test',
      help: 'Les entrées sur lesquelles cette skill est vérifiée avant la publication d\'un changement dont elle dépend.',
      empty: 'Aucun cas de test sur cette version.',
      add: 'Ajouter un cas de test',
      edit: 'Modifier le cas de test',
      view: 'Voir le cas de test',
      delete: 'Supprimer le cas de test',
      deleteConfirm: 'Supprimer ce cas de test du brouillon ?',
      save: 'Valider le cas',
      name: 'Nom',
      input: 'Entrée (JSON)',
      inputHint: 'Un objet JSON avec les champs du schéma d\'entrée de la version.',
      expectedOutput: 'Ce qu\'une bonne sortie doit contenir',
      expectedOutputHint: 'Ce que la personne qui relit la comparaison doit retrouver dans la réponse.',
      notes: 'Notes',
      fromRunNotes: 'Depuis un run du playground du {date}. Sortie attendue à relire.',
      errors: {
        required: 'Ce champ est obligatoire.',
        invalidJson: 'Ce n\'est pas du JSON valide.',
        notObject: 'L\'entrée doit être un objet JSON, entre accolades.',
      },
      fromRun: {
        added: 'Cas de test ajouté au brouillon v{version}. Relisez sa sortie attendue dans la page de la skill.',
        noDraft: 'Cette skill n\'a pas de brouillon ouvert : une version publiée ne se modifie pas. Créez une nouvelle version depuis la page de la skill, puis recommencez.',
        taskSkill: 'Une skill de tâche n\'a pas de cas de test.',
        runFailed: 'Seul un run réussi peut devenir un cas de test.',
      },
    },
    warnings: {
      SCHEMA_NOT_IN_CODE:
        'Le schéma « {schemaId} » n\'existe pas dans le code de cette instance : la publication attendra son déploiement.',
      TEMPLATE_UNKNOWN_FIELDS:
        'Le template référence des champs absents du schéma d\'entrée « {schemaId} » : {fields}. Ils seront interpolés vides à l\'exécution — la publication sera bloquée.',
      TEMPLATE_MISSING_REQUIRED:
        'Champ(s) requis du schéma « {schemaId} » non référencé(s) dans le template : {fields}.',
      TEMPLATE_MISSING_EXPERTISE:
        'Le schéma accepte des expertises mais le template ne les insère pas : elles seraient ignorées à l\'invocation.',
      CONSUMED_EXPERTISES_NOT_PUBLISHED:
        'Ces Expertises consommées ne sont pas publiées : {expertiseIds}. L\'assistant ne les reçoit pas tant qu\'elles ne le sont pas.',
      CONSUMED_EXPERTISES_PLATFORM_ONLY:
        'Ces Expertises consommées sont réservées à l\'entreprise plateforme : {expertiseIds}. Les assistants des autres entreprises suivent ce Skill sans elles.',
      OPEN_EXPERTISES_FAILED:
        'Le Skill est enregistré, mais ces Expertises n\'ont pas pu être ouvertes à toutes les entreprises : {expertiseIds}. Ouvrez-les depuis leurs détails.',
    },
    emailTypes: {
      editorial: 'Éditorial',
      promotional: 'Promotionnel',
      service: 'Serviciel',
      notification: 'Suivi',
      transactional: 'Transactionnel',
      institutional: 'Institutionnel',
    },
    statuses: {
      DRAFT: 'Brouillon',
      ACTIVE: 'Active',
      ARCHIVED: 'Archivée',
      PUBLISHED: 'Publiée',
      SUCCESS: 'Succès',
      VALIDATION_ERROR: 'Erreur de validation',
      PROVIDER_ERROR: 'Erreur provider',
      TIMEOUT: 'Délai dépassé',
      CANCELLED: 'Annulée',
      CONFIG_ERROR: 'Erreur de configuration',
    },
    skill: {
      intro: 'Prompts IA versionnés et gouvernés. Chaque skill est une fonction réutilisable que les features de LePatron peuvent invoquer (rédaction d\'un CTA, contrôle qualité d\'un sujet, traduction d\'un bloc, etc.).',
      id: 'Identifiant',
      idHint: 'Slug, dot-hiérarchique — ex. redaction.cta',
      idResetHint: 'Recalculer l\'identifiant depuis Catégorie et Titre',
      technicalId: 'Identifiant technique',
      inputSchemaId: 'Schéma d\'entrée',
      outputSchemaId: 'Schéma de sortie',
      schemasOnVersionNote:
        'Les schémas d\'entrée/sortie se choisissent au niveau de la version (onglet Versions), comme les prompts.',
      activeVersion: 'Version active',
      noActiveVersion: 'Aucune version active',
      addSkill: 'Ajouter une skill',
      newSkill: 'Nouvelle skill',
      noSkills: 'Aucune skill créée',
      created: 'Skill créée',
      archiveTitle: 'Archiver cette skill ?',
      archiveBody: 'La skill ne pourra plus être invoquée. Cette action est réversible.',
      archived: 'Skill archivée',
      testInPlayground: 'Tester dans le playground',
    },
    expertise: {
      intro: 'Savoir-faire Badsender documenté en Markdown structuré. Les expertises sont consommées en input par les skills pour leur fournir le contexte métier (principes de rédaction, règles de design, conseils de délivrabilité, etc.).',
      id: 'Identifiant',
      idHint: 'Slug — ex. redaction.cta.principles',
      idResetHint: 'Recalculer l\'identifiant depuis Catégorie, Périmètre et Titre',
      scope: 'Périmètre',
      scopeHint: 'ex. cta, subject, …',
      transversal: 'Expertise transversale',
      transversalHint:
        'Chargée par les fonctionnalités quel que soit le périmètre demandé (ex. une voix de marque). Reste filtrée par catégorie, type d\'email et langue. À cocher délibérément — une expertise sans périmètre et non transversale n\'est chargée nulle part.',
      transversalChip: 'Transversale',
      noScopeTooltip:
        'Aucun périmètre : cette expertise n\'est chargée par aucune fonctionnalité en mode filtré',
      impactTitle: 'Impact de l\'activation',
      impactLoadedBy: 'Cette expertise sera chargée par :',
      impactNone:
        'Aucune fonctionnalité déclarée ne charge actuellement ce périmètre. L\'expertise restera utilisable par sélection explicite (playground).',
      appliesToEmailTypes: 'Types d\'email concernés',
      appliesToLanguages: 'Langues (vide = toutes)',
      technicalId: 'Identifiant technique',
      createScope: 'Créer le périmètre « {value} »',
      categoryHelp:
        'Classe l\'expertise par grande famille. La catégorie déterminera aussi, à terme, quel moteur IA est utilisé pour ce type de fonctionnalité.',
      scopeHelp:
        'Clé de chargement : les fonctionnalités récupèrent les expertises par périmètre avant d\'appeler l\'IA (ex. la génération de CTA charge le périmètre « cta »).',
      emailTypeHelp:
        'Restreint l\'expertise à certaines typologies (ex. « promo »). Vide = tous les types.',
      languageHelp:
        'Langues des contenus auxquels ce savoir-faire s\'applique — ex. une liste de mots à risque en français ne vaut que pour des contenus FR. Vide = toutes.',
      descriptionHelp:
        'Affichée dans les sélecteurs (playground et fonctionnalités) pour aider à choisir la bonne expertise.',
      goodExamples: 'Bons exemples',
      badExamples: 'Mauvais exemples',
      bodyLabel: 'Contenu Markdown — utilisez ## [section-id] Titre',
      sectionIdHelp:
        'Les sections [section-id] structurent la doctrine en briques identifiables : elles sont listées dans l\'onglet Sections et permettront, à terme, des surcharges ciblées par client (design system). Si plusieurs expertises traitent du même concept, utilisez le même identifiant de section (ex. [length] pour toute règle de longueur).',
      addExpertise: 'Ajouter une expertise',
      newExpertise: 'Nouvelle expertise',
      noExpertise: 'Aucune expertise',
      created: 'Expertise créée',
      archiveTitle: 'Archiver cette expertise ?',
      archiveBody: 'Les skills qui référencent cette expertise conservent leur contexte actuel jusqu\'au prochain remplacement. Cette action est réversible.',
      archived: 'Expertise archivée',
      sectionsTab: 'Sections',
      sectionsCaption: 'Sections extraites du contenu de la version active.',
      noSections: 'Aucune section détectée.',
    },
    invocation: {
      intro: 'Journal observable de tous les appels aux skills. Permet de monitorer la latence, le coût en tokens, les erreurs de validation ou de provider, et d\'inspecter en détail chaque exécution.',
      when: 'Quand',
      version: 'Version',
      feature: 'Fonctionnalité',
      latency: 'Latence',
      tokens: 'Tokens',
      group: 'Entreprise',
      providerModel: 'Provider / Modèle',
      noInvocations: 'Aucune invocation visible',
      noInvocationsHint: 'Les invocations de test sont masquées par défaut — activez « Inclure les tests » pour les afficher.',
      dateFrom: 'Depuis',
      dateTo: 'Jusqu\'à',
      detailInput: 'Entrée',
      detailOutput: 'Sortie',
      detailResolvedConfig: 'Configuration résolue',
    },
    version: {
      reload: 'Recharger',
      procedure: 'Procédure',
      procedureHint: 'Ce que l\'assistant fait, étape par étape, en Markdown.',
      consumedExpertises: 'Expertises consommées',
      consumedExpertisesHint:
        'Dans l\'ordre où l\'assistant les lit. Leur version active est jointe au Skill.',
      consumedExpertisesEmpty: 'Aucune Expertise consommée.',
      consumedExpertisesAdd: 'Ajouter une Expertise',
      consumedExpertisesSearch:
        'Chercher une Expertise publiée par son titre ou son identifiant',
      consumedExpertisesNoResult: 'Aucune Expertise publiée trouvée.',
      consumedExpertisesSearchError:
        'La recherche a échoué. Tapez de nouveau pour réessayer.',
      consumedExpertisesMax: 'Une version consomme au plus {max} Expertises.',
      consumedExpertisesLoadError:
        'Les Expertises n\'ont pas pu être chargées.',
      consumedExpertisesRetry: 'Réessayer',
      consumedExpertiseNotFound: 'Introuvable',
      consumedExpertiseNotFoundHint:
        'Aucune Expertise ne porte cet identifiant : l\'assistant ne la reçoit pas. Retirez-la.',
      consumedExpertiseNotPublished: 'Non publiée',
      consumedExpertiseNotPublishedHint:
        'Brouillon ou archivée : l\'assistant ne la reçoit pas tant qu\'aucune de ses versions n\'est publiée. Publiez-la, ou retirez-la.',
      consumedExpertisePlatformOnlyHint:
        'Seuls les assistants de l\'entreprise plateforme la reçoivent : ouvrez-la à toutes les entreprises pour que leurs assistants la reçoivent aussi.',
      consumedExpertiseUp: 'Monter',
      consumedExpertiseDown: 'Descendre',
      consumedExpertiseRemove: 'Retirer',
      systemPrompt: 'System prompt',
      skillBody: 'Corps de la skill',
      inputTemplate: 'Modèle d\'entrée (utilise les placeholders {input.*})',
      newVersion: 'Nouvelle version (brouillon)',
      newVersionShort: 'Nouvelle version',
      versionCreated: 'Version créée',
      draftSaved: 'Brouillon enregistré',
      draftSavedSchemaNotInCode:
        'Brouillon enregistré. Le schéma {ids} n\'existe pas dans le code de cette instance : la publication attendra son déploiement. | Brouillon enregistré. Les schémas {ids} n\'existent pas dans le code de cette instance : la publication attendra leur déploiement.',
      schemaNotInCode:
        'Le schéma {ids} n\'existe pas dans le code de cette instance : le brouillon s\'enregistre, la publication attendra son déploiement. | Les schémas {ids} n\'existent pas dans le code de cette instance : le brouillon s\'enregistre, la publication attendra leur déploiement.',
      schemaMissing: 'Schéma absent du code',
      schemaMissingHint:
        'Ce brouillon nomme un schéma que le code de cette instance n\'a pas encore : il ne se publie qu\'une fois ce code déployé.',
      unsavedChanges: 'Modifications non enregistrées',
      activate: 'Activer',
      activateTitle: 'Activer cette version',
      activateBody: 'Activer une version la rend immuable. Le changelog et les notes de version sont obligatoires.',
      platformOnlyReminder:
        'Cette fiche reste visible par l\'entreprise plateforme uniquement.',
      openToAll: 'L\'ouvrir à toutes les entreprises',
      openToAllNotice:
        'Cette fiche sera ouverte à toutes les entreprises dès sa publication.',
      activateBodyMinor: 'Activer cette version mineure la rend immuable et change immédiatement la doctrine consommée par les fonctionnalités. Changelog et notes pré-remplis depuis le brouillon (facultatifs pour une mineure).',
      changelog: 'Changelog',
      changelogPlaceholder:
        'Ce qui change par rapport à la version précédente — ex. « Ajout de la règle d\'urgence, reformulation du critère de longueur »',
      releaseNotes: 'Notes de version',
      releaseNotesPlaceholder:
        'À savoir sur cette version — ex. « Testée uniquement sur les emails promo FR ; section exceptions à valider terrain »',
      outputFormatNote:
        'Le format de sortie JSON est ajouté automatiquement depuis le schéma de sortie — ne le rédigez pas.',
      schemasHelp:
        'Contrat technique de la version : l\'entrée valide ce que les fonctionnalités envoient et génère le formulaire du playground ; la sortie est imposée automatiquement au LLM. Les schémas sont définis en code — contactez l\'équipe dev pour en ajouter.',
      placeholdersHelp:
        'Placeholders utilisables dans le modèle d\'entrée uniquement — ils sont refusés dans le prompt système et dans le corps de la skill. Dérivés du schéma d\'entrée :',
      placeholdersRequiredHint:
        'Les placeholders marqués d\'un astérisque (*) correspondent à des champs requis par le schéma d\'entrée.',
      placeholderCopyHint: 'Cliquer pour copier ce placeholder',
      placeholderCopyFailed:
        'Copie impossible depuis ce navigateur — sélectionnez le texte du placeholder à la main.',
      placeholdersInvocationNote:
        'Ces champs sont fournis à l\'invocation — seuls ceux référencés dans le modèle d\'entrée sont transmis au LLM.',
      placeholdersExpertiseNote:
        '{token} porte les expertises sélectionnées : sans lui, elles ne seront pas vues par le modèle.',
      activated: 'Version activée',
      saveDraft: 'Enregistrer le brouillon',
      duplicate: 'Dupliquer',
      duplicateHint: 'Dupliquer en nouvelle version majeure',
      saveChanges: 'Enregistrer les modifications',
      newMinor: 'Nouvelle version mineure',
      newMinorHint: 'Correction rapide sans changement de doctrine.',
      newMajor: 'Nouvelle version majeure',
      newMajorHint: 'Refonte ou changement de doctrine.',
      deleteDraft: 'Supprimer le brouillon',
      deleteDraftConfirm: 'Supprimer définitivement ce brouillon ?',
      publish: 'Publier',
      publishMinorConfirm: 'Publier cette version mineure ?',
      publishMinorBody: 'Elle remplacera la version active actuelle.',
      readOnly: 'Lecture seule',
      readOnlyHint: 'Cette version est publiée. Pour la modifier, créez une nouvelle version mineure ou majeure.',
    },
    logs: {
      tabLabel: 'Logs',
      hideTest: 'Masquer les invocations de test',
      empty: 'Aucune invocation pour cette skill.',
    },
  },
  aiPlayground: {
    pageTitle: 'AI Playground',
    intro: 'Composez, exécutez et conservez des scénarios de test qui combinent une skill, des expertises et des paramètres. Servez-vous-en pour itérer sur un prompt, valider une mise à jour, ou prototyper une feature avant écriture.',
    actions: {
      newScenario: 'Nouveau scénario',
      delete: 'Supprimer',
      execute: 'Exécuter',
      markGolden: 'Marquer comme référence',
      unmarkGolden: 'Démarquer la référence',
      compare: 'Comparer avec la référence',
      makeTestCase: 'En faire un cas de test',
      makeTestCaseHint: 'Ajoute l\'entrée de ce run, et sa sortie comme sortie attendue, aux cas de test du brouillon ouvert de la skill',
    },
    list: {
      empty: 'Créez un scénario pour tester une skill avec vos expertises. Aucune connaissance technique requise.',
    },
    filters: {
      skill: 'Skill',
      tag: 'Tag',
      search: 'Rechercher',
    },
    headers: {
      name: 'Nom',
      skill: 'Skill',
      status: 'Statut',
      golden: 'Référence',
      goldenTooltip:
        'Un run de référence est défini — les nouveaux runs peuvent lui être comparés',
      when: 'Quand',
      latency: 'Latence',
      tokens: 'Tokens',
      feedback: 'Feedback',
      lastRun: 'Dernier run',
      lastRunStatus: 'Statut',
      runs: 'Runs',
    },
    form: {
      scenarioId: 'Identifiant',
      scenarioIdHint: 'Slug unique — ex. validation.cta.promo',
      name: 'Nom',
      description: 'Description',
      tags: 'Tags',
      skillSection: 'Skill à invoquer',
      skillSelector: 'Skill cible',
      versionMode: 'Version',
      versionModeActive: 'Suivre l\'active',
      versionModePinned: 'Version figée',
      versionPicker: 'Version exacte',
      expertiseSection: 'Expertises',
      expertiseMode: 'Mode',
      expertiseModeNone: 'Aucune',
      expertiseModeExplicit: 'Sélection explicite',
      expertiseModeFilter: 'Filtre dynamique',
      expertiseNoneWarning: 'Aucune expertise ne sera injectée. Vérifiez que la skill est conçue pour fonctionner sans expertise.',
      expertiseSelector: 'Expertises sélectionnées',
      expertiseRecommended: 'Recommandées pour cette skill',
      expertiseAll: 'Toutes les expertises',
      expertiseNotSupported:
        "Cette skill n'accepte pas d'expertise en entrée : la sélection ci-dessous est conservée mais ne sera pas injectée.",
      filterCategories: 'Catégories',
      filterScope: 'Périmètre',
      filterScopeHint:
        'Critère de requête : les expertises dont le périmètre correspond seront chargées (ex. « cta »). Requis.',
      filterEmailType: 'Type d\'email',
      filterEmailTypeHint:
        'Ne garde que les expertises applicables à ce type d\'email. Vide = tous.',
      filterLanguage: 'Langue',
      filterLanguageHint:
        'Ne garde que les expertises applicables à cette langue. Vide = toutes.',
      filterSelectScope: 'Sélectionnez un périmètre pour prévisualiser.',
      filterSelectCategory:
        'Sélectionnez au moins une catégorie pour prévisualiser.',
      filterPreviewCount: '{count} expertise(s) correspondent à ces filtres.',
      filterPreviewPending: 'Comptage…',
      expertiseModeHelp:
        'Aucune : la skill est invoquée sans expertise. Sélection explicite : vous choisissez les expertises et leur ordre — recommandé pour les tests reproductibles. Filtre dynamique : les expertises sont chargées automatiquement selon les critères ci-dessous (catégorie, périmètre, type d\'email, langue). C\'est le mécanisme des fonctionnalités en production — c\'est lui qui permet d\'enrichir la doctrine sans redéploiement.',
      filterOrderHint:
        'Ordre de chargement : expertises transversales d\'abord, puis par identifiant alphabétique. Pour un ordre sur mesure, utilisez la sélection explicite.',
      expertiseOrderHint:
        'L\'ordre est celui d\'apparition dans le prompt — placez les expertises générales avant les spécifiques.',
      inputSection: 'Contenu de la demande',
      inputHint: 'Renseignez ce que la skill doit traiter. Les champs marqués * sont obligatoires.',
      inputInvalid: 'JSON invalide',
      scenarioIdToggle: 'Identifiant technique',
    },
    input: {
      modeForm: 'Formulaire',
      modeJson: 'Mode avancé (JSON)',
      unknownTypeFallback: 'Cette skill utilise un format d\'entrée avancé, édition en JSON requise.',
      templateHelp: 'Gabarit dérivé du schéma d\'entrée :',
      insertTemplate: 'Insérer le gabarit',
      manualExpertiseKey:
        "Le champ « expertise » est injecté automatiquement depuis la sélection ci-dessus : votre saisie sera écrasée dès qu'une expertise se résout.",
      unknownKeysWarning: 'Certains champs ne correspondent pas au schéma de la skill (conservés, mais rejetés à l\'exécution) : {keys}',
      expertiseInjected: 'Les expertises sélectionnées ci-dessus sont ajoutées automatiquement à la demande — rien à saisir ici.',
      skillChangeConfirmTitle: 'Changer de skill ?',
      skillChangeConfirmBody: 'Ces champs ne sont pas utilisés par la nouvelle skill : {fields}.',
      skillChangeKeepJson: 'Garder mes saisies (mode JSON)',
      skillChangeProceed: 'Continuer (champs supprimés)',
    },
    fieldLabels: {
      prompt: 'Instruction / demande',
      context: 'Contexte additionnel',
      brief: 'Brief de campagne',
      userInput: 'Instructions additionnelles',
      subjectToEvaluate: 'Objet à évaluer',
      emailContext: 'Contexte de l\'email',
    },
    fieldPlaceholders: {
      prompt: 'Ex. : Rédige un CTA percutant pour une promo de -20 % sur les vestes…',
      context: 'Ex. : Marque jeune et décontractée, audience 25-35 ans…',
      brief: 'Ex. : Promouvoir notre nouvelle collection… Audience : … Offre : …',
    },
    validation: {
      required: 'Le champ « {field} » est obligatoire.',
      unrecognized: 'Le champ « {field} » n\'est pas attendu par cette skill. Passez en mode avancé pour le retirer, ou vérifiez la skill sélectionnée.',
      length: 'Le champ « {field} » est trop court ou trop long.',
      invalid: 'Le champ « {field} » n\'a pas un format valide.',
    },
    runs: {
      title: 'Historique des runs',
      empty: 'Aucun run pour ce scénario. Lance une exécution pour commencer.',
      runOf: 'Run du {date}',
      executing: 'Invocation en cours, peut prendre jusqu\'à 90 secondes…',
      budgetExhausted: 'Budget de test quotidien atteint (50/50). Réessayer demain.',
      tabs: {
        input: 'Input',
        output: 'Output',
        raw: 'Output (JSON)',
        feedback: 'Feedback',
      },
      feedback: {
        rating: 'Évaluation',
        ratingPositive: 'Positive',
        ratingNeutral: 'Neutre',
        ratingNegative: 'Négative',
        score: 'Score (1 à 5)',
        comment: 'Commentaire',
        save: 'Enregistrer le feedback',
        saved: 'Feedback enregistré',
      },
      compare: {
        title: 'Comparaison avec la référence',
        golden: 'Référence',
        current: 'Run sélectionné',
        noGolden: 'Aucune référence définie pour ce scénario.',
      },
      delete: 'Supprimer ce run',
      deleted: 'Run supprimé',
      deleteConfirm: 'Supprimer ce run définitivement ?',
    },
    status: {
      SUCCESS: 'Succès',
      VALIDATION_ERROR: 'Erreur de validation',
      PROVIDER_ERROR: 'Erreur provider',
      TIMEOUT: 'Délai dépassé',
      CANCELLED: 'Annulée',
      CONFIG_ERROR: 'Erreur de configuration',
    },
    deleteScenarioConfirm: 'Supprimer ce scénario et tous ses runs ?',
    created: 'Scénario créé',
    updated: 'Scénario mis à jour',
    deleted: 'Scénario supprimé',
    goldenMarked: 'Référence mise à jour',
    goldenUnmarked: 'Référence retirée',
  },
};
