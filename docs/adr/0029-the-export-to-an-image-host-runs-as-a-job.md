# The export to an image host runs as a job, the editor following its progress

- Status: proposed
- Date: 2026-11-17
- Epic: #1610
- Ticket: #1623

The export to an image host (ADR 0028) puts every image of the email on the host before it can write the HTML: Emarsys renames what it stores, so an image's URL is known only once it is uploaded, and one image that fails fails the export. Done within the download request, a large email outlasts the router of the production hosting, which cuts a response that has sent nothing for 30 seconds: the user gets an error while the uploads carry on. The FTP export escapes that only by not waiting: it guesses its URLs from the file names, answers at once and uploads afterwards, so its failures go unseen, which ADR 0028 rejects for an image host.

So the export to an image host runs as a job, as the translation does. The editor starts it; the server checks at once what can be checked (the rights on the email, the image host, the required tracking parameters), answers `202` with the job's identifier, then puts the images in the background. The job is a document in MongoDB, so that any instance of the server answers for it: its status, its progress (images done out of the total), and once completed the final HTML, from which the ZIP is built when downloaded, since it holds the HTML alone. It is removed an hour after its last update. Only the user who started it reads it.

The editor shows a modal while the job runs: the image host's name, a progress bar, then the ZIP downloaded and the modal closed, or the reason it failed, in the modal rather than a notification that fades. It asks for the status as the translation does (every 2 seconds, spaced out to 30 while the server does not answer).

A job whose instance stops mid-way would wait forever. It beats every 5 seconds while it runs, whatever its progress, and a job silent for 20 seconds is read as interrupted: a slow upload keeps beating, a stopped instance is told within 20 seconds. Relaunched, the export finds the images already put in the hosted images and is quick.

The regular, CDN and FTP downloads stay as they are, within the request.

## Considered Options

- **Keeping the export within the request, with a ceiling on its duration and its images**: rejected. A large email would be refused for good, where a job takes it.
- **A job kept in the memory of the server**: rejected. The status would be asked of an instance that does not know it as soon as there are two.
- **The ZIP stored in the job**: rejected. It holds the HTML alone, which the job keeps, and a ZIP built on demand needs no file storage.
- **Resuming, from another screen, the download of a job the user left**: left out. Relaunching the export costs little, the images being hosted already.
