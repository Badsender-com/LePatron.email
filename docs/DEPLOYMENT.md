<h1 align="center">✉️ LePatron.email</h1>
<h2 align="center">🚀 Deploy on the Cloud</h2>

## How to deploy on Heroku:

#### Prerequired:

- Hosted and accessible `Mongo DB`
- `Aws` bucket
- Mail provider choosen from the list below

#### Steps:

1. Fork the `github repo`.
2. Go to heroku, press `New` then Click on `Create new app`
3. Select you app name, and choose a server location ( this will affect your server ping ), then press `create app`.
4. Go to deploy tab, In the deployment method click on `Github connect`, search for you repo nam and then click on `connect`.
5. In the `Automatic deploys` section, Click on `Enable automatic deploys`.
6. Go to `Settings` tab, Flow readme instruction for [configuring heroku environments variables](./packages/documentation/heroku-configuration.md##-configuring-heroku-environments-variables).
7. Go back on the `Deploy` tab, in the `Manual deploy` section, click on `deploy branch`. You got your application up and running now.

---

## How to deploy on Clever Cloud:

After forking the repo:

### From Clever Cloud console:

1.Select Create -> an application -> `Create Brand new app` 2. Select `Node`, Click `Next` 3. Select App name and the description and location, example in our case the name is `badsender-app`, Click `create` 4. Add all environment variables from [configuring heroku environments variables](./packages/documentation/heroku-configuration.md##-configuring-heroku-environments-variables).

#### Using Clever tools

1. You must commit before deploy `git commit -m "Clever deploy"`
2. Install and follow setup instructions [Clever tools](https://github.com/CleverCloud/clever-tools)
3. Link the existing application to your local repo with `clever link [--org <ORG-NAME>] <APP-NAME> [--alias <alias>]`
4. Add this environment variable `CC_POST_BUILD_HOOK = yarn build`
5. Deploy the application by running `clever deploy [--alias <alias>]`

## The images of a preview in an assistant

An assistant shows a mailing's preview with its images hosted outside the instance through addresses of the instance, each signed for one image (ADR 0022).

| Variable                    | Value                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lepatron_relayedImagesKey` | The key that signs these addresses, written `<version>:<secret>`: a whole number from 1, then 32 random characters at least, for example `1:$(openssl rand -hex 32)`. Replacing it, with the next version, cuts every address signed before and signs nobody out. Unset: a key derived from `lepatron_sessionSecret`, version 0. |

## A copy following production's skills and expertises

Production is the source of skills and expertises (ADR 0019). A copy (staging, development) follows it, on demand from its back office and, where its instance turns it on, every night.

### Configuration of a copy

1. In production's back office, a super admin opens **Skills & Expertise → Production and copies** and creates a read token for this copy. The token is shown once. It reads every skill and expertise production holds, drafts and items kept to the platform company included: give it only to a copy whose super admins may read all of that.
2. On the copy, set these environment variables:

| Variable                | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| `SKILLS_SOURCE_URL`     | Production's address, in https, for example `https://lepatron.example.com` |
| `SKILLS_SOURCE_TOKEN`   | The read token production gave this copy                                   |
| `SKILLS_SOURCE_NIGHTLY` | `true` for this instance to follow production every night; unset otherwise |

Leave them all unset on production itself: it follows nothing. Without the first two, a copy offers no follow and the nightly command does nothing. The copy's **Production and copies** tab shows whether the nightly follow is on.

### The first follow, by hand

Run the first follow of a copy by hand, before turning the nightly follow on: restart the copy without `SKILLS_SOURCE_NIGHTLY`, click **Follow now** in its **Production and copies** tab, then read the report.

On a copy that already held skills and expertises, imported by file or written there, the first follow takes over every item whose identifier production also has. Each local active version that differs from production's moves, as a draft, to a "(travail de la copie)" item: a staging that drifted from production can get many of them, and the report lists them. Until that first follow succeeds, the copy's items carry the "Not followed yet" badge, and a super admin may keep any of them on the copy to leave it out of the take-over. Once the report is read, set `SKILLS_SOURCE_NIGHTLY` to `true` if the copy should follow every night.

### The nightly follow

The web server runs no timer. The hosting platform's scheduler runs `node scripts/follow-production.js` (also `yarn follow-production`) every night at 3:00 UTC, on every app deployed from this repository; the command follows production only where `SKILLS_SOURCE_NIGHTLY` is `true` and `SKILLS_SOURCE_URL` and `SKILLS_SOURCE_TOKEN` are set, and otherwise does nothing and exits 0.

- **Clever Cloud**, which hosts develop, staging and production, reads `clevercloud/cron.json`. It runs the task on **every instance** of the application: when an app runs several instances, each one starts the command.
- **Scalingo**, which hosts a test instance, reads `cron.json` at the root of the repository.
- Elsewhere, schedule the same command with the platform's own scheduler.

**One follow at a time.** A follow records itself in the database as running when it starts, with an expiry, so that a process that dies does not hold it for ever. While it runs, any other follow, from the button, another process or another instance, is refused and writes nothing. The record is also the follow's trace.

**One nightly follow a night.** The lock alone only keeps two follows from running at the same time: the instances of a Clever Cloud app may start the command one after the other. A nightly follow is skipped when another nightly follow started less than 60 minutes ago, so the night follows once whatever the number of instances.

The command records the follow like the button does, as the nightly follow, and the copy's **Production and copies** tab shows the last one. It exits 1 when the follow failed or when some items failed, so the scheduler's logs show it.

### Checking the nightly follow on Clever Cloud

After deploying a copy whose nightly follow is on, check that the scheduled line starts and reads the environment variables. `clevercloud/cron.json` holds:

```text
0 3 * * * /bin/bash -l -c 'cd $ROOT && node scripts/follow-production.js'
```

1. Run the same line on the copy, from an SSH session (`clever ssh`): `/bin/bash -l -c 'cd $ROOT && node scripts/follow-production.js'`. It is a real follow, recorded as the nightly one: run it more than an hour before 3:00 UTC, or that night's run is skipped.
2. Read what it prints:
   - `Followed https://…: succeeded, …`: the line starts and reads the variables;
   - `This instance follows no production: nothing to do.`: the command does not see `SKILLS_SOURCE_URL` and `SKILLS_SOURCE_TOKEN`;
   - `This copy does not follow production at night (SKILLS_SOURCE_NIGHTLY): nothing to do.`: `SKILLS_SOURCE_NIGHTLY` is not `true` on this app.
3. The next morning, the app's logs show the 3:00 UTC run: one instance follows, and any other instance says it found a follow running or a nightly follow that started less than 60 minutes ago.
