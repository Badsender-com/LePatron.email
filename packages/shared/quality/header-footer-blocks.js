'use strict';

// The header and footer blocks of an email, its frame: legal notice, view
// online, preheader. Told apart by their block type, as the template guide
// documents it (docs/TEMPLATE_DEVELOPER_GUIDE.md, "Header and footer block
// names"): a type that is a header or a footer (`headerBlock`,
// `headerBlockV2`, `preheaderBlock`, `footerBlock`, `footer-legal`,
// `footerSocialBlock`, `sectionHeader`), not a content block that merely
// mentions one (`HeaderAndText`), nor a legal block the template does not
// name as a footer.
// The quality control lets their text be smaller; text generation leaves them
// out of the email it sends, as they are not its message.
const HEADER_OR_FOOTER = /^(pre)?header([-_]?block)?(v\d+)?$|^footer|(header|footer)([-_]?block)?$/i;

const isHeaderOrFooterBlock = (blockType) =>
  HEADER_OR_FOOTER.test(blockType || '');

module.exports = { isHeaderOrFooterBlock };
