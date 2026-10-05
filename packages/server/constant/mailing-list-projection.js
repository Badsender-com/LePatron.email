'use strict';

// The heavy fields of a mailing that no list ever shows: the rendered preview,
// the content model and the head CSS. Only the editor reads them
// (findOneForMosaico); left in, every list of mailings would carry them on
// each row, for a table that never displays them.
module.exports = Object.freeze({
  MAILING_LIST_PROJECTION: Object.freeze({
    previewHtml: 0,
    data: 0,
    headCss: 0,
  }),
});
