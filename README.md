<h1 align="center">✉️ LePatron.email</h1>
<h2 align="center">Open Source Email Builder</h2>

## Deployment

Instructions on how to deploy on [Heroku](./DEPLOYMENT.md##-How-to-deploy-on-Heroku:), [CleverCloud](./packages/documentation/heroku-configuration.md##-How-to-deploy-on-CleverCloud) and [Infomaniak](./packages/documentation/heroku-configuration.md##-How-to-deploy-on-Informaniak) are provided in the readme file.

## Run locally

### 1. Install dependencies

```bash
yarn
yarn build
```

### 2. Run the database

```bash
yarn docker:up
```

(You will be able to stop the docker compose with `yarn docker:down`)

### 3. Run the application

```bash
yarn dev
```

The application is available on [localhost:3000](http://localhost:3000)

Login with

- **Email:** admin
- **Password:** admin

A catch all mailbox is available on [localhost:1080](http://localhost:1080/)

## Access to the database

- You need MongoDB on your computer. If you haven't, you can install [MongoDB Compass](https://www.mongodb.com/try/download/compass)
- Install the version you need
- In a shell terminal, launch the following commands:

```bash
docker ps # Check if your database docker container is launched
docker exec -it lepatron_mongo_container bash # Run command prompt on your docker container
mongo # To see the mongo connection name
```

- The connection name looks something like `mongodb://127.0.0.1:27017/?compressors=disabled&gssapiServiceName=mongodb`
- Remove all the queries parameters to have : `mongodb://127.0.0.1:27017/`
- Paste it in MongoDB Compass UI
- You have access to your database

## Generate documentation

### Run application documentation

```bash
yarn docs:dev
```

### Build application documentation

```bash
yarn docs:dev:build
```

### Run API documentation

```bash
yarn docs:api
```

### Build API documentation

```bash
yarn docs:api:build
```

### Troubleshooting

If you encounter this error during documentation generation :

```
(node:24453) UnhandledPromiseRejectionWarning: Error: EACCES: permission denied, scandir '.../.mongodb/diagnostic.data'
```

Simply give access to .mongodb folder to your user :

```
chown $(whoami):$(whoami) -R ./.mongodb
```

---

## License

**GPL-3.0**
