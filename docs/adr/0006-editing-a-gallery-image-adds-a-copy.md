# Editing a gallery image adds a numbered copy; it never replaces the original

- Status: proposed
- Date: 2026-10-10
- Epic: #843

US-10 ([docs/gallery-redesign/USER_STORIES.md](../gallery-redesign/USER_STORIES.md)) asks for the opposite — "à la sauvegarde dans Konva → remplacement de l'image originale (pas de nouvelle version)" — and the story's own test plan then asks to verify "que l'image dans les emails utilisant cette image n'est pas affectée". Those two cannot both hold: a gallery image is addressed by URL, and every email already built with it points at that URL, so replacing the bytes behind it changes all of them at once. Editing therefore produces an additional gallery entry, named after the original with the next free number in its series (`photo.png` → `photo (2).png`), and the editor's save button reads "Save as a new file" so the user is never promised otherwise.

## Considered Options

- **Overwrite the stored file.** What the story says. Rejected on two counts. It silently rewrites emails the user is not looking at — including ones already sent to a proof list — and it is not reachable from where the code stands: the stored name is the md5 of the content (`<mongoId>-<hash>.<ext>`), so edited bytes are a different file by construction, and `addFiles` only ever `$push`es. Making it work would mean a second, name-addressed write path next to the content-addressed one.
- **Overwrite, with a warning listing the emails affected.** The honest version of the above. Deferred rather than rejected: it needs a reverse index from image to mailings, which does not exist, and the product owner's own answer to the contradiction was to ship the additive behaviour first and discuss replacement with the team.
- **Reuse the original label on the copy.** Simplest, and no invented vocabulary. Rejected because the grid and the search would then show several rows under one name, distinguishable only by their thumbnail.

## Consequences

- **A gallery can grow faster than before.** Three rounds of adjustment leave three images. Deleting the discarded ones is a manual step, and nothing prompts for it.
- The numbering is computed in the browser, from the gallery the panel already mirrors. Two people editing the same image at the same moment can both land on `(2)`; the result is two entries under one label, which is the ordinary pre-existing case of a duplicate name and nothing worse.
- **Editing a GIF or an SVG is not offered at all.** The upload pipeline skips the editor for both because it flattens what it opens, so the "edit" would have re-uploaded identical bytes — and identical bytes are the same md5, which the server treats as a no-op. The thumbnail hides the button rather than leaving one that does nothing.
- The same mechanism, and the same naming, now serve the pencil on an image block, which had been producing a gallery entry called `edited-image.png` every time.
