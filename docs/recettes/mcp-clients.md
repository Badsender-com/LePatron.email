# Recette — Serveur MCP : matrice des clients

À rejouer **en staging avant chaque release** qui touche le serveur MCP, l'OAuth, les comptes ou les groupes. Elle vérifie que chaque famille d'assistants se connecte, lit LePatron et se fait refuser quand elle le doit.

La documentation utilisateur suivie pendant la recette est dans [docs/user/mcp/](../user/mcp/README.md). Si un menu d'assistant a changé, corriger la page correspondante dans la même release.

## 0. Préparation

### Clés de signature

Le serveur ne démarre pas, hors développement, sans les clés qui signent les tokens MCP : sans elles, il signerait avec les clés de développement d'`oidc-provider`, qui sont publiques. Les générer une fois par environnement, et les garder secrètes :

```bash
node -e "const {generateKeyPair, exportJWK}=require('jose');generateKeyPair('RS256',{extractable:true}).then(async({privateKey})=>console.log(JSON.stringify({keys:[{...(await exportJWK(privateKey)),use:'sig',alg:'RS256',kid:'mcp-1'}]})))"
```

Puis les donner à l'application dans la variable `lepatron_mcpOauthJwks`. Les changer déconnecte tous les assistants.

### Comptes et groupes de staging

| Rôle                               | Groupe            | Accès MCP du groupe |
| ---------------------------------- | ----------------- | ------------------- |
| Utilisateur simple                 | groupe A          | activé              |
| Admin technique                    | groupe A          | activé              |
| Admin d'entreprise (non technique) | groupe A          | activé              |
| Utilisateur simple                 | groupe B          | activé              |
| Utilisateur simple                 | groupe C          | **coupé**           |
| Super admin                        | groupe plateforme | —                   |

Le groupe A doit avoir au moins une expertise et un skill actifs.

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

Pour chaque client, avec l'utilisateur simple du groupe A, en suivant la page de documentation :

1. **Connexion :** l'écran de consentement affiche le bon nom d'application, l'hôte de retour et le groupe A. Après **Autoriser**, on revient dans l'assistant.
2. **Lecture :** l'assistant liste les outils de LePatron, trouve une expertise du groupe A et utilise un skill.
3. **Suivi :** dans **Applications connectées**, l'assistant apparaît avec le groupe A et une dernière utilisation récente.
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
- [ ] **Microsoft 365 Copilot :** l'agent obtient un secret à l'enregistrement, et le paquet se déploie depuis le centre d'administration.
- [ ] **Renouvellement :** un assistant laissé connecté plus d'une heure fonctionne encore (renouvellement du token).

## 2. Refus

| Cas                                      | Comment le provoquer                                                                         | Attendu                                                                                                    | OK  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --- |
| Groupe sans accès MCP                    | connecter un assistant avec l'utilisateur du groupe C                                        | consentement refusé : « Votre entreprise n'a pas l'accès MCP »                                             | [ ] |
| Accès MCP coupé après connexion          | connecter l'utilisateur du groupe A, puis couper l'accès MCP du groupe A                     | l'assistant est refusé ; l'application disparaît de la liste ; réactiver l'accès ne la fait pas revenir    | [ ] |
| Application révoquée                     | **Révoquer** depuis Applications connectées                                                  | refus à la requête suivante, renouvellement refusé                                                         | [ ] |
| Révocation par l'admin                   | **Paramètres › Fonctionnalités IA › Accès MCP › Tout révoquer**, admin technique du groupe A | toutes les applications du groupe A sont refusées, celles du groupe B fonctionnent                         | [ ] |
| Utilisateur désactivé                    | désactiver l'utilisateur connecté                                                            | refus ; le réactiver ne fait pas revenir ses connexions                                                    | [ ] |
| Client d'une autre entreprise            | utiliser le client manuel du groupe A avec l'utilisateur du groupe B                         | consentement refusé : « Cette application est réservée aux utilisateurs de l'entreprise qui l'a déclarée » | [ ] |
| Client manuel supprimé                   | supprimer le client depuis **Gérer les clients MCP**                                         | refus immédiat des connexions qui passaient par lui                                                        | [ ] |
| Compte d'administration de la plateforme | consentir avec le compte admin de configuration                                              | « Ce compte ne peut pas connecter d'assistant »                                                            | [ ] |
| Consentement expiré                      | ouvrir l'écran de consentement et attendre plus de 10 minutes                                | « Cette demande de connexion a expiré… »                                                                   | [ ] |

## 3. Droits sur les écrans

- [ ] **Clients MCP :**
  - l'admin technique du groupe A crée, liste et supprime ses clients ;
  - l'admin d'entreprise non technique n'a pas l'écran ;
  - le super admin y accède pour n'importe quel groupe.
- [ ] **Révocation en masse :** l'utilisateur simple ne voit pas « Applications connectées » dans les paramètres du groupe.
- [ ] **Consentement d'un super admin :**
  - avec un client du groupe A, seul le groupe A est proposé ;
  - avec Claude, tous les groupes qui ont l'accès MCP sont proposés.

## 4. Après la recette

- [ ] Révoquer les applications de test, supprimer les clients manuels de test.
- [ ] Reporter les écarts de menus dans [docs/user/mcp/](../user/mcp/README.md).
