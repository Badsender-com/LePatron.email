# The instance relays the external images of a mailing's preview

- Status: proposed
- Date: 2026-11-08
- Epic: #1485
- Amends: ADR 0012 (the email in the conversation)

The preview of a mailing in an assistant (#1342) is an MCP App the client frames under the CSP it declares: no connection, and images from the instance only, where the editor uploads them. A template often hosts its own images elsewhere, on a company's CDN or an image host: the logo and the icons of a footer then show as their alternative text in the conversation, while the editor shows them. The preview no longer looks like the email.

**The instance relays them.** When LePatron prepares the preview it hands an app, it rewrites the address of every image hosted outside the instance, in an `<img>`, a `background` attribute or a `url()` of a style, to an address of the instance that names that image and carries its signature. The CSP of the app does not change. The address answers the image the instance fetches then: over https only, with no private or internal address at any hop, up to three redirects, 10 seconds and 5 MB in all, and only a PNG, a JPEG, a GIF or a WebP, recognised by its content. An SVG is refused: served from the instance's origin, one opened on its own could run a script. An image refused, too large or unreachable shows as its alternative text, as before. Nothing is kept on the server: the image is served with a day of cache, which the client and its browser keep.

**A signed address, for one image, with no expiry.** The frame of the app has no LePatron session, so the address is public: its signature, an HMAC of the image's address under the instance's secret, is what makes it valid, and it allows that one image only. It has no expiry: a conversation reopened months later shows its images again. Whoever holds the address can have the instance fetch that image, and nothing else; the route has no rate limit of its own.

**Every image, the pixels included.** ADR 0012 kept images to the instance so that no tracking pixel loads. The instance now relays them like any image: a pixel can be fetched from the server when an assistant shows a preview. Telling a pixel from an image was rejected: a size or a pattern misses some and hides real images, and a list of tracking domains has to be kept.

**The assistant still reads the original addresses.** The relayed preview travels for the app only, in the result's `_meta`. Asked as HTML, the answer keeps the original addresses, and the relayed preview travels beside it in `_meta` when an image was relayed, which the app reads first: twice, but the assistant never quotes an address of the relay as the email's.

## Considered Options

- **Allowing the company's CDN in the CSP**: rejected as the only way. It needs a host per company, and every other host, a template's own included, would stay hidden.
- **A list of image domains per instance**: rejected, a list to keep that is always one host behind.
- **A server cache of the images**: rejected, a storage to purge for what the client caches already.
- **An expiring address**: rejected, an old conversation would lose its images.
- **A rate limit on the route**: rejected, the signature limits it to images seen in a mailing.

## Consequences

- A public route serves the relayed images; it fetches with the guarded helper of the outgoing calls.
- The preview of a mailing whose images are all on the instance is unchanged.
- An email's tracking pixels can be fetched from the server's address when its preview is shown.
