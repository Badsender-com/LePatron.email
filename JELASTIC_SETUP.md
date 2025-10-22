# Configuration et Déploiement Jelastic

Ce guide explique comment déployer la branche `jlo-experimental` sur Jelastic.

## 📋 Prérequis

1. Un environnement Jelastic avec Node.js 14.16.0
2. Les credentials Git de votre environnement Jelastic
3. Une base de données MongoDB accessible
4. Un bucket AWS S3
5. Un fournisseur de messagerie configuré

## 🔧 Configuration GitHub Secrets

Pour utiliser le déploiement automatique via GitHub Actions, configurez les secrets suivants dans votre repository GitHub :

1. Allez dans **Settings** > **Secrets and variables** > **Actions**
2. Ajoutez les secrets suivants :

### Secrets requis :

- **`JELASTIC_GIT_URL`** : L'URL du repository Git Jelastic
  - Format : `https://node1234-env-5678.jelastic.com/git/repo.git`
  - Trouvable dans : Dashboard Jelastic > Environment > Git & Deploy

### Secrets optionnels (si authentification requise) :

- **`JELASTIC_GIT_USER`** : Nom d'utilisateur Git Jelastic
- **`JELASTIC_GIT_PASSWORD`** : Mot de passe ou token Git Jelastic

## 🌐 Configuration des Variables d'Environnement Jelastic

Dans votre dashboard Jelastic, configurez toutes les variables d'environnement nécessaires :

Référez-vous à [la documentation de configuration Heroku](./packages/documentation/heroku-configuration.md) pour la liste complète des variables requises.

### Variables principales :

```bash
NODE_ENV=production
MONGODB_URI=<votre_uri_mongodb>
AWS_ACCESS_KEY_ID=<votre_access_key>
AWS_SECRET_ACCESS_KEY=<votre_secret_key>
AWS_S3_BUCKET=<votre_bucket>
# ... autres variables selon votre configuration
```

## 🚀 Déploiement

### Option 1 : Déploiement automatique via GitHub Actions

Une fois les secrets configurés :

1. Pushez sur la branche `jlo-experimental` :
   ```bash
   git push origin jlo-experimental
   ```

2. Le workflow GitHub Actions se déclenchera automatiquement et :
   - Installera les dépendances
   - Exécutera les tests
   - Compilera l'application
   - Déploiera sur Jelastic

3. Suivez la progression dans l'onglet **Actions** de votre repository GitHub

### Option 2 : Déploiement manuel

Si vous préférez déployer manuellement :

1. **Ajoutez le remote Jelastic** :
   ```bash
   git remote add jelastic <JELASTIC_GIT_URL>
   ```

2. **Déployez la branche** :
   ```bash
   git push jelastic jlo-experimental:master
   ```

3. **Vérifiez le déploiement** :
   - Consultez les logs dans le dashboard Jelastic
   - Accédez à votre application via l'URL de l'environnement

### Option 3 : Déploiement manuel via workflow GitHub

Vous pouvez déclencher manuellement le workflow :

1. Allez dans **Actions** > **Deploy to Jelastic**
2. Cliquez sur **Run workflow**
3. Sélectionnez la branche à déployer (par défaut : `jlo-experimental`)
4. Cliquez sur **Run workflow**

## 🔍 Vérification du Déploiement

Après le déploiement :

1. **Vérifiez les logs** dans Jelastic Dashboard > Log
2. **Testez l'application** via l'URL de votre environnement
3. **Vérifiez la connexion** à MongoDB et AWS S3

## 🐛 Dépannage

### Le déploiement échoue avec une erreur Git

- Vérifiez que `JELASTIC_GIT_URL` est correctement configuré
- Vérifiez vos credentials Git si nécessaire

### L'application ne démarre pas

- Vérifiez les logs Jelastic pour les erreurs
- Assurez-vous que toutes les variables d'environnement sont configurées
- Vérifiez la connexion à MongoDB et AWS

### Build failures

- Assurez-vous que Node.js 14.16.0 est utilisé
- Vérifiez que toutes les dépendances sont présentes
- Consultez les logs du workflow GitHub Actions

## 📚 Ressources Supplémentaires

- [Documentation de déploiement générale](./DEPLOYMENT.md)
- [Configuration Heroku (variables d'environnement)](./packages/documentation/heroku-configuration.md)
- [Documentation Jelastic](https://docs.jelastic.com/)

## 🔄 Processus de Build Jelastic

Lorsque vous pushez sur Jelastic, le processus suivant se produit automatiquement :

1. **Installation des dépendances** : `yarn install`
2. **Build de l'application** : `yarn build` (via le hook `heroku-postbuild`)
3. **Démarrage de l'application** : `yarn start` (défini dans le Procfile)

## ✅ Checklist de Déploiement

- [ ] Environnement Jelastic créé avec Node.js 14.16.0
- [ ] Variables d'environnement configurées dans Jelastic
- [ ] Secrets GitHub configurés (JELASTIC_GIT_URL minimum)
- [ ] MongoDB accessible depuis Jelastic
- [ ] AWS S3 bucket configuré
- [ ] Branche `jlo-experimental` à jour
- [ ] Tests passent localement
- [ ] Déploiement effectué
- [ ] Application accessible et fonctionnelle
