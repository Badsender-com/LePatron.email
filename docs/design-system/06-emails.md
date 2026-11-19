# Notification Emails

The emails the application sends about an account: the password (welcome, new password, saved) and two-factor authentication (code, set up, reset, address changed, recovery code used, trusted device).

**Scope.** These emails belong to the application's design system, not to the brand's. The **Brandbook** governs what speaks _about_ LePatron (the website, decks, marketing emails) and gives the voice. The mailings people produce in the editor are theirs. Inventory, audit and decisions: [docs/emails/](../emails/README.md).

> **Rule.** A notification email is a sign-in card sent by mail. Take its tokens, its vocabulary and its accessibility rules from this design system. Do not bring Fraunces, the canvas ground or the site's saffron button into it.

---

## The card

One template, [account-email.html](../../packages/server/email-templates/account-email.html), filled with the texts of each email in French and in English. It follows `BsAuthCard` ([auth-card.vue](../../packages/ui/components/account/auth-card.vue)).

| Element    | Token / value                                                           | Notes                                                                                                  |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Backdrop   | `v-primary-base` `#093040`, over it the sign-in glow                    | Solid primary is the fallback (see Backdrop)                                                           |
| Logo       | White lockup on the backdrop, 190 px, `alt="LePatron"`                  | PNG, hosted: SVG is not drawn by mail clients                                                          |
| Card       | `white`, `r-lg` 10 px, `gray-200` hairline, `shadow-modal`, 480 px wide | Fluid (`max-width`, no media query); 20 px side padding under 480 px; a fixed 480 px table for Outlook |
| Icon tile  | 56 px round, `tint-accent`, lucide icon in `v-accent-darken1`           | One icon per email, `alt=""` (it decorates)                                                            |
| Title      | `h1`, Inter 20 / 600, `v-primary-base`, centred, line height 150 %      | One per email, equal to the `<title>`                                                                  |
| Text       | Inter 14, `gray-700` `#374151`; 16 under 480 px                         | Left-aligned (long text is never centred)                                                              |
| Muted text | `gray-600` `#6b7280`, 14 (16 under 480 px)                              | On white only: 4.8:1                                                                                   |
| Block      | `surface-muted` `#fafafa`, `gray-200` hairline, `r-md` 7 px             | Benefits of the welcome; same as the account block of the card                                         |
| Action     | Under a `gray-200` rule, right-aligned, one per card                    | 45 px tall; full width and 48 px tall under 480 px                                                     |
| Footer     | Inter 14, white, on the backdrop                                        | One sentence on who sends it, one on personal data                                                     |

## The button

`r-sm` 5 px, Inter 14 / 500, sentence case, never uppercase, sized to its label. The link is a block inside a rounded cell, so the whole button is clickable; the hover darkens the fill on the cell, never on the link.

**It is `v-primary-base` with white text (14:1), not the accent.** White on `v-accent-base` is 2.7:1 and fails the accessibility grid (critical criterion). The README of the app system allows this: where accessibility is a hard requirement, the primary action takes the primary colour, and says so. Hover `#072530`. In dark mode, where the primary would vanish on the card, the button turns to the accent with a `#093040` text (5.3:1).

The label says where the button leads ("Choisir mon mot de passe", "Open LePatron"), never "Sign in" for every email.

## Links

Underlined, in `v-primary-base` (13.9:1). The app uses `v-accent-darken1`, which is 3.6:1 on white: below the 4.5:1 of the grid. The underline stays.

## Backdrop and glow

The backdrop is the sign-in glow as it is: `radial-gradient(at 100% 100%, #00acdc 0%, #093040 50%)`, over the solid `#093040` that a client drawing no gradient (Outlook for Windows) keeps, declared first and again as `bgcolor`.

**Up to 960 px (the tablet breakpoint of the app) the glow is turned off** by a media query. The footer is the last thing in the email and sits on the glow; below 960 px its white text falls under 4.5:1 (2.9:1 at 500 px, 4.0:1 at 760 px). From 961 px it is 4.6:1 at the worst.

The contrast of white on the glow, for the ellipse of the screen (farthest corner, radii of the box sides × √2; accent at 0 %, primary at 50 %), is computed in the tests from the CSS. **Any change to the glow, its stops or the footer colour must keep that test green**, not just look right.

## The code

A one-time code is shown apart, under the title, as the code field of the app: mono 28 / 600 in `v-primary-base`, letter spacing 0.3 em, on `tint-accent`. It is not in the title, the subject or the preheader. It stays six contiguous digits (copied in one gesture); a screen reader reads it as a number.

## Words

- **Voice** (Brandbook): formal _vous_, short sentences, facts over adjectives. Never "révolutionnaire", "booster", "clé en main". The name is **LePatron**, one word.
- **Vocabulary** (the app): a **mailing** is the campaign, an **email** is an address or the message you are reading. The platform is "la plateforme de gouvernance email et CRM", not only an "email builder".
- **Languages**: French and English only, as the app. Anything else is written in English and logged. Every email has a subject, a title, a preheader, a text and, unless it has nothing to do, a button, in both.
- **Subject**: `LePatron – <subject>`, in the member's language. Sentence case.

## Images

The logo and the icons are built from the sources of the app (`login-logo.vue`, the lucide icons of the sign-in pages) by `node scripts/build-email-images.js`, into [public/media/email/](../../public/media/email/). **The application hosts them and the emails link them by absolute addresses** (`<site>/media/email/logo.png`, the scheme and host of the other links), not as attachments. The host must be reachable by the mail client: not `localhost` in production.

Drawn at twice the size they are shown. Blocked images must not empty the email: the logo has its `alt`, the icons decorate.

## Accessibility

Each email is read against the Badsender grid (60 criteria, [docs/emails/audit-accessibilite.md](../emails/audit-accessibilite.md)): `lang` on `html` and on the wrapping `div`, a `<title>`, one `h1`, a preheader, layout tables with `role="presentation"`, a text version, 14 px text (16 under 480 px), 150 % line height, 4.5:1 contrast, a dark mode, no script. The tests in `tests/server/emails/` check them for every email, in both languages.

## Adding an email

1. Its texts, in French and in English: `subject`, `title`, `preheader`, `desc`, and a `button` if it leads somewhere (two-factor emails: [two-factor.emails.js](../../packages/server/two-factor/two-factor.emails.js); password emails: [email-texts.js](../../packages/server/email-templates/email-texts.js)).
2. An icon, from `ICONS` of [email-template.js](../../packages/server/email-templates/email-template.js); a new one is added to `scripts/build-email-images.js`, and the PNGs rebuilt.
3. It is sent through `composeEmail`, which gives the subject, the text and the HTML.
4. Add it to `EMAILS` of [tests/helpers/platform-emails.js](../../tests/helpers/platform-emails.js): the contract tests then run on it.
5. Look at it: send it to maildev (`http://localhost:1080`) from the running application, in both languages, in light and dark mode, and under and over 960 px.
