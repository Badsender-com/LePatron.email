# A gallery thumbnail is an image area plus a label band, and the hover overlay never covers the band

- Status: proposed
- Date: 2026-10-09

The remaining gallery stories each add something to the same 118px thumbnail — a hover overlay of actions (US-08), a metadata tooltip (US-09), relaunching Konva (US-10), renaming inline (US-11) — and written as they stand they collide: the overlay is specified at the bottom of the thumbnail, which is exactly where the label sits and exactly what a rename has to double-click. So the thumbnail is split into an image area and an opaque label band of fixed height, the overlay is absolutely positioned inside the image area only, and the label band stays clickable at all times. Rendered at the real cell size against real images, the two layouts turned out nearly indistinguishable, so the deciding factor was that the band makes non-overlap structural instead of a pixel offset that the next size change would silently break.

## Considered Options

- **Keep the label overlaid on the image, and stop the overlay short of it.** What US-05 shipped. Rejected: it keeps working only while the magic offset matches the label's height, the label's legibility depends on whatever image is behind it, and nothing fails loudly when the two drift apart.
- **Follow the reference mockup literally.** Its overlay spans the whole thumbnail, buttons included, so it covers the label band too — the collision is in the mockup as well, just less visible at the larger size it was drawn for.

## Consequences

- The image area loses the band's height, so `object-fit: cover` crops a little more. Accepted as cheap to revisit: it is a CSS change, not a structural one.
- **A single click on a thumbnail inserts the image into the selected block** — behaviour this redesign preserves unchanged. The label band therefore stops click propagation, as the delete button already does, or the first click of a rename double-click would insert the image.
- **Renaming is reachable two ways**: double-click on the label, as the story specifies, and a button in the overlay. A double-click is invisible to anyone who does not already know it and cannot be performed on a keyboard; the button covers discoverability and accessibility without removing the gesture.
- The overlay carries three actions, not the two the mockup draws: edit, rename, delete. All three fit at 118px — verified at real size.
- **The tooltip opens outside the thumbnail**, since the overlay already owns the space inside it.
- **US-08 and US-10 ship together.** US-08 alone would put an edit button on screen that does nothing until US-10, and US-10 has no entry point without US-08's overlay. Renaming does not depend on either and can land first — it is also the only way to repair the labels of images that predate the V1 model, which the migration could only seed from their technical file name.
