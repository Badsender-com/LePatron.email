'use strict';

// What the email copy sent to text generation may hold: room for a long
// newsletter, not for whatever a request carries, since it is sent whole to
// the model on the company's key. The server refuses beyond; the editor cuts
// the copy to fit before sending it.
const EMAIL_COPY_LIMITS = Object.freeze({
  maxItems: 200,
  maxTextLength: 4000,
  maxTotalLength: 32000,
});

/**
 * The copy cut to the limits, keeping the beginning of the email: the first
 * pieces in reading order, a piece too long cut at the limit, and the last
 * piece that fits cut to what is left.
 *
 * @param {Array<{role: string, text: string}>} copy in reading order
 * @returns {Array<{role: string, text: string}>}
 */
function fitEmailCopy(copy) {
  const fitted = [];
  let left = EMAIL_COPY_LIMITS.maxTotalLength;
  for (const piece of copy) {
    if (fitted.length === EMAIL_COPY_LIMITS.maxItems || left <= 0) break;
    const text = piece.text
      .slice(0, EMAIL_COPY_LIMITS.maxTextLength)
      .slice(0, left);
    if (!text.trim()) break;
    fitted.push({ ...piece, text });
    left -= text.length;
  }
  return fitted;
}

module.exports = { EMAIL_COPY_LIMITS, fitEmailCopy };
