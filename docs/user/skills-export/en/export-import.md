# Exporting and importing skills and expertises

Skills and expertises are written on one LePatron instance. To have them on another (production, a dedicated instance), you **export** them to a file, then **import** that file on the other instance. Nothing happens on its own: it is always a file a super admin chooses to carry over.

For **super admins** only, in **Settings › Super admin › Skills & Expertise**.

## What an export holds

- **The active version** of each chosen skill and expertise, with its number, its content, its changelog and its release notes. For a feature skill, its template, its schemas and its test cases.
- **What describes them:** title, description, category, scope, filters, nature.
- **Where it comes from:** the instance, the date and who exported it.

It holds **no** drafts, **no** version history, and nothing that belongs to the instance: the audience, being served to assistants, the owner. An archived item or one never published is not exported.

## Exporting

1. In the **Skills** or **Expertise** tab, check the items to export. Those with no active version cannot be checked.
2. A bar above the table counts the selection.
   - For a **task skill**, the expertises it consumes are added to the export and listed in the bar. Remove those the other instance maintains on its own.
3. Click **Export the selection**: the file `lepatron-skills-<instance>-<date>.json` downloads.

To carry everything at once, **Export all**, at the top of the page, exports every active skill and expertise.

## Importing

1. On the other instance, click **Import**, at the top of the page, and choose the file. It is 5 MB at most.
2. Click **See the preview**. A file that cannot be read, of another format or malformed is refused whole, with the reason. Otherwise nothing is written yet: the preview says, for each item, what the import would do.

| State          | What it means                                                       |
| -------------- | ------------------------------------------------------------------- |
| **New**        | It does not exist on this instance.                                 |
| **Update**     | The file holds a newer version than the active one here.            |
| **Up to date** | Same version, same content: nothing to do.                          |
| **Blocked**    | The import will not touch it; the reason is written under the item. |

An item is blocked when:

- **the two instances diverged:** same version number, different content. To be settled by hand;
- **a newer version exists here:** an import never goes back;
- **a draft is open here:** publish or delete it first, an import never overwrites it;
- **this version already exists here without being the active one**, archived for instance;
- **it is archived here;**
- **its schema does not exist on this instance:** a skill names a schema that lives in the code. The instance is not up to date.

A task skill missing an expertise, both here and in the file, is imported anyway, with a warning: it reads, but without that expertise.

A skill whose active version has another nature here (task or feature) is imported as an **update**, with a warning: the imported draft keeps the nature of the file's version, and publishing it changes the skill's nature.

3. New items and updates are checked. Uncheck those you do not want, then click **Import the selection**.

## After the import

An update brings a version, not the description: the title, category and scope stay as this instance has them.

Each imported item arrives **as a draft**, with the version number it has on the instance it comes from: both instances then speak of the same "2.1". On an update, the active version keeps serving until the draft is published.

An imported item:

- is open to the **platform company** only, whatever its audience was;
- is **not served to assistants**;
- is **owned** by the person who imported it.

The report says what was created, updated, skipped or failed, with a link to each draft. They still have to be reviewed and **published**, then opened to their audience if needed, as any draft.

A failing item does not stop the others from being imported: the report gives the reason.
