'use strict';

// Builds the images of the emails the platform sends (docs/emails) from the
// sources the application already has, so the emails wear the same marks:
//
//   - the logo of the sign-in pages (packages/ui/components/account/
//     login-logo.vue, a white SVG), as a PNG: mail clients do not draw SVG;
//   - the round tile and the icon of the authentication cards (lucide, as in
//     the pages, on --tint-accent, in the darkened accent), as PNGs.
//
// The emails attach them (`cid:`), so nothing is fetched from the application
// when one opens: they show in development and behind a firewall alike.
//
//   node scripts/build-email-images.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'packages/server/email-templates/assets');
const LUCIDE = path.join(ROOT, 'node_modules/lucide-vue/dist/esm/icons');

// The icon of each kind of email: the ones the pages of the application use
// for the same step (lock for a password, shield for the second factor, mail
// for the code, smartphone for a device).
const ICONS = [
  // The card of each email.
  'lock',
  'shield-check',
  'shield-alert',
  'mail-check',
  'smartphone',
  // The three reasons of the welcome: blocks, a check, languages.
  'blocks',
  'badge-check',
  'languages',
];

// The darkened accent of the application (`v-accent-darken1` of its design
// system) for the strokes, the accent at 12 % (`tint-accent`) for the tile.
const ICON_COLOR = '#0091b8';
const TILE = { color: '#00acdc', opacity: 0.12 };

// A lucide icon file is a list of [tag, attributes] pairs: read it as text.
function lucideShapes(name) {
  const source = fs.readFileSync(path.join(LUCIDE, `${name}.js`), 'utf8');
  return [...source.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map(
    ([, tag, attributes]) => {
      const pairs = [...attributes.matchAll(/(\w+):\s*("[^"]*"|[\d.]+)/g)]
        .filter(([, key]) => key !== 'key')
        .map(
          ([, key, value]) =>
            `${key}=${value.startsWith('"') ? value : `"${value}"`}`
        );
      return `<${tag} ${pairs.join(' ')}/>`;
    }
  );
}

function iconSvg(name) {
  // 56 px tile, a 26 px icon in its middle: as `bs-auth-card__icon`.
  const scale = 26 / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
  <circle cx="28" cy="28" r="28" fill="${TILE.color}" fill-opacity="${
    TILE.opacity
  }"/>
  <g transform="translate(15 15) scale(${scale})" fill="none" stroke="${ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${lucideShapes(name).join('\n    ')}
  </g>
</svg>`;
}

function logoSvg() {
  const vue = fs.readFileSync(
    path.join(ROOT, 'packages/ui/components/account/login-logo.vue'),
    'utf8'
  );
  const [svg] = vue.match(/<svg[\s\S]*<\/svg>/);
  return svg.replace(/\s(width|height)="\d+"/g, '');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // 190 px wide in the email (as on the page), drawn at twice that.
  await sharp(Buffer.from(logoSvg()), { density: 300 })
    .resize({ width: 380 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'logo.png'));
  for (const name of ICONS) {
    // 56 px in the email, drawn at twice that.
    await sharp(Buffer.from(iconSvg(name)), { density: 144 })
      .resize({ width: 112, height: 112 })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, `icon-${name}.png`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
