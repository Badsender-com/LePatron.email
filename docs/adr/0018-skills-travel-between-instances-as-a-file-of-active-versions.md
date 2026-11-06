# Skills and expertises travel between instances as a file of active versions

- Status: proposed
- Date: 2026-11-04
- Epic: #1406

The platform company writes its skills and expertises on one LePatron instance and needs them on the others (production, dedicated instances), where today they are typed again by hand. A super admin now exports a **skills export**, a JSON file holding the active version of the skills and expertises they select, or of all of them, and imports it on another instance, where each one arrives as a draft that a person publishes.

**A file, not a link between instances.** One instance reading another would need a secret shared between them and addresses to configure, and would not cross isolated networks. The file carries a format number, the instance it came from, the date and the person who exported it; an unknown format, a file over 5 MB or a content that fails validation (every field of a version is typed) is refused whole, before anything is shown.

**Only active versions travel, and they arrive as drafts.** A draft stays on the instance where it is written; the history stays too. On the target, the imported version keeps its number from the source, so both instances speak of the same "2.1", and it lands as a draft: the target's active version keeps serving until a person publishes, the same human review ADR 0014 asks of what an assistant drafts. Activating on import was rejected for that reason; it can come later as an option.

**Nothing is opened to the outside by an import.** Whatever the source says, an imported skill or expertise starts with the platform company as its audience (`platform`) and is not served to assistants, and the person importing owns it. Opening it to every company stays a deliberate act on each instance (ADR 0013).

**An import never overwrites and never goes back.** The preview sorts every item of the file: new, update (the file's version is newer than the target's active one), up to date, or blocked. An item is blocked, with its reason, when both instances hold the same version number with different content, when the target is ahead, when a draft is open on the target, when it is archived there, or when a feature skill's input or output schema does not exist in the target's code. It is blocked too when the file's version number already exists here without being the active one, and when the active version of a skill has another nature here (task or feature, carried by the version since ADR 0013): an update brings a version, not a description, so the title, category and scope stay as this instance has them. There is no forcing in this version: a divergence is settled by hand.

**Dependencies are carried, not enforced.** Selecting a task skill adds the expertises it consumes to the export, and they can be removed. On import, a task skill whose expertise is missing from both the file and the target arrives with a warning, since it still reads; a feature skill whose schema is missing is blocked, since it cannot run. Test cases are part of a feature skill's version and travel with it.

**Item by item.** Expertises are imported before skills, each one on its own; a failure stops nothing else, and the report says what was created, updated, skipped and what failed, with a link to each draft to publish. MongoDB gives no transaction here, and an all-or-nothing import would hide which item failed.

**Not through MCP.** Moving a file between two back offices has no meaning for an assistant, and drafting from an assistant already exists (ADR 0014).

Out of scope: a company's AI configuration (which skill serves which feature, the skill engine), archived items, and the version history.
