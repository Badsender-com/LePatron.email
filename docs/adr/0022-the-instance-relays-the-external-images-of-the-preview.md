# The instance relays the external images of a mailing's preview

- Status: proposed
- Date: 2026-11-08
- Epic: #1485
- Amends: ADR 0012 (the email in the conversation)

The preview of a mailing in an assistant (#1342) is an MCP App the client frames under the CSP it declares: no connection, and images from the instance only, where the editor uploads them. A template often hosts its own images elsewhere, on a company's CDN or an image host: the logo and the icons of a footer then show as their alternative text in the conversation, while the editor shows them. The preview no longer looks like the email.

**The instance relays them.** When LePatron prepares the preview it hands an app, it rewrites the address of every image hosted outside the instance over https, in an `<img>`, a `background` attribute or a `url()` of a style, to an address of the instance that names that image and carries its signature. An address without a scheme (`//cdn…`) is read as https. An `http://` address is left as it is, and shows as its alternative text: the instance fetches over https only. An image is the instance's when its origin is, whatever the case of its address or a default port written. The text of the email is never rewritten, and the rewriting reads each character a bounded number of times: it runs on every preview, synchronously, on what the mailing's author wrote. What it writes is inert wherever it lands, a CSS string included, since it runs after the sanitiser. The rewritten preview is kept under the key of the sanitised one, the mailing and its last write. The CSP of the app does not change.

**The relayed image.** The address answers the image the instance fetches then: over https only, with no private or internal address and never the instance's own host at any hop, up to three redirects, 10 seconds and 5 MB in all, and only a PNG, a JPEG, a GIF or a WebP, recognised by its content. An SVG is refused: served from the instance's origin, one opened on its own could run a script. Every answer of the route carries `Content-Security-Policy: default-src 'none'; sandbox` and `nosniff`. An image refused, too large or unreachable shows as its alternative text, as before; the client keeps that answer a minute, and the instance logs the image's host and the reason. A HEAD answers what the instance holds, and never fetches. The image is served with a day of cache, which the client and its browser keep.

**What the route may cost.** The route is public, and each fetch holds a connection up to 10 seconds and the image in memory up to 5 MB. Each process keeps the images it fetched for 10 minutes, within 50 MB; one fetch serves every request for the same image while it runs; and a process runs 20 fetches at a time at most, past which a new image is answered as none. The route takes 600 requests a minute from one address: a preview shows a few dozen images, and a viewer opens several. These are counted in each process's memory, like the limits of ADR 0012.

**A signed address, for one image, with no expiry.** The frame of the app has no LePatron session, so the address is public: its signature, an HMAC of the image's address, is what makes it valid, and it allows that one image only. It is signed with a key of its own, `lepatron_relayedImagesKey`, written `<version>:<secret>`, and the signature carries the key's version: replacing the key cuts every address signed before, and signs nobody out, since the session secret stays. Unset, a key derived from the session secret, version 0, signs the addresses, so that an instance configured before keeps them. The address has no expiry: a conversation reopened months later shows its images again. Whoever holds the address can have the instance fetch that image, and nothing else.

**Every image, the pixels included.** ADR 0012 kept images to the instance so that no tracking pixel loads. The instance now relays them like any image: a pixel can be fetched from the server when an assistant shows a preview. Telling a pixel from an image was rejected: a size or a pattern misses some and hides real images, and a list of tracking domains has to be kept.

**The assistant still reads the original addresses.** The relayed preview travels for the app only, in the result's `_meta`. Asked as HTML, the answer keeps the original addresses, and the relayed preview travels beside it in `_meta` when an image was relayed, which the app reads first: twice, but the assistant never quotes an address of the relay as the email's.

## Considered Options

- **Allowing the company's CDN in the CSP**: rejected as the only way. It needs a host per company, and every other host, a template's own included, would stay hidden.
- **A list of image domains per instance**: rejected, a list to keep that is always one host behind.
- **A stored cache of the images**: rejected, a storage to purge for what the client caches already. The cache in memory, bounded in size and in time, only spares the hosts and the instance the same fetch.
- **An expiring address**: rejected, an old conversation would lose its images.
- **Signing with the session secret**: rejected, revoking the addresses would sign every user out.
- **No limit on the route**: rejected, the signature limits it to images seen in a mailing, not how often they are asked for.

## Consequences

- A public route serves the relayed images; it fetches with the guarded helper of the outgoing calls, which takes the hops its caller allows.
- The preview of a mailing whose images are all on the instance is unchanged.
- An email's tracking pixels can be fetched from the server's address when its preview is shown.
- A deployment may set `lepatron_relayedImagesKey` (`docs/DEPLOYMENT.md`); a key written otherwise stops the server at start.
