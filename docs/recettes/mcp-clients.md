# Recette — Serveur MCP : matrice des clients

À rejouer **en staging avant chaque release** qui touche le serveur MCP, l'OAuth, les comptes ou les entreprises. Elle vérifie que chaque famille d'assistants se connecte, lit LePatron et se fait refuser quand elle le doit.

La documentation utilisateur suivie pendant la recette est dans [docs/user/mcp/](../user/mcp/README.md). Si un menu d'assistant a changé, corriger la page correspondante dans la même release.

## 0. Préparation

### Clés du serveur d'autorisation

Le serveur ne démarre pas, hors développement, sans la variable `lepatron_mcpOauthJwks`. Aujourd'hui, rien n'est signé avec : les tokens sont opaques et vérifiés en base. Elle est pourtant obligatoire, parce que sans elle `oidc-provider` prendrait ses clés de développement, qui sont publiques, et parce qu'elle deviendra indispensable le jour où LePatron signera quelque chose (ADR 0012, « Keys »). **Ne pas la supprimer.**

La générer une fois par environnement, et la garder secrète :

```bash
node -e "const {generateKeyPairSync}=require('node:crypto');const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});console.log(JSON.stringify({keys:[{...jwk,kid:'mcp-1',alg:'RS256',use:'sig'}]}))"
```

La commande affiche le JSON attendu par la variable : `{"keys":[{"kty":"RSA",…,"kid":"mcp-1","alg":"RS256","use":"sig"}]}`. Le copier tel quel dans `lepatron_mcpOauthJwks`.

Sur Scalingo, en une fois, sans que la clé ne s'affiche :

```bash
scalingo --app <app> env-set "lepatron_mcpOauthJwks=$(node -e "const {generateKeyPairSync}=require('node:crypto');const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});console.log(JSON.stringify({keys:[{...jwk,kid:'mcp-1',alg:'RS256',use:'sig'}]}))")"
```

Sur Clever Cloud, de même, puis redémarrer l'application, car une variable ne s'applique qu'au démarrage :

```bash
clever env set lepatron_mcpOauthJwks "$(node -e "const {generateKeyPairSync}=require('node:crypto');const jwk=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'jwk'});console.log(JSON.stringify({keys:[{...jwk,kid:'mcp-1',alg:'RS256',use:'sig'}]}))")" --alias <alias>
clever restart --alias <alias>
```

La changer ne déconnecte aucun assistant. Pour tout couper :

- pour une entreprise, couper son accès MCP (**Paramètres › Fonctionnalités IA**, section **Accès MCP**) ;
- pour toute la plateforme, lancer `node scripts/mcp-revoke-all.js --yes`. Sans `--yes`, le script dit ce qu'il ferait et ne change rien. Les clients restent enregistrés : leurs utilisateurs se reconnectent.

### Module MCP

À la première release qui porte le module MCP (ADR 0017), un super admin **ouvre le module MCP de l'entreprise plateforme** dans chaque environnement (**Paramètres › Général › Modules activés**). Sans lui, l'accès MCP de l'entreprise plateforme ne fonctionne plus. Ouvrir aussi celui des entreprises de staging A, B et C.

### Environnement qui a fait tourner une version antérieure de la pile MCP

Les tokens, les codes et les secrets sont désormais stockés sous leur empreinte, et un client enregistré à la main ne vit plus que dans `mcpclients`. Sur un environnement qui a fait tourner une version antérieure de la pile (staging, poste de développement), purger une fois, via le shell Compass, les collections `mcp_oauth_*` et `mcpclients` : `db.getCollectionNames().filter((name) => name.startsWith('mcp_oauth_') || name === 'mcpclients').forEach((name) => db.getCollection(name).drop())`. Les assistants se reconnectent, et les clients enregistrés à la main sont à recréer.

### Comptes et entreprises de staging

