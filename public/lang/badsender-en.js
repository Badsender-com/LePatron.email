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

  // Editor interface
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

  // DeleteBlockModal translations
  'title-delete-block': 'Delete block',
  'confirm-delete-block': 'Are you sure you want to delete the custom block:',
  'deleting-block': 'Deleting block...',
  'delete-block': 'Delete',
  'delete-block-success': 'Block deleted successfully',
  'delete-block-error': 'Error deleting block',
};
