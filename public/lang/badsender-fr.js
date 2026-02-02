'use strict';

module.exports = {
  // edit title
  'edit-title-double-click': 'Double-cliquer pour modifier',
  'edit-title-cancel': 'Annuler la modification',
  'edit-title-save': 'Enregistrer le nouveau nom',
  'edit-title-ajax-pending': 'Changement du nom…',
  'edit-title-ajax-success': 'Mise à jour du nom effectuée',
  'edit-title-ajax-fail': "Impossible d'enregistrer le nouveau nom :(",

  // empty title fallback
  'title-empty': 'sans titre',

  // save
  'save-message-success': "L'email a été sauvegardé",
  'save-message-error': "Une erreur est survenue lors de l'enregistrement :(",

  // gallery
  'gallery-title': 'Galeries :',
  'gallery-mailing': "SPÉCIFIQUE À L'EMAIL",
  'gallery-mailing-loading': "Chargement de la galerie de l'email…",
  'gallery-mailing-empty': "La galerie de l'email est vide",
  'gallery-template': 'COMMUN AU TEMPLATE',
  'gallery-template-loading': 'Chargement de la galerie du template…',
  'gallery-template-empty': 'La galerie du template est vide',
  'gallery-remove-image-success': "L'image a bien été supprimée de la galerie",
  'gallery-remove-image-fail':
    "Une erreur est survenue lors de la suppression de l'image :(",

  // bgimage widget
  'widget-bgimage-button': 'Choisir image',
  'widget-bgimage-reset': "Enlever l'image",

  // prevent i18n console.warn
  'Fake image editor': '',
  '<p>Fake image editor</p>': '',

  // download button
  'dl-btn-regular': 'Téléchargement local',
  'dl-btn-cdn': 'images ICOU',

  // Editor interface
  'editor-title': "LePatron - Éditeur d'image",
  'editor-panel-title': 'Élément sélectionné',
  'editor-crop-panel-title': 'Zone de sélection',
  'editor-actions-panel-title': 'Actions',
  'editor-filters-panel-title': 'Filtres',
  'editor-ratio-free': 'Forme libre',
  'editor-ratio-egal': 'Egal',
  'editor-ratio-standard': 'Standard (4:3)',
  'editor-ratio-landscape': 'Paysage (19:9)',
  'editor-ratio-portrait': 'Portrait (3:4)',
  'editor-ratio-square': 'Carré (1:1)',
  'editor-mirror': 'Mirroir',
  'editor-rotate': 'Rotation',
  'editor-size': 'Taille',
  'editor-zoomin': 'Zoomer',
  'editor-zoomout': 'Dézoomer',
  'editor-background-color': 'Couleur de fond',
  'editor-background-cancel': 'Annuler',
  'editor-background-save': 'Appliquer',
  'editor-color': 'Couleur',
  'reset-editor': 'Réinitialiser',
  'text-editor': 'Texte',
  'crop-editor': 'Rogner',
  'crop-editor-cancel': 'Annuler',
  'crop-editor-submit': 'Valider',
  'image-upload': 'Ajouter une image',
  'input-corner-radius': 'Arrondir les bords',
  'input-width': 'Largeur',
  'input-height': 'Hauteur',
  'rotate-left': 'Tourner vers la gauche',
  'rotate-right': 'Tourner vers la droite',
  'vertical-mirror': 'Miroir vertical',
  'horizontal-mirror': 'Miroir horizontal',
  'error-server':
    "Une erreur s'est produite lors de l'appel de l'API du serveur",
  'filters-blur': 'Flou',
  'filters-pixelate': 'Pixelisé',
  'filters-grayscale': 'Noir et blanc',
  'filters-contrast': 'Contraste',
  'filters-brighten': 'Luminosité',
  'filters-invert': 'Inverse',
  'editor-text-color': 'Couleur',
  'editor-text-style': 'Style',
  'editor-text-style-normal': 'Normal',
  'editor-text-style-italic': 'Italique',
  'editor-text-style-bold': 'Gras',
  'editor-text-size': 'Taille',
  'editor-text-font': 'Police',
  cancel: 'Annuler',
  upload: 'Enregistrer',

  // Profile form esp
  'sender-name': "Nom de l'expéditeur",
  'sender-mail': "Adresse email de l'expéditeur",
  replyto: 'Adresse email de réponse',
  mailSubject: "Objet de l'email",
  templateSubject: 'Objet du template',
  name: 'Nom',
  mailName: "Nom de l'email",
  templateName: 'Nom du template',
  'export-to': 'Exporter vers',
  'exporting-in-progress': 'Export en cours, merci de patienter...',
  'search-folder': 'Rechercher un dossier...',
  'select-folder': 'Sélectionner un dossier',
  'search-delivery': 'Rechercher un livrable...',
  'search-delivery-template': 'Rechercher un modèle de livrable...',
  'select-delivery': 'Sélectionner un livrable',
  'select-delivery-template': 'Sélectionner un modèle de livrable',
  exporting: 'Exportation…',
  loading: 'Chargement',
  submit: 'Enregistrer',
  close: 'ANNULER',
  export: 'EXPORTER',
  'warning-esp-message':
    "Toute mise à jour remplacera l'email dans votre routeur",

  // profile form validation
  'mail-name-required': "Veuillez saisir un nom pour l'email",
  'template-name-required': 'Veuillez saisir un nom pour le template',
  'mail-subject-required': "Veuillez saisir l'objet de l'email",
  'template-subject-required': "Veuillez saisir l'objet du template",
  'mail-success-esp-send': 'Email exporté avec succès',
  'template-success-esp-send': 'Template exporté avec succès',
  'error-server-400':
    "Paramètres ESP invalides. Vérifiez si l'adresse email de l'expéditeur correspond à la clé API",
  'error-server-402': "Échec de l'exportation. L'ESP exige un paiement.",
  'error-server-409': "Nom d'email déjà utilisé",
  'error-server-500':
    "Une erreur s'est produite lors de l'appel de l'API du serveur :(",
  'supported-language': 'Langue',
  'target-table': 'Table cible',
  'encoding-type': "Type d'encodage",
  uploadError: "Une erreur s'est produite lors de l'upload.",
  saveError: "Une erreur s'est produite lors de la sauvegarde.",
  exportError: "Contactez le support avec l'identifiant : {logId}.",
  publishError: "Une erreur s'est produite lors de la publication.",
  getImageUrlError:
    "Une erreur s'est produite lors de la récupération de l'url des images.",

  entity: 'Entité',

  // Additional error messages from the handleError function
  'error-bad-sender-id-format':
    "Le format de l'identifiant de la campagne est invalide.",
  'error-invalid-campaign-combination':
    'La combinaison du code de campagne et du type de campagne est invalide.',
  'error-api-error':
    "Une erreur s'est produite lors de la communication avec l'API.",

  // test list
  'title-send-test-mails': 'Envoyer un email de test',
  'send-test-success': 'Email envoyé avec succès',
  'send-test-error': "Erreur lors de l'envoi de l'email :(",
  'placeholder-input-emails-test':
    'Exemple : premieremail@test.com;secondemail@test.com',
  'emails-test': 'Saisir un ou plusieurs emails',
  'emails-invalid':
    'Les adresses emails saisis sont invalides. Veuillez séparer les adresses emails par ";"',
  'placeholder-emails-groups': 'Sélectionnez une liste',
  'sending-test-mails': "Envoi de l'email de test…",
  'send-test-mails': 'Envoyer',

  // SaveBlockModal translations
  'title-save-block': 'Enregistrer le bloc',
  'title-edit-block': 'Modifier le bloc',
  'block-name': 'Nom du bloc',
  'block-category': 'Description du bloc',
  'block-modal-close': 'Fermer',
  'save-block': 'Enregistrer le bloc',
  'edit-block': 'Modifier le bloc',
  'placeholder-block-name': 'Entrez le nom du bloc',
  'placeholder-block-category': 'Entrez la description du bloc (optionnel)',
  'saving-block': 'Enregistrement en cours',
  'save-block-success': 'Bloc enregistré avec succès',
  'save-block-error': "Erreur lors de l'enregistrement du bloc",

  // PersonalizedBlocksListComponent translations
  'personalized-blocks-fetch-error':
    "Une erreur s'est produite lors de la récupération des blocs personnalisés.",
  'personalized-blocks-loading': 'Chargement des blocs personnalisés...',
  'personalized-blocks-empty':
    'Aucun bloc personnalisé disponible pour ce template.',
  'personalized-blocks-empty-search':
    'Aucun résultat trouvé pour votre recherche.',
  'personalized-blocks-search-placeholder': 'Rechercher...',

  // DeleteBlockModal translations
  'title-delete-block': 'Supprimer le bloc',
  'confirm-delete-block':
    'Êtes-vous sûr de vouloir supprimer le bloc personnalisé :',
  'deleting-block': 'Suppression du bloc en cours...',
  'delete-block': 'Supprimer',
  'delete-block-success': 'Bloc supprimé avec succès',
  'delete-block-error': 'Erreur lors de la suppression du bloc',

  //Adobe Connector Modal
  'delivery-error':
    "Une erreur est survenue lors du chargement des livrables. Contactez le support avec l'identifiant : {logId}.",
  'folder-error':
    "Une erreur est survenue lors du chargement des dossiers. Contactez le support avec l'identifiant : {logId}.",
  'snackbar-error': "Une erreur s'est produite. Veuillez réessayer.",

  // Comments
  'Comment block': 'Commenter ce bloc',
  'comments-title': 'Commentaires',
  'comments-toggle': 'Afficher les commentaires',
  'comments-loading': 'Chargement des commentaires...',
  'comments-empty': 'Aucun commentaire',
  'comments-load-error': 'Erreur lors du chargement des commentaires',
  'comments-count': '{count} non résolu(s)',
  'comments-count-label': 'en attente',
  'comments-date-now': "À l'instant",
  'comments-go-to-block': 'Aller au bloc',
  'comments-block-not-found': 'Bloc introuvable',
  'comments-filter-block': 'Filtré par bloc',
  'comments-show-all': 'Tout afficher',
  'comments-placeholder': 'Écrire un commentaire...',
  'comments-add': 'Ajouter',
  'comments-save': 'Enregistrer',
  'comments-cancel': 'Annuler',
  'comments-edit': 'Modifier',
  'comments-delete': 'Supprimer',
  'comments-reply': 'Répondre',
  'comments-resolve': 'Résoudre',
  'comments-resolved-badge': 'Résolu',
  'comments-replying-to': 'Réponse à {name}',
  'comments-replying-to-prefix': 'Réponse à',
  'comments-text-required': 'Le texte du commentaire est requis',
  'comments-created': 'Commentaire ajouté',
  'comments-updated': 'Commentaire modifié',
  'comments-deleted': 'Commentaire supprimé',
  'comments-resolved': 'Commentaire résolu',
  'comments-create-error': "Erreur lors de l'ajout du commentaire",
  'comments-update-error': 'Erreur lors de la modification',
  'comments-delete-error': 'Erreur lors de la suppression',
  'comments-resolve-error': 'Erreur lors de la résolution',
  'comments-delete-confirm': 'Voulez-vous vraiment supprimer ce commentaire ?',
  'comments-category-general': 'Général',
  'comments-category-design': 'Design',
  'comments-category-content': 'Contenu',
  'comments-severity-info': 'Info',
  'comments-severity-important': 'Important',
  'comments-severity-blocking': 'Bloquant',
  'comments-block-deleted': 'Bloc supprimé',
  'comments-mention-placeholder': 'Tapez @ pour mentionner',
  'comments-go-to-block': 'Cliquer pour aller au bloc',
  'comments-no-block': 'Ce commentaire n\'est pas lié à un bloc',
};