| Rôle                               | Entreprise            | Accès MCP de l'entreprise |
| ---------------------------------- | --------------------- | ------------------------- |
| Utilisateur simple                 | entreprise A          | activé                    |
| Admin technique                    | entreprise A          | activé                    |
| Admin d'entreprise (non technique) | entreprise A          | activé                    |
| Utilisateur simple                 | entreprise B          | activé                    |
| Utilisateur simple                 | entreprise C          | **coupé**                 |
| Utilisateur simple                 | entreprise D          | **module fermé**          |
| Super admin                        | entreprise plateforme | —                         |

L'entreprise A doit avoir au moins une expertise et un skill actifs.

### Vérifications de base

Remplacer `$STAGING` par l'adresse de staging.

```bash
curl -s $STAGING/.well-known/oauth-protected-resource/mcp
```

La réponse annonce la ressource `$STAGING/mcp` et le serveur d'autorisation `$STAGING/oauth`.

```bash
curl -s $STAGING/.well-known/oauth-authorization-server/oauth
```

La réponse contient `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint` et `code_challenge_methods_supported: ["S256"]`. Elle ne contient ni `userinfo_endpoint` ni `end_session_endpoint` : le serveur ne les sert pas.

```bash
head -c 70000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w "%{http_code}\n" -X POST $STAGING/oauth/reg -H 'Content-Type: application/json' --data-binary @-
```

Un corps de plus de 64 Ko est refusé : la réponse est `413`.

