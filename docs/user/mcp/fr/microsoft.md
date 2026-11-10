# Connecter Microsoft Copilot à LePatron

[← Connecter un assistant](./connecter-un-assistant.md)

Deux produits Microsoft se connectent à LePatron. Dans les deux cas, c'est l'informatique de l'entreprise qui fait l'installation, dans son propre tenant Microsoft.

| Produit                                  | Installation                                                   | Identifiant et secret                     |
| ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Copilot Studio, découverte dynamique     | dans l'agent, par son créateur                                 | aucun, Copilot Studio s'enregistre seul   |
| Copilot Studio, mode manuel              | dans l'agent, par son créateur                                 | créés dans LePatron par l'admin technique |
| Microsoft 365 Copilot (agent déclaratif) | Microsoft 365 Agents Toolkit, puis le portail d'administration | aucun, l'agent s'enregistre seul          |

## Copilot Studio

Les intitulés ci-dessous sont ceux de l'interface anglaise de Copilot Studio.

1. Dans l'agent, ouvrir **Tools › Add a tool › New tool**, puis **Model Context Protocol**.
2. Renseigner :
   - **Server name** : `LePatron` ;
   - **Server description** : par exemple « Expertises et skills Badsender pour écrire et relire des emails ». L'agent s'en sert pour décider quand appeler LePatron ;
   - **Server URL** : par exemple `https://app.lepatron.email/mcp`.
3. Authentification : **OAuth 2.0**, puis l'un des deux types suivants.

### Dynamic discovery (recommandé)

Choisir **Dynamic discovery**, puis **Create** : Copilot Studio trouve LePatron et s'enregistre seul. Passer tout de suite à « Créer la connexion » : un client qui s'est enregistré seul et que personne ne connecte dans les 24 heures est oublié, et il faut alors recréer l'outil.

### Manual

À choisir seulement si la politique de l'entreprise impose un client déclaré à l'avance.

Copilot Studio ne donne son **callback URL** qu'après la création de l'outil, alors que LePatron la demande à la création du client. Il faut donc procéder en trois temps :

1. Dans Copilot Studio, choisir **Manual** et remplir les champs avec les valeurs ci-dessous, en mettant provisoirement `a-remplacer` dans **Client ID** et **Client secret**. **Create**, puis copier la **callback URL** affichée.
2. Dans LePatron, l'admin technique crée le client avec cette callback URL comme URL de redirection (voir plus bas), et copie l'identifiant et le secret.
3. Remplacer les valeurs provisoires par le vrai **Client ID** et le vrai **Client secret**. Les réglages OAuth de l'outil se modifient dans le connecteur personnalisé qu'il a créé : portail Power Apps, **Custom connectors**.

| Champ Copilot Studio | Valeur                                            |
| -------------------- | ------------------------------------------------- |
| Client ID            | l'identifiant du client, commence par `lepatron-` |
| Client secret        | le secret, affiché une seule fois à la création   |
| Authorization URL    | `https://app.lepatron.email/oauth/auth`           |
| Token URL template   | `https://app.lepatron.email/oauth/token`          |
| Refresh URL          | `https://app.lepatron.email/oauth/token`          |
| Scopes               | `mcp:read`                                        |

### Créer la connexion

Dans **Add tool**, choisir **Create a new connection** : l'écran de consentement LePatron s'ouvre. Autoriser avec votre propre compte, puis **Add to agent**.

### Créer un client en mode manuel (admin technique)

1. Dans LePatron, ouvrir **Paramètres › Fonctionnalités IA**, puis, dans la section Accès MCP, le lien **Gérer** de la ligne « Clients enregistrés à la main », puis **Ajouter un client**.
2. Renseigner :
   - le nom, qui s'affichera sur l'écran de consentement ;
   - l'URL de redirection : la callback URL donnée par Copilot Studio. Elle doit être en HTTPS, ou en HTTP vers `localhost` ; toute autre adresse est refusée, et le formulaire la nomme ;
   - l'envoi du secret, sous « Réglage avancé » : garder « Dans le corps de la requête » sauf indication contraire.
3. **Copier le secret tout de suite** : il ne sera plus jamais affiché. La fenêtre se ferme une fois qu'il est copié, ou une fois cochée la case qui dit qu'il est enregistré. S'il est perdu, supprimer le client et en créer un autre.

Ce client appartient à votre entreprise : seuls ses utilisateurs peuvent se connecter avec. Le supprimer coupe aussitôt toutes les connexions qui passent par lui.

## Microsoft 365 Copilot

LePatron s'ajoute à Microsoft 365 Copilot par un **agent déclaratif** doté d'un plugin MCP.

1. Dans **Microsoft 365 Agents Toolkit** (version 6.12 ou plus récente), créer un agent déclaratif, puis ajouter une action à partir d'un **serveur MCP** :

   - URL : par exemple `https://app.lepatron.email/mcp` ;
   - authentification : **OAuth (avec enregistrement dynamique)**.

   LePatron délivre à l'agent le secret qu'exige Microsoft.

2. Tester l'agent peu après sa création, dans les 24 heures : l'agent s'enregistre à sa création, et LePatron oublie au bout d'un jour un client que personne ne connecte. Passé ce délai, ajouter l'action à nouveau. Puis en faire un paquet d'application.
3. **L'administrateur du tenant** déploie ce paquet aux utilisateurs concernés, depuis le centre d'administration Microsoft 365 (applications intégrées).
4. À la première utilisation, chaque utilisateur donne son accord sur l'écran LePatron.

## Référence

- [Connecter un agent à un serveur MCP existant](https://learn.microsoft.com/microsoft-copilot-studio/mcp-add-existing-server-to-agent) (Microsoft Learn)
- [Créer un plugin d'agent déclaratif à partir d'un serveur MCP](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/build-mcp-plugins) (Microsoft Learn)
- [Authentification par enregistrement dynamique](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication-dynamic-client-registration) (Microsoft Learn)
