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

La changer ne déconnecte aucun assistant. Pour tout couper :

- pour une entreprise, couper son accès MCP (**Paramètres › Fonctionnalités IA**, section **Accès MCP**) ;
- pour toute la plateforme, lancer `node scripts/mcp-revoke-all.js`.

### Comptes et entreprises de staging

| Rôle                               | Entreprise            | Accès MCP de l'entreprise |
| ---------------------------------- | --------------------- | ------------------------- |
| Utilisateur simple                 | entreprise A          | activé                    |
| Admin technique                    | entreprise A          | activé                    |
| Admin d'entreprise (non technique) | entreprise A          | activé                    |
| Utilisateur simple                 | entreprise B          | activé                    |
| Utilisateur simple                 | entreprise C          | **coupé**                 |
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

La réponse contient `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint` et `code_challenge_methods_supported: ["S256"]`.

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
- [ ] **Deux machines, un même client :** connecter Claude Code (ou VS Code) sur deux machines avec le même utilisateur et la même entreprise. **Applications connectées** affiche deux lignes, et les deux assistants lisent LePatron. Révoquer l'une ne coupe pas l'autre.

## 2. Refus

| Cas                                   | Comment le provoquer                                                                                             | Attendu                                                                                                    | OK  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --- |
| Entreprise sans accès MCP             | connecter un assistant avec l'utilisateur de l'entreprise C                                                      | consentement refusé : « Votre entreprise n'a pas l'accès MCP »                                             | [ ] |
| Accès MCP coupé après connexion       | connecter l'utilisateur de l'entreprise A, puis couper l'accès MCP de l'entreprise A                             | l'assistant est refusé ; l'application disparaît de la liste ; réactiver l'accès ne la fait pas revenir    | [ ] |
| Application révoquée                  | **Révoquer** depuis Applications connectées                                                                      | refus à la requête suivante, renouvellement refusé                                                         | [ ] |
| Révocation par l'admin                | **Paramètres › Fonctionnalités IA**, section **Accès MCP**, **Tout révoquer**, admin technique de l'entreprise A | toutes les applications de l'entreprise A sont refusées, celles de l'entreprise B fonctionnent             | [ ] |
| Utilisateur désactivé                 | désactiver l'utilisateur connecté                                                                                | refus ; le réactiver ne fait pas revenir ses connexions                                                    | [ ] |
| Mot de passe changé                   | changer le mot de passe de l'utilisateur connecté                                                                | refus à la requête suivante ; l'application disparaît de la liste                                          | [ ] |
| Double authentification réinitialisée | l'admin technique de l'entreprise A réinitialise la double authentification de l'utilisateur connecté            | refus à la requête suivante ; l'application disparaît de la liste                                          | [ ] |
| Client d'une autre entreprise         | utiliser le client manuel de l'entreprise A avec l'utilisateur de l'entreprise B                                 | consentement refusé : « Cette application est réservée aux utilisateurs de l'entreprise qui l'a déclarée » | [ ] |
| Client manuel supprimé                | supprimer le client depuis **Accès MCP › Clients enregistrés à la main › Gérer**                                 | refus immédiat des connexions qui passaient par lui                                                        | [ ] |
| Compte d'amorçage                     | consentir avec le compte d'amorçage (_bootstrap account_ du glossaire)                                           | « Ce compte ne peut pas connecter d'assistant »                                                            | [ ] |
| Consentement expiré                   | ouvrir l'écran de consentement et attendre plus de 10 minutes                                                    | « Cette demande de connexion a expiré… »                                                                   | [ ] |

### Adresses de retour

Une adresse de retour est acceptée en `https`, ou en `http` vers `localhost`, `127.0.0.1` ou `[::1]` sur n'importe quel port. Les autres sont refusées.

- [ ] **Enregistrement dynamique avec une adresse refusée parmi des bonnes :**

  ```bash
  curl -s -X POST $STAGING/oauth/reg -H 'Content-Type: application/json' \
    -d '{"client_name":"Recette","token_endpoint_auth_method":"none","redirect_uris":["https://example.com/callback","http://localhost:4000/callback","cursor://example/callback","http://example.com/callback"]}'
  ```

  Le client est enregistré : la réponse ne liste que `https://example.com/callback` et `http://localhost:4000/callback`.

- [ ] **Enregistrement dynamique sans aucune bonne adresse :** la même commande avec seulement `cursor://example/callback` et `http://example.com/callback` est refusée avec `invalid_redirect_uri`.
- [ ] **Client enregistré à la main :** dans **Ajouter un client**, une adresse `cursor://…` ou `http://` vers un autre hôte que `localhost` bloque la création, et le message nomme l'adresse refusée.

### Événements de sécurité

Chaque action ci-dessous ajoute un événement dans la collection `securityevents` (via le shell Compass : `db.securityevents.find().sort({ _id: -1 }).limit(5)`), avec son auteur, l'entreprise et la date. Les noms des actions sont dans `packages/server/security-event/security-event.actions.js`.

- [ ] Activer, puis couper l'accès MCP de l'entreprise A.
- [ ] Autoriser, puis arrêter le retex de l'entreprise A.
- [ ] Créer, puis supprimer un client enregistré à la main.
- [ ] **Tout révoquer** dans l'entreprise A.

## 3. Droits sur les écrans

- [ ] **Clients MCP :**
  - l'admin technique de l'entreprise A crée, liste et supprime ses clients ;
  - l'admin d'entreprise non technique n'a pas l'écran ;
  - le super admin y accède pour n'importe quelle entreprise.
- [ ] **Révocation en masse** (**Paramètres › Fonctionnalités IA**, section **Accès MCP**, **Tout révoquer**) :
  - l'admin technique de l'entreprise A révoque toutes ses connexions ;
  - le super admin le fait pour n'importe quelle entreprise ;
  - l'admin d'entreprise non technique n'a pas la page Fonctionnalités IA, et l'appel direct de la route est refusé (`403`) ;
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