Ouvrir `$STAGING/oauth/auth?client_id=inconnu&response_type=code` dans un navigateur : la page « This application cannot connect to LePatron. » s'affiche, avec l'erreur et rien d'autre.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST $STAGING/mcp
```

Sans token, la réponse est `401`, avec un en-tête `WWW-Authenticate` qui pointe vers les métadonnées.

## 1. Matrice des clients

Pour chaque client, avec l'utilisateur simple de l'entreprise A, en suivant la page de documentation :

1. **Connexion :** l'écran de consentement affiche le bon nom d'application, l'hôte de retour et l'entreprise A. Après **Autoriser**, on revient dans l'assistant.
2. **Lecture :** l'assistant liste les outils de LePatron, trouve une expertise de l'entreprise A et utilise un skill.
3. **Suivi :** dans **Applications connectées**, l'assistant apparaît avec l'entreprise A et une dernière utilisation récente.
4. **Révocation :** après **Révoquer**, la requête suivante de l'assistant est refusée, puis il redemande une connexion.

La colonne « Enregistrement » dit comment le client se fait connaître de LePatron ; l'écran de consentement le reflète (« s'est enregistrée elle-même », « identité publiée par… », « déclarée par l'entreprise… »). Noter dans la PR de release ce qu'on a observé quand deux modes sont possibles.

| Client                                      | Enregistrement                                      | 1. Connexion | 2. Lecture | 3. Suivi | 4. Révocation |
| ------------------------------------------- | --------------------------------------------------- | ------------ | ---------- | -------- | ------------- |
| claude.ai, connecteur d'organisation (Team) | document de métadonnées                             | [ ]          | [ ]        | [ ]      | [ ]           |
| Claude Desktop (même compte)                | celui du connecteur claude.ai                       | [ ]          | [ ]        | [ ]      | [ ]           |
| Claude Code (`claude mcp add`)              | document de métadonnées ou enregistrement dynamique | [ ]          | [ ]        | [ ]      | [ ]           |
| ChatGPT Business, application publiée       | document de métadonnées ou enregistrement dynamique | [ ]          | [ ]        | [ ]      | [ ]           |
| Copilot Studio, Dynamic discovery           | enregistrement dynamique avec secret                | [ ]          | [ ]        | [ ]      | [ ]           |
| Copilot Studio, Manual                      | client créé par l'admin technique                   | [ ]          | [ ]        | [ ]      | [ ]           |
| Microsoft 365 Copilot, agent déclaratif     | enregistrement dynamique avec secret                | [ ]          | [ ]        | [ ]      | [ ]           |
| VS Code, GitHub Copilot (mode agent)        | document de métadonnées ou enregistrement dynamique | [ ]          | [ ]        | [ ]      | [ ]           |

### Points propres à chaque client

- [ ] **ChatGPT :** l'admin voit la liste des actions sans avertissement bloquant sur les descriptions des outils, et la publication réussit.
- [ ] **Copilot Studio, Manual :** le parcours en trois temps de la documentation fonctionne (outil créé avec des valeurs provisoires, client LePatron créé avec la callback URL, valeurs remplacées), avec PKCE et l'envoi du secret dans le corps de la requête.
- [ ] **Microsoft 365 Copilot :** l'agent obtient un secret à l'enregistrement, et le paquet se déploie depuis le centre d'administration. Le tester dans les 24 heures qui suivent sa création : un client enregistré dynamiquement que personne ne connecte est oublié au bout d'un jour.
- [ ] **Renouvellement :** un assistant laissé connecté plus d'une heure fonctionne encore (renouvellement du token).
- [ ] **Indépendante du navigateur :** connecter deux fois le même client dans le même navigateur : la première connexion fonctionne encore. Une connexion fonctionne encore le lendemain, quand la session du navigateur sur le serveur d'autorisation a expiré : elle ne dépend pas d'elle.
- [ ] **Deux machines, un même client :** connecter Claude Code (ou VS Code) sur deux machines avec le même utilisateur et la même entreprise. **Applications connectées** affiche deux lignes, et les deux assistants lisent LePatron. Révoquer l'une ne coupe pas l'autre.
- [ ] **Onzième connexion :** reconnecter onze fois le même client (Claude Code : `/mcp`, puis se reconnecter), avec le même utilisateur et la même entreprise. **Applications connectées** affiche dix lignes : la plus ancienne a disparu.
- [ ] Pour ces deux cas, le plafond compte par `client_id` : vérifier que les connexions ont le même (`db.mcpconnections.find({}, { clientId: 1 })`), ou utiliser un client à document de métadonnées. Un assistant qui se réenregistre (enregistrement dynamique) obtient un nouvel id à chaque fois, et ses connexions ne comptent pas ensemble.

## 2. Refus

| Cas                                   | Comment le provoquer                                                                                             | Attendu                                                                                                                                                      | OK  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| Entreprise sans accès MCP             | connecter un assistant avec l'utilisateur de l'entreprise C                                                      | consentement refusé : « Votre entreprise n'a pas l'accès MCP »                                                                                               | [ ] |
| Entreprise sans module MCP            | connecter un assistant avec l'utilisateur de l'entreprise D                                                      | consentement refusé : « Le module MCP n'est pas inclus dans l'abonnement de votre entreprise » ; dans ses Fonctionnalités IA, l'accès MCP est « Non inclus » | [ ] |
| Module MCP fermé après connexion      | connecter l'utilisateur de l'entreprise A, puis fermer le module MCP de l'entreprise A (super admin, confirmer)  | la confirmation annonce le nombre de connexions ; l'assistant est refusé ; rouvrir le module ne fait pas revenir la connexion, l'accès MCP est resté activé  | [ ] |
| Module fermé pendant le consentement  | consentement ouvert (utilisateur de l'entreprise A), fermer le module dans un autre onglet, puis **Autoriser**   | consentement refusé : « Le module MCP n'est pas inclus… » ; aucune application listée, même après réouverture du module                                      | [ ] |
| Accès MCP coupé après connexion       | connecter l'utilisateur de l'entreprise A, puis couper l'accès MCP de l'entreprise A                             | l'assistant est refusé ; l'application disparaît de la liste ; réactiver l'accès ne la fait pas revenir                                                      | [ ] |
| Application révoquée                  | **Révoquer** depuis Applications connectées                                                                      | refus à la requête suivante, renouvellement refusé                                                                                                           | [ ] |
| Révocation par l'admin                | **Paramètres › Fonctionnalités IA**, section **Accès MCP**, **Tout révoquer**, admin technique de l'entreprise A | toutes les applications de l'entreprise A sont refusées, celles de l'entreprise B fonctionnent                                                               | [ ] |
| Utilisateur désactivé                 | désactiver l'utilisateur connecté                                                                                | refus ; le réactiver ne fait pas revenir ses connexions                                                                                                      | [ ] |
| Mot de passe changé                   | changer le mot de passe de l'utilisateur connecté                                                                | refus à la requête suivante ; l'application disparaît de la liste                                                                                            | [ ] |
| Double authentification réinitialisée | l'admin technique de l'entreprise A réinitialise la double authentification de l'utilisateur connecté            | refus à la requête suivante ; l'application disparaît de la liste                                                                                            | [ ] |
| Client d'une autre entreprise         | utiliser le client manuel de l'entreprise A avec l'utilisateur de l'entreprise B                                 | consentement refusé : « Cette application est réservée aux utilisateurs de l'entreprise qui l'a déclarée »                                                   | [ ] |
| Client manuel supprimé                | supprimer le client depuis **Accès MCP › Clients enregistrés à la main › Gérer**                                 | refus immédiat des connexions qui passaient par lui                                                                                                          | [ ] |
| Adresse changée                       | changer l'adresse d'un utilisateur connecté dont la double authentification passe par email                      | refus à la requête suivante ; l'application disparaît de la liste                                                                                            | [ ] |
| Compte d'amorçage                     | consentir avec le compte d'amorçage (_bootstrap account_ du glossaire)                                           | « Ce compte ne peut pas connecter d'assistant »                                                                                                              | [ ] |
| Consentement expiré                   | ouvrir l'écran de consentement et attendre plus de 10 minutes                                                    | « Cette demande de connexion a expiré… », sans bouton **Refuser**                                                                                            | [ ] |
| Refus depuis un écran d'erreur        | sur l'écran « Votre entreprise n'a pas l'accès MCP » (entreprise C), cliquer **Refuser**                         | retour dans l'assistant, qui reçoit le refus (`access_denied`)                                                                                               | [ ] |

### Adresses de retour

Une adresse de retour est acceptée en `https`, ou en `http` vers `localhost`, `127.0.0.1` ou `[::1]` sur n'importe quel port. Les autres sont refusées.

- [ ] **Enregistrement dynamique avec une adresse refusée parmi des bonnes :**

  ```bash
  curl -s -X POST $STAGING/oauth/reg -H 'Content-Type: application/json' \
    -d '{"client_name":"Recette","token_endpoint_auth_method":"none","redirect_uris":["https://example.com/callback","http://localhost:4000/callback","cursor://example/callback","http://example.com/callback"]}'
  ```

  Le client est enregistré : la réponse ne liste que `https://example.com/callback` et `http://localhost:4000/callback`.

