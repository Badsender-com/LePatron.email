'use strict';

/**
 * Templates for the acceptance tests of ADR-0024 (epics #1514 and #1515).
 *
 * A company declines its emails by silo (a publishing division) and, under
 * each silo, by brand. Before the taxonomy, a template held the brand in one
 * property per silo (`brand_youth`, `brand_school`); moved onto the taxonomy, it
 * reads one `siloBrand` dimension, and adopts the former value from
 * `brand_[silo]`.
 */

// Reads silo and siloBrand, the design tokens mainColorVar and ctaColorVar, and
// the audience in a display condition. Never reads the market.
const TEMPLATE_READING_SILO_AND_BRAND = `<!DOCTYPE html>
<html>
<head>
  <style type="text/css">
    @supports -ko-blockdefs {
      silo { label: Silo; widget: select; options: youth=Jeunesse|school=Scolaire|travel=Voyage; }
      siloBrand { label: Marque; widget: text; adopt: brand_[silo]; }
      mainColorVar { label: Couleur principale; widget: color; category: hidden; }
      template { label: Options; properties: headerVisible=true silo=youth siloBrand=little_reader mainColorVar=#000000; version: 1.0.0; }
      ctaBlock { label: CTA; properties: buttonStyle; }
    }
  </style>
</head>
<body>
  <div data-ko-display="headerVisible">
    <img style="-ko-attr-src: @['https://img.example/logo/' + _root_.silo + '/' + _root_.siloBrand + '.png']">
  </div>
  <div data-ko-container="main">
    <div data-ko-block="ctaBlock">
      <a style="-ko-background-color: @[_root_.ctaColorVar]">Discover</a>
    </div>
  </div>
  <div data-ko-display="_root_.audience eq 'teachers'">For teachers</div>
  <td style="-ko-background-color: @[_root_.mainColorVar]"></td>
</body>
</html>`;

// A newsletter template reading only the market.
const TEMPLATE_READING_MARKET = `<!DOCTYPE html>
<html>
<head>
  <style type="text/css">
    @supports -ko-blockdefs {
      template { label: Options; properties: market; version: 1.0.0; }
    }
  </style>
</head>
<body>
  <p data-ko-display="_root_.market eq 'be'">Belgique</p>
</body>
</html>`;

module.exports = { TEMPLATE_READING_SILO_AND_BRAND, TEMPLATE_READING_MARKET };
