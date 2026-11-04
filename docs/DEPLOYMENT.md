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

## A copy following production's skills and expertises

Production is the source of skills and expertises (ADR 0019). A copy (staging, development) follows it, on demand from its back office and every night.

### Configuration of a copy

1. In production's back office, a super admin opens **Skills & Expertise → Synchronisation** and creates a read token for this copy. The token is shown once.
2. On the copy, set two environment variables:

| Variable              | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `SKILLS_SOURCE_URL`   | Production's address, in https, for example `https://lepatron.example.com` |
| `SKILLS_SOURCE_TOKEN` | The read token production gave this copy                                   |

Leave both unset on production itself: it follows nothing. Without both, a copy offers no follow and the nightly command does nothing.

### The nightly follow

The web server runs no timer. The hosting platform's scheduler runs `node scripts/follow-production.js` (also `yarn follow-production`) every night:

- On Scalingo, `cron.json` at the root of the repository schedules it at 3:00 (the platform's time zone, UTC). Every app deployed from this repository reads it; on an instance that follows no production, the command does nothing and exits 0.
- Elsewhere, schedule the same command with the platform's own scheduler.

The command records the follow like the button does, as the nightly follow, and the copy's Synchronisation tab shows the last one. It exits 1 when the follow failed or when some items failed, so the scheduler's logs show it.