- [ ] **Enregistrement dynamique sans aucune bonne adresse :** la même commande avec seulement `cursor://example/callback` et `http://example.com/callback` est refusée avec `invalid_redirect_uri`.
- [ ] **Client enregistré à la main :** dans **Ajouter un client**, une adresse `cursor://…` ou `http://` vers un autre hôte que `localhost` bloque la création, et le message nomme l'adresse refusée. Appelée directement, la route répond `400` avec `MCP_CLIENT_INVALID_REDIRECT_URIS` et l'adresse dans `redirectUri`.
- [ ] **Document de métadonnées sur un hôte privé :** ouvrir `$STAGING/oauth/auth?client_id=https%3A%2F%2F10.0.0.1%2Fclient.json&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback` : la page d'erreur de LePatron s'affiche, et aucune requête ne part vers cette adresse. Un document n'est lu que sur un hôte public, et jusqu'à 5 Ko.

### Événements de sécurité

Chaque action ci-dessous ajoute un événement dans la collection `securityevents` (via le shell Compass : `db.securityevents.find().sort({ _id: -1 }).limit(5)`), avec son auteur (`actor`), l'entreprise (`group`) et la date. Les noms des actions sont dans `packages/server/security-event/security-event.actions.js`.

- [ ] Ouvrir, puis fermer le module MCP de l'entreprise A (super admin) : `mcp-module.opened`, puis `mcp-module.closed`.
- [ ] Activer, puis couper l'accès MCP de l'entreprise A : `mcp-access.enabled`, puis `mcp-access.disabled`.
- [ ] Autoriser, puis arrêter le retex de l'entreprise A : `retex.allowed`, puis `retex.disallowed`.
- [ ] Créer, puis supprimer un client enregistré à la main : `mcp-client.created`, puis `mcp-client.deleted`. Chacun porte `clientId` et `clientName`, jamais le secret.
- [ ] **Tout révoquer** dans l'entreprise A : `connected-applications.all-revoked`.

