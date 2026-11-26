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

`__proto__`, `constructor` and `prototype` are refused: the editor keys its objects by dimension name, and under those three a chosen value would not be stored as data but lost without a word. Every other name stays allowed, the names of template options included, because a dimension is meant to be able to fill a template option.

A name that differs from an existing one only by case (`Market` beside `market`) is two properties for a template, but almost always a typo, and one the final name would make permanent: the editor would show two selects with the same label, and templates read only one. The server answers a conflict naming the existing dimension until the admin confirms the name; the exact same name stays refused, confirmed or not.

An update refuses the name outright. Making renaming possible later is a migration that rewrites every template reading it, under warning. It is not a relaxed validation.

A mistyped name is fixed by deleting the dimension while it still has no values, which frees the name (ADR-0032). Once it has values, the only path is to deactivate it and declare a correctly named one beside it. That puts the weight on the creation form, which has to say plainly that the field is final.
