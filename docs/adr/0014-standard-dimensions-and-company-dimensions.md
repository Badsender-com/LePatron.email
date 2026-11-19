# Two standard dimensions; every other dimension is the company's, and an email carries one value of each

- Status: proposed
- Date: 2026-10-29
- Epic: #1351

The CRM governance module will hold content that varies by the way a company declines its emails: by market, brand, audience, email type. Every one of its sections needs those dimensions first. So a company declares its own dimensions and their values, chooses them on an email, and they reach the template and the AI context. Only two dimensions belong to the product, because the Badsender classification doctrine defines them: the **email type** and the **email trigger**. Everything else, market, language and brand included, is a **company dimension**, and nothing in the product treats it apart. An email keeps its own field for each standard dimension and carries its company dimensions as one list, with at most one value per dimension.

## Considered Options

**Market, language and brand as product dimensions.** The governance prototype hardcoded them, next to the email type, with one field each on the mailing. Rejected: none of the three is in the doctrine, and the audit found companies declining their emails by dimensions nobody else has. A product dimension per case means a release per company. A company dimension means an admin.

**One mailing field per dimension.** It is the shape the email type already has. Rejected because a company dimension is declared at runtime, and a schema cannot grow a field for it. A list of values, each knowing its dimension, can hold any dimension a company declares.

**The email trigger as taxonomy values.** It would make the trigger look like any other dimension. Rejected: the doctrine allows exactly two values, and a company adding a third ("Scenario" next to "Automated") is the drift the classification exists to prevent. The trigger stays a closed list that no company edits, and the taxonomy screen shows it read-only next to the email type, so the governance module and the AI see one list of dimensions.

## Consequences

Nothing is ever rewritten silently, so each change that would invalidate existing data is refused or reported instead:

- Deleting a value is refused while an email uses it, or while another value lists it in its availability. Removing it from that list would leave an empty availability, which means "offered everywhere". The refusal gives the count, and deactivating is always possible.
- Narrowing an availability does not touch the emails that already use the combination. The editor reports it as no longer offered, and the server only checks the values a request changes. An email in progress never becomes impossible to save because of a setting changed elsewhere.
- Deactivating a dimension keeps its values on the emails. It stops offering, publishing and sending the dimension to the AI, and reactivating restores all of it.
- A dimension can be deleted only while it has no values, which frees its name. A standard dimension can be neither deleted nor deactivated.

A company dimension may hang under the email type, whose values are real values, but not under the trigger, whose values are not stored. Dimensions are optional on an email: making one mandatory is a quality-control rule, not a taxonomy one.

What a governance rule attaches to, one value or a combination of values, is deliberately left to the governance module. The taxonomy exposes dimensions, values and their resolution, and has no notion of a rule.

The existing taxonomy data is experimental. It is dropped rather than migrated.