### Stockage

Via le shell Compass, après une connexion :

- [ ] `db.mcp_oauth_accesstoken.findOne()` : l'`_id` est une empreinte (43 caractères), et le token de l'assistant n'apparaît nulle part. De même pour `mcp_oauth_refreshtoken` et `mcp_oauth_authorizationcode`.
- [ ] `db.mcp_oauth_client.find({ _id: /^lepatron-/ })` ne renvoie rien : un client enregistré à la main n'existe que dans `db.mcpclients`, dont `secretDigest` commence par `sha256:`.
- [ ] Pour un client enregistré dynamiquement avec secret, le `client_secret` lu dans le `payload` (du JSON) de son enregistrement dans `mcp_oauth_client` commence par `sha256:`.

## 3. Droits sur les écrans

- [ ] **Clients MCP :**
  - l'admin technique de l'entreprise A crée, liste et supprime ses clients ;
  - l'admin d'entreprise non technique n'a pas l'écran, et l'appel direct de `/api/groups/:groupId/mcp-clients` est refusé (`403`, `FORBIDDEN_CAPABILITY`) ;
  - l'admin technique de l'entreprise A qui appelle la route de l'entreprise B est refusé (`403`, `MCP_FORBIDDEN_COMPANY`) ;
  - le super admin y accède pour n'importe quelle entreprise.
- [ ] **Révocation en masse** (**Paramètres › Fonctionnalités IA**, section **Accès MCP**, **Tout révoquer**) :
  - l'admin technique de l'entreprise A révoque toutes ses connexions ;
  - le super admin le fait pour n'importe quelle entreprise ;
  - l'admin d'entreprise non technique n'a pas la page Fonctionnalités IA, et l'appel direct de `DELETE /api/groups/:groupId/connected-applications` est refusé (`403`, `FORBIDDEN_CAPABILITY`) ;
  - l'utilisateur simple n'a pas la page non plus.
- [ ] **Retex :** seuls l'admin technique et le super admin l'autorisent ou l'arrêtent ; l'admin d'entreprise non technique n'a pas l'interrupteur.
- [ ] **Consentement d'un super admin :**
  - avec un client de l'entreprise A, seule l'entreprise A est proposée ;
  - avec Claude, toutes les entreprises qui ont l'accès MCP sont proposées ;
  - « Proposer aussi des brouillons de skills et d'expertises » est proposé décoché ; laissé décoché, l'assistant n'a pas les outils d'écriture.
- [ ] **Consentement d'un utilisateur simple :** la case des brouillons n'apparaît pas.

## 4. Après la recette

- [ ] Révoquer les applications de test, supprimer les clients manuels de test.
- [ ] Reporter les écarts de menus dans [docs/user/mcp/](../user/mcp/README.md).
