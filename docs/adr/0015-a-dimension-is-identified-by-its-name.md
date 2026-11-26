# A dimension is identified by its name, and the name is write-once

- Status: proposed
- Date: 2026-10-29
- Epic: #1351

A company declares its own dimensions (ADR-0032), so dimensions are records instead of an enum. A dimension is identified by its **name** (`market`, `emailType`, `audience`) and not by its id, because that name is what a template reads: a dimension called `market` is the reason `_root_.market` resolves, and the reason a value chosen on an email reaches the template property of the same name. The name cannot be changed afterwards.

## Considered Options

**An id, with the name as an ordinary attribute.** The usual shape, and it makes renaming free. It also means the one string the template contract rests on lives in two places, the dimension and every template reading it, with a lookup in between. That lookup would be a second source of truth for the contract, and nothing would keep the two in step.

**The name as identifier, renameable.** Rejected for what a rename does rather than for what it costs: every template reading that property stops resolving, silently, and the blocks that depend on it render nothing.

## Consequences

A name has to be a valid template property name (`[A-Za-z_][A-Za-z0-9_]*`), because a dimension a template cannot read is a dimension no template can consume. The taxonomy screen refuses anything else before the server does. The name has a length limit of its own, 60 characters (`DIMENSION_NAME`), refused with that limit like any malformed request.

The names every JavaScript object already answers to are refused: those of `Object.prototype` (`__proto__`, `constructor`, `hasOwnProperty`, `toString`, `valueOf`…), and `prototype`. The editor keys an email's values by dimension name. Under `__proto__` a chosen value is not stored as data but sets the object's prototype, and is lost without a word. Under the others the value is stored, but an email with no value for that dimension reads back an inherited function instead of nothing, and code calling `hasOwnProperty` on those values throws once a value sits there.

The root properties of an email's content that the editor builds itself are refused too: `type` (the template's name), `theme` (the theme's styles), `mainBlocks` (the list of blocks) and `customStyle`. They are not template options but the editor's own structure, and the editor publishes a dimension to the root property of the same name: a dimension called `theme` would overwrite the email's styles each time an email opens. The editor also writes only into a root property that holds a plain value, never an object or a list, so a piece of structure missing from this list is still not overwritten.

Every other name stays allowed, the names of template options included, because a dimension is meant to be able to fill a template option.

What the editor publishes under that name follows three rules:

- A template option fed by an active company dimension that has values to offer, or by the email type or the trigger of the email settings, is hidden from the template options: the dimension decides, and two selects for one property could only disagree. A deactivated dimension gives the option back, and so does one declared before its values or whose values are all deactivated, since hiding the option would leave nothing in its place.
- An empty value is written only once the email has had a value for the dimension, when it opened or since: the writer emptied it. An email that never had one leaves the property as its content holds it, a template option set before the dimension existed included.
- Only an identifier matching `^[A-Za-z0-9_-]+$` reaches the template; any other is published as the value's id, because a template may render a root property as HTML. The server's own format check on identifiers comes with #1359 (commit a471fdc93); the email type's mapping onto the doctrine stays free, so the editor's check stays.

A name that differs from an existing one only by case (`Market` beside `market`) is two properties for a template, but almost always a typo, and one the final name would make permanent: the editor would show two selects with the same label, and templates read only one. The server answers a conflict naming the existing dimension until the admin confirms the name; the exact same name stays refused, confirmed or not.

An update refuses the name outright. Making renaming possible later is a migration that rewrites every template reading it, under warning. It is not a relaxed validation.

A mistyped name is fixed by deleting the dimension while it still has no values, which frees the name (ADR-0032). Once it has values, the only path is to deactivate it and declare a correctly named one beside it. That puts the weight on the creation form, which has to say plainly that the field is final.
