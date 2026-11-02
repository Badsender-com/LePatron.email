'use strict';

// The fixed values of the two-factor tests (epic #1318), read through
// tests/helpers/two-factor-harness.js.

// RFC 6238, appendix B: the secret "12345678901234567890" (base32 below) and
// the SHA-1 codes it gives at these times, cut to the six digits an
// authenticator app shows. An independent source of truth for the codes.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_TIME = 1111111109 * 1000;
const RFC_CODE = '081804';
const RFC_NEXT_TIME = 1111111111 * 1000;
const RFC_NEXT_CODE = '050471';

const RECOVERY_CODES = [
  'ABCD-EFGH',
  'JKLM-NPQR',
  'STUV-WXYZ',
  '2345-6789',
  'A2B3-C4D5',
  'E6F7-G8H9',
  'JK23-LM45',
  'NP67-QR89',
  'ST2U-3VW4',
  'XY5Z-6A7B',
];

const CHROME_ON_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const NEWER_CHROME_ON_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FIREFOX_ON_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0';
const CHROME_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

module.exports = {
  RFC_SECRET,
  RFC_TIME,
  RFC_CODE,
  RFC_NEXT_TIME,
  RFC_NEXT_CODE,
  RECOVERY_CODES,
  CHROME_ON_MAC,
  NEWER_CHROME_ON_MAC,
  FIREFOX_ON_MAC,
  CHROME_ON_WINDOWS,
};
