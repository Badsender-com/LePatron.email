'use strict';

module.exports = {
  // edit title
  'edit-title-double-click': 'Double click to edit',
  'edit-title-cancel': 'Cancel edition',
  'edit-title-save': 'Save the new name',
  'edit-title-ajax-pending': 'Changing name…',
  'edit-title-ajax-success': 'Name changed',
  'edit-title-ajax-fail': 'Unable to save the new name :(',

  // empty title fallback
  'title-empty': 'no name',

  // save
  'save-message-success': 'The email has been saved',
  'save-message-error': 'Error in saving :(',

  // gallery
  'gallery-title': 'Galleries:',
  'gallery-mailing': 'EMAIL ONLY',
  'gallery-mailing-loading': 'Loading email gallery…',
  'gallery-mailing-empty': 'The email gallery is empty',
  'gallery-template': 'TEMPLATE SHARED',
  'gallery-template-loading': 'Loading template gallery…',
  'gallery-template-empty': 'Email gallery is empty',
  'gallery-remove-image-success':
    'This image has been removed from the gallery',
  'gallery-remove-image-fail':
    'An error has occured while removing the image :(',

  // bgimage widget
  'widget-bgimage-button': 'Pick an image',
  'widget-bgimage-reset': 'Reset image',

  // prevent i18n console.warn
  'Fake image editor': '',
  '<p>Fake image editor</p>': '',

  // download button
  'dl-btn-regular': 'Standard download',
  'dl-btn-cdn': 'zip with CDN',
  'download-ftp-error': 'Image export error (sFTP server)',

  // Editor interface
  'editor-title': 'LePatron - Image editor',
  'editor-panel-title': 'Selected element',
  'editor-crop-panel-title': 'Selector area',
  'editor-actions-panel-title': 'Actions',
  'editor-filters-panel-title': 'Filters',
  'editor-ratio-free': 'Freeform',
  'editor-ratio-egal': 'Egal',
  'editor-ratio-standard': 'Standard (4:3)',
  'editor-ratio-landscape': 'Landscape (19:9)',
  'editor-ratio-portrait': 'Portrait (3:4)',
  'editor-ratio-square': 'Square (1:1)',
  'editor-mirror': 'Flip',
  'editor-rotate': 'Rotate',
  'editor-size': 'Size',
  'editor-zoomin': 'Zoom in',
  'editor-zoomout': 'Zoom out',
  'editor-background-color': 'Background color',
  'editor-background-cancel': 'Cancel',
  'editor-background-save': 'Apply',
  'editor-color': 'Color',
  'reset-editor': 'Reset',
  'text-editor': 'Text',
  'crop-editor': 'Crop',
  'crop-editor-cancel': 'Cancel',
  'crop-editor-submit': 'Save',
  'image-upload': 'Add an image',
  'input-corner-radius': 'Round the corners',
  'input-width': 'Width',
  'input-height': 'Height',
  'rotate-left': 'Rotate left',
  'rotate-right': 'Rotate right',
  'vertical-mirror': 'Vertical mirror',
  'horizontal-mirror': 'Horizontal mirror',
  'error-server': 'An error has occured while calling server API :(',
  'filters-blur': 'Blur',
  'filters-pixelate': 'Pixelate',
  'filters-grayscale': 'Grayscale',
  'filters-contrast': 'Contrast',
  'filters-brighten': 'Brightness',
  'filters-invert': 'Invert',
  'editor-text-color': 'Color',
  'editor-text-style': 'Style',
  'editor-text-style-normal': 'Normal',
  'editor-text-style-italic': 'Italic',
  'editor-text-style-bold': 'Bold',
  'editor-text-size': 'Size',
  'editor-text-font': 'Font',
  cancel: 'Cancel',
  upload: 'Save',

  // Profile form esp
  'sender-name': 'Sender name',
  planification: 'Planification',
  'sender-mail': 'Sender email address',
  replyto: 'Reply email address',
  mailSubject: 'Subject',
  templateSubject: 'Template subject',
  name: 'Name',
  mailName: 'Email name',
  templateName: 'Template name',
  'export-to': 'Export to',
  'exporting-in-progress': 'Export in progress, please wait...',
  'search-folder': 'Search a folder...',
  'select-folder': 'Select a folder',
  'search-delivery': 'Search a delivery...',
  'search-delivery-template': 'Search a delivery template...',
  'select-delivery': 'Select a delivery',
  'select-delivery-template': 'Select a delivery template',
  exporting: 'Exporting…',
  loading: 'Loading',
  submit: 'Submit',
  close: 'CANCEL',
  export: 'EXPORT',
  'warning-esp-message': 'Any update will replace the email in your ESP',

  // profile form validation
  'mail-name-required': 'Email name is required',
  'template-name-required': 'Template name is required',
  'mail-subject-required': 'Email subject is required',
  'template-subject-required': 'Template subject is required',
  'mail-success-esp-send': 'Email exported successfully',
  'template-success-esp-send': 'Template exported successfully',
  'error-server-400':
    'ESP parameters invalids. Check if sender email matches API key',
  'error-server-402': 'Export fail, provider require payment.',
  'error-server-409': 'Email name already used',
  'error-server-500': 'An error has occured while calling server API :(',
  'supported-language': 'Supported language',
  'target-table': 'Target table',
  'encoding-type': 'Encoding type',
  uploadError: 'An error has occured while uploading the images.',
  exportError: 'Please contact support with this ID: : {logId}.',
  saveError: 'An error has occured while saving.',
  publishError: 'An error has occured while publishing.',
  getImageUrlError: 'An error has occured while getting images url.',

  entity: 'Entity',

  // Additional error messages from the handleError function
  'error-bad-sender-id-format': 'The campaign ID format is invalid.',
  'error-invalid-campaign-combination':
    'The combination of campaign code and campaign type is invalid.',
  'error-api-error': 'An error occurred while communicating with the API.',

  // test list
  'title-send-test-mails': 'Send a test email',
  'send-test-success': 'Email sent successfully',
  'send-test-error': 'An error has occured while sending the emai :(l',
  'placeholder-input-emails-test':
    'Example: firstemail@test.com;secondemail@test.com',
  'emails-test': 'Enter one or more emails',
  'emails-invalid':
    'The email addresses entered are invalid. Please separate email addresses with ";"',
  'placeholder-emails-groups': 'Select a list',
  'sending-test-mails': 'Sending test mail…',
  'send-test-mails': 'Send',

  // SaveBlockModal translations
  'title-save-block': 'Save block',
  'title-edit-block': 'Edit block',
  'block-name': 'Block name',
  'block-category': 'Block description',
  'block-modal-close': 'Close',
  'save-block': 'Save block',
  'edit-block': 'Edit block',
  'placeholder-block-name': 'Enter block name',
  'placeholder-block-category': 'Enter block description (optional)',
  'saving-block': 'Saving block',
  'save-block-success': 'Block saved successfully',
  'save-block-error': 'Error saving block',

  // PersonalizedBlocksListComponent translations
  'personalized-blocks-fetch-error':
    'An error occurred while fetching custom blocks.',
  'personalized-blocks-loading': 'Loading custom blocks...',
  'personalized-blocks-empty': 'No custom blocks available for this template.',
  'personalized-blocks-empty-search': 'No results found for your search.',
  'personalized-blocks-search-placeholder': 'Search...',

  // Content feed toolbar/toolbox tooltips (raw-string keys, same convention as "Comment block")
  'Content feed available for this block':
    'Content feed available for this block',
  'Import from feed': 'Import from feed',

  // ContentFeedModal translations
  'content-feed-modal-title': 'Import from feed',
  'content-feed-loading': 'Loading feed items...',
  'content-feed-empty': 'No items found in this feed.',
  'content-feed-fetch-error': 'An error occurred while fetching feed items.',
  'content-feed-image-error':
    'Could not download the image — the item was added without one.',
  'content-feed-order-label': 'Order (drag to reorder)',
  'content-feed-cancel': 'Cancel',
  'content-feed-add-selection': 'Add selection',
  'content-feed-adding': 'Adding...',
  'content-feed-success': 'Content imported from the feed.',
  'content-feed-max-selectable':
    'This block has __count__ column(s) — pick up to __count__ item(s).',

  // DeleteBlockModal translations
  'title-delete-block': 'Delete block',
  'confirm-delete-block': 'Are you sure you want to delete the custom block:',
  'deleting-block': 'Deleting block...',
  'delete-block': 'Delete',
  'delete-block-success': 'Block deleted successfully',
  'delete-block-error': 'Error deleting block',

  //Adobe connector modal
  'delivery-error':
    'An error occurred while loading deliveries. Please contact support with this ID: {logId}.',
  'folder-error':
    'An error occurred while loading folders. Please contact support with this ID: {logId}.',
  'snackbar-error': 'An error occurred. Please try again.',

  // Block toolbar
  'Save block to library': 'Save block to library',
  'Translate block': 'Translate block',

  // Comments
  'Comment block': 'Comment this block',
  'comments-title': 'Comments',
  'comments-toggle': 'Show comments',
  'comments-loading': 'Loading comments...',
  'comments-empty': 'No comments yet',
  'comments-load-error': 'Error loading comments',
  'comments-count': '{count} unresolved',
  'comments-count-label': 'pending',
  'comments-all-resolved': 'All resolved',
  'comments-date-now': 'Just now',
  'comments-date-days-suffix': 'd',
  'comments-date-month-0': 'Jan',
  'comments-date-month-1': 'Feb',
  'comments-date-month-2': 'Mar',
  'comments-date-month-3': 'Apr',
  'comments-date-month-4': 'May',
  'comments-date-month-5': 'Jun',
  'comments-date-month-6': 'Jul',
  'comments-date-month-7': 'Aug',
  'comments-date-month-8': 'Sep',
  'comments-date-month-9': 'Oct',
  'comments-date-month-10': 'Nov',
  'comments-date-month-11': 'Dec',
  'comments-go-to-block': 'Go to block',
  'comments-block-not-found': 'Block not found',
  'comments-filter-block': 'Current block',
  'comments-filter-all': 'All',
  'comments-no-block-selected': 'No block',
  'comments-context-block': 'Comment on',
  'comments-context-global': 'Global comment',
  'comments-context-clear': 'Switch to global comment',
  'comments-show-all': 'Show all',
  'comments-placeholder': 'Write a comment...',
  'comments-add': 'Add',
  'comments-save': 'Save',
  'comments-cancel': 'Cancel',
  'comments-edit': 'Edit',
  'comments-delete': 'Delete',
  'comments-reply': 'Reply',
  'comments-resolve': 'Resolve',
  'comments-resolved-badge': 'Resolved',
  'comments-replying-to': 'Replying to {name}',
  'comments-replying-to-prefix': 'Replying to',
  'comments-text-required': 'Comment text is required',
  'comments-created': 'Comment added',
  'comments-updated': 'Comment updated',
  'comments-deleted': 'Comment deleted',
  'comments-resolved': 'Comment resolved',
  'comments-unresolve': 'Reopen',
  'comments-unresolved': 'Comment reopened',
  'comments-unresolve-error': 'Error reopening comment',
  'comments-create-error': 'Error adding comment',
  'comments-update-error': 'Error updating comment',
  'comments-delete-error': 'Error deleting comment',
  'comments-resolve-error': 'Error resolving comment',
  'comments-delete-confirm': 'Are you sure you want to delete this comment?',
  'comments-category-general': 'General',
  'comments-category-design': 'Design',
  'comments-category-content': 'Content',
  'comments-severity-info': 'Info',
  'comments-severity-important': 'Important',
  'comments-severity-blocking': 'Blocking',
  'comments-block-deleted': 'Block deleted',
  'comments-mention-placeholder': 'Type @ to mention',
  'comments-no-block': 'This comment is not linked to a block',
  'save-message-success-metadata-error':
    'The email was saved, but the email settings could not be: __reason__',
  // email metadata section of the Content tab
  'email-metadata-title': 'Email settings',
  'email-metadata-subject': 'Subject line',
  'email-metadata-subject-placeholder': 'E.g. Discover our new autumn range',
  'email-metadata-planned-date': 'Planned send date',
  // "Typology" is a false friend in a marketing interface — the English for what
  // the French calls « typologie » is simply the email's type.
  'email-metadata-typology': 'Email type',
  'email-metadata-typology-none': 'None',
  'email-metadata-typology-empty':
    'No active email type for your company. They are configured under Settings → General → Email types.',
  'email-metadata-error': 'Could not save the metadata',
  'email-metadata-error-disabled': 'Metadata is not enabled for this company',
  'email-metadata-error-typology': 'This email type is no longer available',
  'email-metadata-typology-missing': 'Deactivated email type',
  'email-metadata-trigger': 'Trigger',
  'email-metadata-trigger-none': 'None',
  'email-metadata-trigger-adhoc': 'One Shot',
  'email-metadata-trigger-automated': 'Automated',
  // Shown under the field for the selected value, and as a tooltip on the options.
  // Full sentences: they stand on their own rather than trailing a label.
  'email-metadata-trigger-adhoc-description':
    'A send the team decided on, this once.',
  'email-metadata-trigger-automated-description':
    'A send a rule decides, every time.',
  'email-metadata-error-no-company':
    'This email belongs to no company: the email type cannot be saved',
  'email-metadata-error-invalid': 'One of the values was refused',
  // HTML code block
  'html-code-block-name': 'HTML code',
  'html-code-block-empty': 'HTML code block — click to edit',
  'widget-code-edit': 'Edit HTML code',
  'html-code-modal-title': 'HTML code',
  'html-code-modal-apply': 'Apply',
  'html-code-modal-cancel': 'Cancel',
  'html-code-modal-close': 'Close',
  'html-code-placeholder':
    'Paste your HTML code here. Provide a complete table: width, responsive and dark mode are your responsibility.',
  'html-code-too-large':
    'The HTML code exceeds the __max__ character limit. Shorten it before applying.',
  'widget-code-edit-css': 'Edit the email CSS',
  'widget-code-view-css': 'View the email CSS',
  'widget-code-css-hint':
    "Added to the <head> of the exported email. Shared by every block of this mailing. At export, the template's styles are inlined and win over this CSS unless !important.",
  // Block builder
  'block-builder-select-element': 'Select an element to edit it.',
  'block-builder-choose-image': 'Choose an image',
  'block-builder-change-image': 'Change the image',
  'block-builder-replaces-markup':
    'This block already holds HTML that was not composed here. Applying will replace it with your composition.',
  'block-builder-block-name': 'Composed block',
  'block-builder-block-empty': 'Composed block — double-click to compose',
  'widget-block-builder-compose': 'Compose a block',
  'block-builder-tool-compose': 'Compose block',
  'widget-block-builder-disabled':
    'The block builder is no longer enabled on this template: this block is kept as is, but can no longer be edited.',
  'block-builder-modal-title': 'Compose a block',
  'block-builder-add': 'Add',
  'block-builder-drop-here': 'Drag an element here or click one in the palette',
  'block-builder-starter-text': 'Type your text…',
  'block-builder-starter-button': 'Your button',
  'block-builder-elements': 'Elements',
  'block-builder-empty': 'No element yet. Add one to start.',
  'block-builder-desktop': 'Desktop',
  'block-builder-mobile': 'Mobile',
  'block-builder-element-text': 'Text',
  'block-builder-element-image': 'Image',
  'block-builder-element-button': 'Button',
  'block-builder-element-divider': 'Divider',
  'block-builder-element-spacer': 'Spacer',
  'block-builder-field-text': 'Text',
  'block-builder-field-align': 'Alignment',
  'block-builder-field-font-size': 'Size',
  'block-builder-field-line-height': 'Line height',
  'block-builder-field-color': 'Color',
  'block-builder-field-image': 'Image',
  'block-builder-field-alt': 'Alternative text',
  'block-builder-field-link-optional': 'Link (optional)',
  'block-builder-field-width': 'Width',
  'block-builder-field-label': 'Label',
  'block-builder-field-link': 'Link',
  'block-builder-field-background': 'Background',
  'block-builder-field-text-color': 'Text',
  'block-builder-field-radius': 'Corner radius',
  'block-builder-field-thickness': 'Thickness',
  'block-builder-field-height': 'Height',
  'block-builder-align-left': 'Left',
  'block-builder-align-center': 'Center',
  'block-builder-align-right': 'Right',
  'block-builder-preview-title': 'Preview',
  'block-builder-move-up': 'Move up',
  'block-builder-move-down': 'Move down',
  'block-builder-remove': 'Remove',
  'block-builder-preview-hint':
    'Click an element to edit it, drag it to move it. Indicative preview — browser rendering, not mail client rendering.',
  'block-builder-rebuilds-markup':
    'This block was built by an earlier version of the builder. Applying will rebuild it with the current one, and its rendering may change slightly.',
  'block-builder-discard-confirm':
    'Close without applying? Your changes to this composition will be lost.',
  'block-builder-too-large':
    'This composition is too large to be saved. Remove elements or shorten the texts before applying.',
  'widget-code-disabled':
    'The HTML code block is no longer enabled on this template: this block is kept as is, but can no longer be edited.',
  'save-message-html-code-disabled':
    'Save refused: the HTML code block is not enabled on this template.',
  'save-message-block-builder-disabled':
    'Save refused: the block builder is not enabled on this template.',
  'save-message-html-code-too-large':
    'Save refused: an HTML code block exceeds the maximum size.',
  'save-message-block-builder-too-large':
    'Save refused: a composed block exceeds the maximum size.',
  'save-message-block-builder-state-unreadable':
    'Save refused: a composed block can no longer be read. Delete it, or recompose it, then save again.',
  'save-message-synthetic-content-too-large':
    'Save refused: together, the HTML code and composed blocks of this email exceed the maximum size. Remove some of them.',
  'save-message-preview-too-large': 'Save refused: the email is too large.',
  // Head CSS — a stylesheet for the whole email, gated by the same flag
  'head-css-section-title': 'Custom CSS',
  'head-css-section-hint':
    "Added to the <head> of the exported email. Useful to make markup pasted in an HTML code block responsive. At export, the template's styles are inlined and win over this CSS unless !important.",
  'head-css-section-button': 'Edit the CSS',
  'head-css-not-exported-hint':
    'Not exported for now: this CSS is added to the email only while it contains an HTML code block.',
  'head-css-view-button': 'View the CSS',
  'head-css-read-only-hint':
    'This template no longer allows editing the custom CSS. It is kept as is and still exported with the HTML code blocks; it can only be deleted.',
  'head-css-delete': 'Delete the CSS',
  'head-css-delete-confirm':
    'Delete the custom CSS of this email? This template no longer allows writing it again.',
  'head-css-modal-title': 'Custom CSS (email <head>)',
  'head-css-placeholder':
    'Write your CSS here. It is added to the <head> of the exported email, as written, and is not applied to the template blocks.',
  'head-css-too-large':
    'The CSS is over the __max__ character limit. Shorten it before applying.',
  'save-message-head-css-disabled':
    'Saving refused: custom CSS is not enabled on this template.',
  'save-message-head-css-too-large':
    'Saving refused: the custom CSS is over the maximum size.',
  // Quality control (ext/quality)
  'Quality control': 'Quality control',
  'Link not filled in: __label__': 'Link not filled in: __label__',
  'Clickable image has no link': 'Clickable image has no link',
  'Image not replaced': 'Image not replaced',
  'Template sample image not replaced': 'Template sample image not replaced',
  'Missing Outlook background image': 'Missing Outlook background image',
  'Missing mobile background image': 'Missing mobile background image',
  'Exported HTML weighs __size__ KB: Gmail clips emails over 102 KB':
    'Exported HTML weighs __size__ KB: Gmail clips emails over 102 KB',
  'Required tracking parameters missing: __keys__':
    'Required tracking parameters missing: __keys__',
  'Test email': 'Test email',
  'Test your email': 'Test your email',
  Close: 'Close',
  'Run quality checks': 'Run quality checks',
  'Links, images and weight are checked before you send a test.':
    'Links, images and weight are checked before you send a test.',
  '__count__ checks': '__count__ checks',
  'Running checks…': 'Running checks…',
  'Running…': 'Running…',
  Cancel: 'Cancel',
  'Re-run': 'Re-run',
  Error: 'Error',
  Warning: 'Warning',
  Info: 'Info',
  Passed: 'Passed',
  'Check passed': 'Check passed',
  Errors: 'Errors',
  Warnings: 'Warnings',
  Infos: 'Infos',
  '__count__ errors': '__count__ errors',
  '__count__ warnings': '__count__ warnings',
  '__count__ infos': '__count__ infos',
  '__count__ checks passed': '__count__ checks passed',
  '__count__ issues': '__count__ issues',
  'All checks passed': 'All checks passed',
  '__passed__ of __total__ checks · __when__':
    '__passed__ of __total__ checks · __when__',
  'Go to block': 'Go to block',
  'Send a test email': 'Send a test email',
  'This check could not run': 'This check could not run',
  Technical: 'Technical',
  Accessibility: 'Accessibility',
  Copy: 'Copy',
  Performance: 'Performance',
  'Required tracking parameters': 'Required tracking parameters',
  'All required tracking parameters are filled in':
    'All required tracking parameters are filled in',
  Links: 'Links',
  'Every link has a destination': 'Every link has a destination',
  'Clickable images': 'Clickable images',
  'Every clickable image has a link': 'Every clickable image has a link',
  Images: 'Images',
  'Every image has been replaced': 'Every image has been replaced',
  'Background images': 'Background images',
  'Every background image turned on is set':
    'Every background image turned on is set',
  'Email weight': 'Email weight',
  'Exported HTML weighs __size__ KB, under the 102 KB Gmail limit':
    'Exported HTML weighs __size__ KB, under the 102 KB Gmail limit',
  'Link addresses': 'Link addresses',
  'Every link address is well formed': 'Every link address is well formed',
  'Link URL contains a space: __url__': 'Link URL contains a space: __url__',
  'Link URL misses http:// or https://: __url__':
    'Link URL misses http:// or https://: __url__',
  'Link URL is not a full address: __url__':
    'Link URL is not a full address: __url__',
  'Link URL has an unknown protocol: __url__':
    'Link URL has an unknown protocol: __url__',
  'Email link has no valid address: __url__':
    'Email link has no valid address: __url__',
  'Phone link has no valid number: __url__':
    'Phone link has no valid number: __url__',
  'Addresses shown as link text': 'Addresses shown as link text',
  'No link shows an address as its text':
    'No link shows an address as its text',
  'Link text is an address (__label__): once the ESP rewrites links for tracking, it no longer matches its destination and can look like phishing':
    'Link text is an address (__label__): once the ESP rewrites links for tracking, it no longer matches its destination and can look like phishing',
  'Link domains': 'Link domains',
  'No link points to a suspicious domain':
    'No link points to a suspicious domain',
  'Link address hides an identity before its domain: __host__':
    'Link address hides an identity before its domain: __host__',
  'Link points to an IP address instead of a domain: __host__':
    'Link points to an IP address instead of a domain: __host__',
  'Link points to a test environment: __host__':
    'Link points to a test environment: __host__',
  'Link points to an example domain: __host__':
    'Link points to an example domain: __host__',
  'Public URL shortener: __host__': 'Public URL shortener: __host__',
  'Domain extension often used for spam: __host__':
    'Domain extension often used for spam: __host__',
  'Internationalized domain, check it is the expected one: __host__':
    'Internationalized domain, check it is the expected one: __host__',
  'Secure addresses': 'Secure addresses',
  'Every link and image uses https': 'Every link and image uses https',
  'Link is not secure (http): __url__': 'Link is not secure (http): __url__',
  'Image is not secure (http) and may not load: __url__':
    'Image is not secure (http) and may not load: __url__',
  'Linked images': 'Linked images',
  'Every linked image has an alternative text':
    'Every linked image has an alternative text',
  'Linked image has no alternative text: screen readers announce a link with no name':
    'Linked image has no alternative text: screen readers announce a link with no name',
  'Alternative texts': 'Alternative texts',
  'Alternative texts look like descriptions':
    'Alternative texts look like descriptions',
  'Alternative text is an address: __alt__':
    'Alternative text is an address: __alt__',
  'Alternative text looks like a file name: __alt__':
    'Alternative text looks like a file name: __alt__',
  'Alternative text is too long (__count__ characters): keep it to a short description':
    'Alternative text is too long (__count__ characters): keep it to a short description',
  'Readable text': 'Readable text',
  'The email has text to read when images are blocked':
    'The email has text to read when images are blocked',
  'The email has almost no text besides its images (__count__ characters): with images blocked, nothing can be read':
    'The email has almost no text besides its images (__count__ characters): with images blocked, nothing can be read',
  'Image formats': 'Image formats',
  'Every image uses a format email clients show':
    'Every image uses a format email clients show',
  'Image format not shown by every email client (__format__): prefer JPG, PNG or GIF':
    'Image format not shown by every email client (__format__): prefer JPG, PNG or GIF',
  Subject: 'Subject',
  'The subject is filled in and __count__ characters long':
    'The subject is filled in and __count__ characters long',
  'No subject': 'No subject',
  'Subject too long (__count__ characters): cut in almost every inbox':
    'Subject too long (__count__ characters): cut in almost every inbox',
  'Long subject (__count__ characters): may be cut on mobile and in Outlook':
    'Long subject (__count__ characters): may be cut on mobile and in Outlook',
  'Subject starts like a reply or a forward (__prefix__) without being one':
    'Subject starts like a reply or a forward (__prefix__) without being one',
  'Subject mostly in capital letters': 'Subject mostly in capital letters',
  'Subject repeats punctuation (!!, ??, $$)':
    'Subject repeats punctuation (!!, ??, $$)',
  'Subject has more than one emoji': 'Subject has more than one emoji',
  Preheader: 'Preheader',
  'The preheader is filled in and __count__ characters long':
    'The preheader is filled in and __count__ characters long',
  'No preheader: inboxes show the first words of the body instead':
    'No preheader: inboxes show the first words of the body instead',
  'Preheader too short (__count__ characters)':
    'Preheader too short (__count__ characters)',
  'Short preheader (__count__ characters): some inboxes complete it with the body':
    'Short preheader (__count__ characters): some inboxes complete it with the body',
  'Preheader too long (__count__ characters): inboxes cut it well before':
    'Preheader too long (__count__ characters): inboxes cut it well before',
  'Long preheader (__count__ characters): its end will rarely be seen':
    'Long preheader (__count__ characters): its end will rarely be seen',
  'Personalization tags': 'Personalization tags',
  'Every personalization tag is closed': 'Every personalization tag is closed',
  'Personalization tag not closed (__token__): __excerpt__':
    'Personalization tag not closed (__token__): __excerpt__',
  'Personalization tag not closed in the subject (__token__): __excerpt__':
    'Personalization tag not closed in the subject (__token__): __excerpt__',
  'Personalization tag not closed in the preheader (__token__): __excerpt__':
    'Personalization tag not closed in the preheader (__token__): __excerpt__',
  'Empty blocks': 'Empty blocks',
  'Every block shows something': 'Every block shows something',
  'Empty block: it shows no text and no image':
    'Empty block: it shows no text and no image',
  'Capital letters': 'Capital letters',
  'No long passage is written in capital letters':
    'No long passage is written in capital letters',
  'Long passage in capital letters (__count__ words): __excerpt__':
    'Long passage in capital letters (__count__ words): __excerpt__',
  'Preheader still the sample text of the template: __text__':
    'Preheader still the sample text of the template: __text__',
};
