# The language of an email comes from a role a company dimension carries

- Status: proposed
- Date: 2026-11-12
- Epic: #1501

The AI features, the expertises and the translation need the language of an email in a normalised form (`fr`, `fr-BE`), and an email holds none: the translation guesses it from the preview's `<html lang>`. Language and market are company dimensions (ADR-0014), with free labels and free identifiers. So a company dimension may carry a **role**: `language`, `country` or `locale`. Each value of that dimension then carries a **normalised code** from a closed list, and the language of an email is computed from the values it carries, at read time.

## Decisions

- **Three roles, at most one dimension per role in a company.** `language` takes an ISO 639-1 code (`fr`), `country` an ISO 3166-1 alpha-2 code (`BE`), `locale` a BCP 47 tag (`fr-BE`) for a company declining its emails by a combined dimension (a "market-language"). The email type and the trigger carry no role. The roles do not depend on nesting: a language dimension under a market dimension is the usual case.
- **The locale of an email.** A `locale` role decides it alone. Otherwise it is composed from the `language` and `country` values: `fr` and `BE` give `fr-BE`, `fr` alone gives `fr`. A value with no code, no value, or a deactivated dimension gives `null`: nothing is guessed, and each consumer decides what it does without a language. A deactivated value the email still carries counts, like everywhere else.
- **The code is a field of its own, optional, not unique.** The identifier stays what templates compare (`_root_.market eq 'bel_fr'`) and stays free. Two values may share a code ("French" and "Plain French" are both `fr`). A role may be given to a dimension whose values have no code yet; the screen says how many lack one.
- **Never stored on the email.** Computed from its values by one server function, so moving a role or editing a code takes effect on every email at once, with no migration.
- **Published to the template as `locale`**, a name no company dimension may take, for a template writing `<html lang>`.
- **The translated copy follows.** Copying an email into another language picks, for its language value, the active value whose code matches the target language and is offered under the email's market; for a `locale` role, the value matching the target language with the current country. With no such value or several, the copy carries none, and the response says so. The market never changes in a translation.
- **Full code lists.** Every ISO 639-1 language, not only those the translation provider knows: a language with no machine translation is still one the AI and the expertises read. The translation provider's variants (`en-gb`, `pt-br`) are derived from the locale when translating, never stored.

## Considered Options

**The language as a third standard dimension.** Rejected: ADR-0014 keeps the standard dimensions to the doctrine's two. It would force a language on every company, and take away the freedom to hang the language under the market.

**The identifier as the normalised code.** One field fewer, but it would impose a format on a string templates already compare against, and break those reading `bel_fr`.

**A language stored on the email.** Rejected: it would duplicate what the email's values already say, and drift as soon as an admin corrects a code.

## Consequences

The language in which governance content is written and translated is a separate subject, left out here: a Dutch-speaking manager reads in Dutch the rule about writing in French.

Consumers on other branches (the expertises of the MCP server, the spelling correction) read the same function when they land.
