# An Emarsys Media Database is an image host integration, and an export puts each image there once per email

- Status: proposed
- Date: 2026-11-17
- Epic: #1610

A company that sends from Emarsys wants the downloaded HTML to load its images from the Emarsys Media Database, as it already can from an FTP server or a CDN. Emarsys becomes the first provider of a new integration type, the image host (`asset_hosting`), configured by a tech admin in the company's integrations, not an ESP profile and not more fields on the company. The export of the editor offers each image host of the company next to the regular, CDN and FTP downloads: it puts the email's images on the host and returns a ZIP holding the HTML alone, every image pointing at the host.

The integration holds an OAuth 2.0 client of the Emarsys API v3 (the client ID in its configuration, the secret encrypted in `apiKey`) and a root folder of the Media Database, chosen from the folders the account lists. The legacy WSSE authentication of the API v2 is left out: Emarsys deprecated it, with a final sunset at the end of 2026. Emarsys limits token requests to 50 a minute per client, so the token is kept until it expires rather than asked for at each call. A company may have several Emarsys integrations, one per account or brand, each offered in the export menu under its own name; only the active ones whose last validation succeeded are offered. Using one needs nothing more than exporting the email: there is no paid module to open, as for the FTP.

The export puts every image the HTML loads over `http(s)` on the host, the images of other hosts included, with the rule the FTP export already follows: the HTML then depends on Emarsys alone, and the guard against images left on our infrastructure (`EXPORT_IMAGES_NOT_TRANSFERRED`) keeps applying. Each email gets a folder of its own under the root folder, named after the email and a short identifier, so that two emails of the same name never mix their images. The HTML receives the absolute URL Emarsys gives for the file, not the relative `/custloads/` path the Emarsys documentation suggests, so that the email still displays in a proof, a browser or another platform. The export is all or nothing: if one image fails (over the 16 MB limit, refused by Emarsys, unreachable at its source), the export fails and names the images at fault, rather than leaving them where they were as the FTP client does silently. Refused credentials are not the images' fault: the export stops at once, says so, and marks the integration invalid, so that the menu no longer offers it until a tech admin tests it again. The sources are URLs of the email's HTML, which its authors write: our own images are read directly, any other address, each redirect included, must be a public one.

An email is exported many times while it is corrected, and Emarsys renames a file uploaded twice rather than replacing it. Each image put on the host is therefore remembered as a hosted image, keyed by the integration, the email and the hash of its content, with the identifier and the URL Emarsys returned. A later export of the same email reuses it after checking, with a `GET` on the file, that it is still in the Media Database, and puts it there again if someone deleted it. A changed image has a new hash, so a new file and a new URL: a campaign already sent keeps pointing at the image it was sent with. Deleting an integration forgets its hosted images and leaves the files in Emarsys.

## Considered Options

- **An Emarsys ESP profile**: rejected for this feature. A profile pushes campaigns to the ESP, which nobody asked for yet; an image host is what an FTP server and a CDN already are for the export, and other hosts (an object storage bucket, an image CDN) can join the same type. Emarsys may become an ESP profile later, as a feature of its own.
- **The relative `/custloads/` path**: rejected. It only resolves inside an Emarsys campaign.
- **Uploading with `preserve_filename` to overwrite the previous file**: rejected. Overwriting an image changes it in every campaign already sent with it.
- **Sharing hosted images between the emails of an integration**: rejected. It saves uploads only when two emails share an image, and leaves an email's folder without all of its images; re-exporting the same email is the case that costs.
- **Trusting a hosted image without checking it**: rejected. A file deleted from the Media Database would ship as a broken image, which cannot be fixed once the campaign is sent.
- **Uploading only the images of our gallery**: rejected, to keep the rule of the FTP export and an HTML that depends on one host.

## Consequences

- The export menu of the editor opens as a menu as soon as the company has an image host, even without a CDN or an FTP server.
- Downloading from the email listing, single or multiple, is left out of the first version: it keeps offering the regular, CDN and FTP downloads.
- Changing the account or the root folder of an integration is handled by the check: the files of the former account are not found, and the next export puts them in the new folder.
