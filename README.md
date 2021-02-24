<h1 align="center">✉️ LePatron.email</h1>
<h2 align="center">Open Source Email Builder</h2>

---

## 🚀 Deploy on the Cloud

Documentation coming soon...

---

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
