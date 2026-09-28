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
  'download-ftp-error':
    "Erreur lors de l'export des images (hébergement sur serveur sFTP)",

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

  // Content feed toolbar/toolbox tooltips (raw-string keys, same convention as "Comment block")
  'Content feed available for this block':
    'Flux de contenu disponible pour ce bloc',
  'Import from feed': 'Importer depuis le flux',

  // ContentFeedModal translations
  'content-feed-modal-title': 'Importer un flux',
  'content-feed-loading': 'Chargement des éléments du flux...',
  'content-feed-empty': 'Aucun élément trouvé dans ce flux.',
  'content-feed-fetch-error':
    "Une erreur s'est produite lors de la récupération des éléments du flux.",
  'content-feed-image-error':
    "Impossible de télécharger l'image — l'item a été ajouté sans image.",
  'content-feed-order-label': 'Ordre (glisser pour réorganiser)',
  'content-feed-cancel': 'Annuler',
  'content-feed-add-selection': 'Ajouter la sélection',
  'content-feed-adding': 'Ajout en cours...',
  'content-feed-success': 'Contenu importé depuis le flux.',
  'content-feed-max-selectable':
    "Ce bloc a __count__ colonne(s) — sélectionnez jusqu'à __count__ élément(s).",

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

  // Block toolbar
  'Save block to library': 'Enregistrer dans la bibliothèque de blocs',
  'Translate block': 'Traduire le bloc',

  // Comments
  'Comment block': 'Commenter ce bloc',
  'comments-title': 'Commentaires',
  'comments-toggle': 'Afficher les commentaires',
  'comments-loading': 'Chargement des commentaires...',
  'comments-empty': 'Aucun commentaire',
  'comments-load-error': 'Erreur lors du chargement des commentaires',
  'comments-count': '{count} non résolu(s)',
  'comments-count-label': 'en attente',
  'comments-all-resolved': 'Tous résolus',
  'comments-date-now': "À l'instant",
  'comments-date-days-suffix': 'j',
  'comments-date-month-0': 'jan.',
  'comments-date-month-1': 'fév.',
  'comments-date-month-2': 'mars',
  'comments-date-month-3': 'avr.',
  'comments-date-month-4': 'mai',
  'comments-date-month-5': 'juin',
  'comments-date-month-6': 'juil.',
  'comments-date-month-7': 'août',
  'comments-date-month-8': 'sept.',
  'comments-date-month-9': 'oct.',
  'comments-date-month-10': 'nov.',
  'comments-date-month-11': 'déc.',
  'comments-go-to-block': 'Aller au bloc',
  'comments-block-not-found': 'Bloc introuvable',
  'comments-filter-block': 'Bloc actuel',
  'comments-filter-all': 'Tous',
  'comments-no-block-selected': 'Aucun bloc',
  'comments-context-block': 'Commentaire sur',
  'comments-context-global': 'Commentaire global',
  'comments-context-clear': 'Passer en commentaire global',
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
  'comments-unresolve': 'Rouvrir',
  'comments-unresolved': 'Commentaire rouvert',
  'comments-unresolve-error': 'Erreur lors de la réouverture',
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
  'comments-no-block': "Ce commentaire n'est pas lié à un bloc",
  'save-message-success-metadata-error':
    "L'email a été sauvegardé, mais les paramètres de l'email n'ont pas pu être enregistrés : __reason__",
  // email metadata section of the Content tab
  'email-metadata-title': "Paramètres de l'email",
  'email-metadata-subject': "Objet de l'email",
  'email-metadata-subject-placeholder':
    'Ex. : Découvrez nos nouveautés de la rentrée',
  'email-metadata-planned-date': "Date d'envoi prévue",
  'email-metadata-typology': 'Typologie',
  'email-metadata-typology-none': 'Aucune',
  'email-metadata-typology-empty':
    'Aucune typologie active pour votre entreprise. Elles se configurent dans Paramètres → Général → Typologies.',
  'email-metadata-error': "L'enregistrement des métadonnées a échoué",
  'email-metadata-error-disabled':
    'Les métadonnées ne sont pas activées pour cette entreprise',
  'email-metadata-error-typology': "Cette typologie n'est plus disponible",
  'email-metadata-typology-missing': 'Typologie désactivée',
  'email-metadata-trigger': 'Déclenchement',
  'email-metadata-trigger-none': 'Aucun',
  'email-metadata-trigger-adhoc': 'Ad hoc',
  'email-metadata-trigger-automated': 'Automatisé',
  // Affichées sous le champ pour la valeur sélectionnée, et en infobulle sur les
  // options. Des phrases complètes : elles ne suivent plus un libellé.
  'email-metadata-trigger-adhoc-description':
    "Un envoi décidé par l'équipe, pour cette fois.",
  'email-metadata-trigger-automated-description':
    'Un envoi décidé par une règle, à chaque fois.',
  'email-metadata-error-no-company':
    "Cet email n'est rattaché à aucune entreprise : la typologie ne peut pas être enregistrée",
  'email-metadata-error-invalid': 'Une des valeurs saisies a été refusée',
  // HTML code block
  'html-code-block-name': 'Code HTML',
  'html-code-block-empty': 'Bloc Code HTML — cliquez pour éditer',
  'widget-code-edit': 'Éditer le code HTML',
  'html-code-modal-title': 'Code HTML',
  'html-code-modal-apply': 'Appliquer',
  'html-code-modal-cancel': 'Annuler',
  'html-code-modal-close': 'Fermer',
  'html-code-placeholder':
    'Collez ici votre code HTML. Fournissez une table complète : largeur, responsive et dark mode sont sous votre responsabilité.',
  'html-code-too-large':
    "Le code HTML dépasse la limite de __max__ caractères. Réduisez-le avant d'appliquer.",
  'widget-code-edit-css': "Éditer le CSS de l'email",
  'widget-code-view-css': "Voir le CSS de l'email",
  'widget-code-css-hint':
    "Ajouté dans le <head> de l'email exporté. Partagé par tous les blocs de cette création. À l'export, les styles du template passent en ligne et l'emportent sur ce CSS, sauf !important.",
  // Block builder
  'block-builder-select-element': 'Sélectionnez un élément pour le régler.',
  'block-builder-choose-image': 'Choisir une image',
  'block-builder-change-image': "Changer l'image",
  'block-builder-replaces-markup':
    "Ce bloc contient déjà du code HTML qui n'a pas été composé ici. Si vous validez, il sera remplacé par votre composition.",
  'block-builder-block-name': 'Bloc composé',
  'block-builder-block-empty': 'Bloc composé — double-cliquez pour composer',
  'widget-block-builder-compose': 'Composer un bloc',
  'block-builder-tool-compose': 'Composer le bloc',
  'widget-block-builder-disabled':
    "Le block builder n'est plus activé sur ce template : ce bloc est conservé tel quel, mais ne peut plus être modifié.",
  'block-builder-modal-title': 'Composer un bloc',
  'block-builder-add': 'Ajouter',
  'block-builder-drop-here':
    'Glissez un élément ici ou cliquez-en un dans la palette',
  'block-builder-starter-text': 'Saisissez votre texte…',
  'block-builder-starter-button': 'Votre bouton',
  'block-builder-elements': 'Éléments',
  'block-builder-empty': 'Aucun élément. Ajoutez-en un pour commencer.',
  'block-builder-desktop': 'Bureau',
  'block-builder-mobile': 'Mobile',
  'block-builder-element-text': 'Texte',
  'block-builder-element-image': 'Image',
  'block-builder-element-button': 'Bouton',
  'block-builder-element-divider': 'Séparateur',
  'block-builder-element-spacer': 'Espaceur',
  'block-builder-field-text': 'Texte',
  'block-builder-field-align': 'Alignement',
  'block-builder-field-font-size': 'Taille',
  'block-builder-field-line-height': 'Interligne',
  'block-builder-field-color': 'Couleur',
  'block-builder-field-image': 'Image',
  'block-builder-field-alt': 'Texte alternatif',
  'block-builder-field-link-optional': 'Lien (optionnel)',
  'block-builder-field-width': 'Largeur',
  'block-builder-field-label': 'Libellé',
  'block-builder-field-link': 'Lien',
  'block-builder-field-background': 'Fond',
  'block-builder-field-text-color': 'Texte',
  'block-builder-field-radius': 'Arrondi',
  'block-builder-field-thickness': 'Épaisseur',
  'block-builder-field-height': 'Hauteur',
  'block-builder-align-left': 'Gauche',
  'block-builder-align-center': 'Centre',
  'block-builder-align-right': 'Droite',
  'block-builder-preview-title': 'Aperçu',
  'block-builder-move-up': 'Monter',
  'block-builder-move-down': 'Descendre',
  'block-builder-remove': 'Supprimer',
  'block-builder-preview-hint':
    'Cliquez sur un élément pour le régler, faites-le glisser pour le déplacer. Aperçu indicatif — rendu navigateur, pas rendu client mail.',
  'block-builder-rebuilds-markup':
    "Ce bloc a été construit par une version précédente du générateur. L'appliquer le reconstruira avec la version actuelle : son rendu peut légèrement changer.",
  'block-builder-discard-confirm':
    'Fermer sans appliquer ? Vos modifications de cette composition seront perdues.',
  'block-builder-too-large':
    "Cette composition est trop volumineuse pour être enregistrée. Retirez des éléments ou raccourcissez les textes avant d'appliquer.",
  'widget-code-disabled':
    "Le bloc Code HTML n'est plus activé sur ce template : ce bloc est conservé tel quel, mais ne peut plus être modifié.",
  'save-message-html-code-disabled':
    "Enregistrement refusé : le bloc Code HTML n'est pas activé sur ce template.",
  'save-message-block-builder-disabled':
    "Enregistrement refusé : le block builder n'est pas activé sur ce template.",
  'save-message-html-code-too-large':
    'Enregistrement refusé : un bloc Code HTML dépasse la taille maximale.',
  'save-message-block-builder-too-large':
    'Enregistrement refusé : un bloc composé dépasse la taille maximale.',
  'save-message-block-builder-state-unreadable':
    "Enregistrement refusé : un bloc composé n'est plus lisible. Supprimez-le, ou recomposez-le, puis enregistrez à nouveau.",
  'save-message-synthetic-content-too-large':
    'Enregistrement refusé : ensemble, les blocs Code HTML et les blocs composés de cet email dépassent la taille maximale. Supprimez-en quelques-uns.',
  'save-message-preview-too-large':
    "Enregistrement refusé : l'email est trop volumineux.",
  // Head CSS — a stylesheet for the whole email, gated by the same flag
  'head-css-section-title': 'CSS personnalisé',
  'head-css-section-hint':
    "Ajouté dans le <head> de l'email exporté. Utile pour rendre responsive le code collé dans un bloc Code HTML. À l'export, les styles du template passent en ligne et l'emportent sur ce CSS, sauf !important.",
  'head-css-section-button': 'Éditer le CSS',
  'head-css-not-exported-hint':
    "Non exporté pour l'instant : ce CSS n'est ajouté à l'email que tant qu'il contient un bloc Code HTML.",
  'head-css-view-button': 'Voir le CSS',
  'head-css-read-only-hint':
    'Ce template ne permet plus de modifier le CSS personnalisé. Il est conservé tel quel et toujours exporté avec les blocs Code HTML ; il peut seulement être supprimé.',
  'head-css-delete': 'Supprimer le CSS',
  'head-css-delete-confirm':
    'Supprimer le CSS personnalisé de cet email ? Ce template ne permet plus de le réécrire.',
  'head-css-modal-title': "CSS personnalisé (<head> de l'email)",
  'head-css-placeholder':
    "Écrivez ici votre CSS. Il sera ajouté dans le <head> de l'email exporté, tel quel, sans être appliqué aux blocs du template.",
  'head-css-too-large':
    "Le CSS dépasse la limite de __max__ caractères. Réduisez-le avant d'appliquer.",
  'save-message-head-css-disabled':
    "Enregistrement refusé : le CSS personnalisé n'est pas activé sur ce template.",
  'save-message-head-css-too-large':
    'Enregistrement refusé : le CSS personnalisé dépasse la taille maximale.',
  // Quality control (ext/quality)
  'Quality control': 'Contrôle qualité',
  'Link not filled in: __label__': 'Lien non renseigné : __label__',
  'Clickable image has no link': 'Image cliquable sans lien',
  'Image not replaced': 'Image non remplacée',
  'Template sample image not replaced':
    "Image d'exemple du template non remplacée",
  'Missing Outlook background image': 'Image de fond Outlook manquante',
  'Missing mobile background image': 'Image de fond mobile manquante',
  'Exported HTML weighs __size__ KB: Gmail clips emails over 102 KB':
    'Le HTML exporté pèse __size__ Ko : Gmail tronque les emails de plus de 102 Ko',
  'Required tracking parameters missing: __keys__':
    'Paramètres de tracking obligatoires manquants : __keys__',
  'Test email': "Tester l'email",
  'Test your email': 'Tester votre email',
  Close: 'Fermer',
  'Run quality checks': 'Lancer le contrôle qualité',
  'Links, images and weight are checked before you send a test.':
    "Les liens, les images et le poids de l'email sont vérifiés avant l'envoi d'un test.",
  '__count__ checks': '__count__ contrôles',
  'Running checks…': 'Contrôle en cours…',
  'Running…': 'En cours…',
  Cancel: 'Annuler',
  'Re-run': 'Relancer',
  Error: 'Erreur',
  Warning: 'Avertissement',
  Info: 'Info',
  Passed: 'Réussis',
  'Check passed': 'Contrôle réussi',
  Errors: 'Erreurs',
  Warnings: 'Avertissements',
  Infos: 'Infos',
  '__count__ errors': '__count__ erreur(s)',
  '__count__ warnings': '__count__ avertissement(s)',
  '__count__ infos': '__count__ info(s)',
  '__count__ checks passed': '__count__ contrôle(s) réussi(s)',
  '__count__ issues': '__count__ point(s) à corriger',
  'All checks passed': 'Tous les contrôles sont réussis',
  '__passed__ of __total__ checks · __when__':
    '__passed__ contrôles sur __total__ · __when__',
  'Go to block': 'Aller au bloc',
  'Send a test email': 'Envoyer un email de test',
  'This check could not run': "Ce contrôle n'a pas pu s'exécuter",
  Technical: 'Technique',
  Accessibility: 'Accessibilité',
  Copy: 'Rédaction',
  Performance: 'Performance',
  'Required tracking parameters': 'Paramètres de tracking obligatoires',
  'All required tracking parameters are filled in':
    'Tous les paramètres de tracking obligatoires sont renseignés',
  Links: 'Liens',
  'Every link has a destination': 'Tous les liens ont une destination',
  'Clickable images': 'Images cliquables',
  'Every clickable image has a link':
    'Toutes les images cliquables ont un lien',
  Images: 'Images',
  'Every image has been replaced': 'Toutes les images ont été remplacées',
  'Background images': 'Images de fond',
  'Every background image turned on is set':
    'Toutes les images de fond activées sont renseignées',
  'Email weight': "Poids de l'email",
  'Exported HTML weighs __size__ KB, under the 102 KB Gmail limit':
    'Le HTML exporté pèse __size__ Ko, sous la limite de 102 Ko de Gmail',
  'Link addresses': 'Adresses des liens',
  'Every link address is well formed':
    'Toutes les adresses de liens sont bien formées',
  'Link URL contains a space: __url__':
    "L'adresse du lien contient une espace : __url__",
  'Link URL misses http:// or https://: __url__':
    "Il manque http:// ou https:// à l'adresse du lien : __url__",
  'Link URL is not a full address: __url__':
    "L'adresse du lien est incomplète : __url__",
  'Link URL has an unknown protocol: __url__':
    "Le protocole de l'adresse du lien est inconnu : __url__",
  'Email link has no valid address: __url__':
    "Le lien email n'a pas d'adresse valide : __url__",
  'Phone link has no valid number: __url__':
    "Le lien téléphone n'a pas de numéro valide : __url__",
  'Addresses shown as link text': 'Adresses affichées en texte de lien',
  'No link shows an address as its text':
    "Aucun lien n'affiche une adresse comme texte",
  'Link text is an address (__label__): once the ESP rewrites links for tracking, it no longer matches its destination and can look like phishing':
    "Le texte du lien est une adresse (__label__) : une fois les liens réécrits par l'ESP pour le tracking, elle ne correspondra plus à la destination et pourra ressembler à du phishing",
  'Link domains': 'Domaines des liens',
  'No link points to a suspicious domain':
    'Aucun lien ne pointe vers un domaine suspect',
  'Link address hides an identity before its domain: __host__':
    "L'adresse du lien cache un identifiant avant le domaine : __host__",
  'Link points to an IP address instead of a domain: __host__':
    "Le lien pointe vers une adresse IP au lieu d'un domaine : __host__",
  'Link points to a test environment: __host__':
    'Le lien pointe vers un environnement de test : __host__',
  'Link points to an example domain: __host__':
    "Le lien pointe vers un domaine d'exemple : __host__",
  'Public URL shortener: __host__': "Raccourcisseur d'URL public : __host__",
  'Domain extension often used for spam: __host__':
    'Extension de domaine souvent utilisée pour le spam : __host__',
  'Internationalized domain, check it is the expected one: __host__':
    "Domaine internationalisé, vérifiez qu'il s'agit du bon : __host__",
  'Secure addresses': 'Adresses sécurisées',
  'Every link and image uses https':
    'Tous les liens et toutes les images utilisent https',
  'Link is not secure (http): __url__':
    "Le lien n'est pas sécurisé (http) : __url__",
  'Image is not secure (http) and may not load: __url__':
    "L'image n'est pas sécurisée (http) et risque de ne pas s'afficher : __url__",
  'Linked images': 'Images avec lien',
  'Every linked image has an alternative text':
    'Toutes les images avec lien ont un texte alternatif',
  'Linked image has no alternative text: screen readers announce a link with no name':
    "L'image avec lien n'a pas de texte alternatif : les lecteurs d'écran annoncent un lien sans nom",
  'Alternative texts': 'Textes alternatifs',
  'Alternative texts look like descriptions':
    'Les textes alternatifs ressemblent à des descriptions',
  'Alternative text is an address: __alt__':
    'Le texte alternatif est une adresse : __alt__',
  'Alternative text looks like a file name: __alt__':
    'Le texte alternatif ressemble à un nom de fichier : __alt__',
  'Alternative text is too long (__count__ characters): keep it to a short description':
    'Le texte alternatif est trop long (__count__ caractères) : limitez-le à une courte description',
  'Readable text': 'Texte lisible',
  'The email has text to read when images are blocked':
    "L'email reste lisible quand les images sont bloquées",
  'The email has almost no text besides its images (__count__ characters): with images blocked, nothing can be read':
    "L'email n'a presque pas de texte en dehors de ses images (__count__ caractères) : si les images sont bloquées, rien n'est lisible",
  'Image formats': "Formats d'image",
  'Every image uses a format email clients show':
    'Toutes les images utilisent un format affiché par les clients mail',
  'Image format not shown by every email client (__format__): prefer JPG, PNG or GIF':
    "Format d'image non affiché par tous les clients mail (__format__) : préférez JPG, PNG ou GIF",
};
