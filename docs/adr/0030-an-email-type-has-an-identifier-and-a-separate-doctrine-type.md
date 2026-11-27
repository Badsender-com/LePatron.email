# An email type has an identifier like any value; its doctrine type is a separate mapping

- Status: proposed
- Date: 2026-11-18
- Epic: #1631

A company names its email types, and maps each onto one of the six types of the Badsender classification doctrine (editorial, promotional, service, notification, transactional, institutional). Until now one field held that mapping for an email type and the identifier for every other value, so a template could only compare an email type against the doctrine: two finer types of one company (a community newsletter and a relationship email, both editorial) could not be told apart, and an email type mapped onto nothing reached the template under its database id. So an email type gets an **identifier** with the same rules as any other value, and the mapping onto the doctrine moves to a field of its own, the **doctrine type**.

## Decisions

- **The identifier of an email type follows the rules of every value.** Letters without accents, digits, `_` and `-`; unique in the dimension; optional; proposed from the label and editable in the quick add; changing it shows its impact first. Without one, the template receives the database id, as for any value.
- **The doctrine type is optional.** An email type mapped onto nothing loads only the expertises that target no type, and is a point to check, never a refusal (ADR-0026). It is chosen in the quick add as well as in the value's panel, so a whole taxonomy can be built without opening a panel.
- **The template receives both.** `_root_.emailType` is the identifier of the email's type, like any dimension. `_root_.doctrineType` is its doctrine type, empty when the type is mapped onto nothing or the email has none; nothing is guessed. `doctrineType` joins `locale` among the names no company dimension may take. A template comparing `doctrineType` against a literal outside the six types gets a point to check.
- **The AI reads the doctrine type.** Expertises keep targeting the doctrine's vocabulary and are filtered by the doctrine type. The governance context gives the identifier, the label, the definition and the doctrine type of the email's type, and the email's doctrine type on its own for the expertise filter: an email whose type maps onto nothing asks for the expertises targeting no type, not for all of them.
- **Default email types are judged on the doctrine type.** Restoring them adds the doctrine types a company lacks, whatever it called the ones it has, with the doctrine type as identifier, suffixed if already taken.
- **No double meaning left in the code.** The new code reads the doctrine type only from its own field, never from the old meaning of the identifier.

## Considered Options

**The doctrine type as identifier, with free values only through another dimension.** Rejected: the email type is the dimension companies decline by, and the audit of existing templates found several comparing their own email types (eight in one company, three in another).

**A doctrine type made mandatory.** Rejected: a company building its taxonomy for existing templates does not always know the mapping yet, and the taxonomy refuses nothing an admin can fix later.

## Consequences

Email types have been in production since before ADR-0032, which drops the experimental taxonomy data rather than migrating it. That rule does not hold for them: a script, rerunnable and with a dry run, copies the old field into the doctrine type, keeps it as identifier when it is unique in the company, and otherwise proposes one from the label, suffixed on collision. No template compares an email type yet, so nothing it renders changes. Until the script has run, the email types show as mapped onto nothing.
