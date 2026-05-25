// External URLs referenced from the UI. Kept in one place so a white-label
// or environment-specific rebrand only has to edit this file (and optionally
// override via env vars at deploy time).

const HELP_DOCS_URL = process.env.HELP_URL || 'https://docs.lepatron.email';

const BADSENDER_HOME_URL = 'https://www.badsender.com';
const LEPATRON_HOME_URL = 'https://www.lepatron.email/';

// Localized contact pages on the Badsender marketing site.
const BADSENDER_CONTACT_URLS = {
  fr: `${BADSENDER_HOME_URL}/contact/`,
  en: `${BADSENDER_HOME_URL}/en/contact/`,
};

module.exports = {
  HELP_DOCS_URL,
  BADSENDER_HOME_URL,
  LEPATRON_HOME_URL,
  BADSENDER_CONTACT_URLS,
};
