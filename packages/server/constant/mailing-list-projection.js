'use strict';

// The heavy fields of a mailing that no list ever shows: the rendered preview,
// the content model, the head CSS and the ignored quality findings (up to 500
// per email, with the users who ignored them). Only the editor reads them
// (findOneForMosaico); left in, every list of mailings would carry them on
// each row, for a table that never displays them.
module.exports = Object.freeze({
  MAILING_LIST_PROJECTION: Object.freeze({
    previewHtml: 0,
    data: 0,
    headCss: 0,
    qualityIgnores: 0,
  }),
});
