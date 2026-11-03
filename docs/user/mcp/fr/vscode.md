# Connecter VS Code et GitHub Copilot à LePatron

[← Connecter un assistant](./connecter-un-assistant.md)

GitHub Copilot, dans VS Code, utilise LePatron en **mode agent**. VS Code s'enregistre seul auprès de LePatron : il n'y a ni identifiant ni secret à saisir.

## Installation

1. Ouvrir la palette de commandes et lancer **MCP: Add Server**.
2. Choisir **HTTP (HTTP or Server-Sent Events)**, puis saisir :
   - l'URL du serveur MCP, par exemple `https://app.lepatron.email/mcp` ;
   - le nom `lepatron`.
3. Choisir où enregistrer le serveur : pour vous seul, ou pour tous vos projets.
4. Au démarrage du serveur, VS Code demande l'autorisation de se connecter, puis ouvre l'écran de consentement LePatron dans le navigateur. Autoriser.
5. Dans la vue Chat, passer en **mode agent** : les outils de LePatron apparaissent dans la liste des outils.

## Si ça ne marche pas

- Le menu de gestion des serveurs MCP de VS Code affiche l'état de `lepatron` et son journal d'erreurs.
- Un proxy d'entreprise peut bloquer le retour vers VS Code après le consentement : essayer depuis un autre réseau.
- Dans une organisation GitHub, l'usage des serveurs MCP par Copilot peut être désactivé par une règle de l'organisation.

## Référence

- [Add MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) (Microsoft)
