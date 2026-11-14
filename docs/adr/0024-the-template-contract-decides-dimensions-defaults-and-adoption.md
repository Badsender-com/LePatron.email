# The template contract decides which dimensions an email offers, and where their values are adopted from

- Status: proposed
- Date: 2026-11-13
- Epic: #1514, #1515

Today the editor offers every active company dimension on every email, whatever its template (ADR-0014), and a template only ignores the properties it does not declare. A company with several templates sees, on an email, dimensions its template never reads. A new email starts with no value, where a template written before the taxonomy opened on its own defaults. And moving an existing template onto the taxonomy loses what its emails had chosen: replacing a template whose emails held their brand in one property per parent (`brand_<silo>`) by one reading a `siloBrand` dimension kept the silo, lost the brand, and with it every design token. Three decisions answer this, and they share one notion, the **template contract**: the root properties a template declares or reads, and the design tokens it reads.

## Decisions

- **The server reads the template contract** when a template is saved, and stores it on the template: the root properties it declares or reads (`_root_.x`), the design tokens it reads, and the adoption sources it declares. A template saved before this is read the first time it is needed.
- **A dimension has a scope.** "Every email", the default, is for a classification dimension (an audience, a market). "The templates reading it" is for a rendering dimension: a template reads a dimension when its contract names it, or reads a design token one of its values carries. The standard dimensions and a dimension with a role (ADR-0023) are always "every email": a translated email must not lose its language because its template does not print it.
- **Out of scope is treated like deactivated.** A value an email carries for a dimension its template no longer reads stays on the email, and is not offered, published, or sent to the AI. It all comes back if the template reads it again.
- **The hierarchy stays the company's.** "French is offered under Belgium" is a business fact, not a template's. A child dimension whose parent is out of an email's scope is offered with all its values.
- **A dimension has a default value.** At the first level, one value is marked default. For a child dimension, a value is marked default under some of the parent values it is offered under ("default under"), at most one per parent value. A conflict is refused with the value already holding the place.
- **Where an empty dimension takes its value from**, in this order: adoption from the email's content (which also carries the template's own defaults, `silo=lisez`); the company's default (not for a child whose parent is out of scope); the only value offered under the parent; nothing. Applied when an email is created, by the editor or by the server, and when a parent change leaves a child value no longer offered. Never to a value the user chose and that is still offered, and never retroactively. The value applied is stored on the email.
- **Adoption replaces a migration script.** When an email has no value for a dimension, the editor reads the template property of the same name in the email's content, and takes the value whose identifier it holds. A template renaming the property declares its source in the contract, depending on the parent: `adopt: brand_[silo]`, where `[silo]` is the identifier adopted for `silo`, so parents are adopted before their children. An identifier no value carries, or a combination not offered, is not adopted: it is reported, and the rest of the order applies. Adoption reads the content before the editor first publishes to it, so a value the user emptied and saved never comes back.
- **The same adoption, in bulk.** On a template's page, the super admin previews, for every email of the template, what would be adopted and what would not, then applies it. Applying writes taxonomy values only, on empty dimensions only, never the content. An email's rendered HTML stays the one it was saved with until it is opened again.
- **A template field fed by a dimension is hidden** in the editor's template options: the dimension decides, and two selects for one property can only disagree.

## Considered Options

**A database migration per template.** What the first migration of a test template did, and it worked: identical HTML on every email. Rejected as the way to do it: a script per template replacement, written and run by hand, where the contract can declare the rule once and the editor and the bulk action share it.

**Versioning templates.** It would keep the previous markup next to the new one. Not needed for adoption: the content of each email still holds the old properties until it is saved again, and that content is the archive adoption reads. Left for the day reverting to a previous template is wanted.

**Scope inferred from the contract alone.** No setting at all, but a classification dimension that no template prints (an audience the AI reads) would vanish from every email.

**Scope as a list of templates per dimension.** Explicit, but every new template means revisiting every dimension.

**The company's default before the template's.** Rejected: a template knows its own world, and one made for a single brand should open on that brand.

**A list of adoption sources** (`adopt: brand_a brand_b`). Rejected: old content keeps stale properties (`brand_lisez: lisez` on an email whose silo was changed), so the first filled one is often the wrong one. The source has to depend on the parent.

## Consequences

Rendering a whole template's emails again, without opening them, needs to run the editor on the server: out of scope.
