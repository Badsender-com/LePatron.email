# Connecter ChatGPT à LePatron

[← Connecter un assistant](./connecter-un-assistant.md)

Dans ChatGPT Business, Enterprise et Edu, un serveur MCP comme LePatron s'ajoute comme **application personnalisée** de l'espace de travail. ChatGPT s'enregistre seul auprès de LePatron : il n'y a ni identifiant ni secret à saisir.

OpenAI fait souvent évoluer les intitulés de ces menus (« Connecteurs », « Apps », « Plugins »). En cas de doute, suivez la page d'aide d'OpenAI citée plus bas.

## 1. Créer l'application (admin de l'espace ChatGPT)

Seuls les admins et les propriétaires de l'espace de travail peuvent créer et publier une application personnalisée.

1. Dans les paramètres de l'espace de travail, ouvrir la création d'une application MCP personnalisée. Selon la version, il faut d'abord activer le **mode développeur**.
2. Renseigner :
   - nom : `LePatron` ;
   - URL du serveur MCP : par exemple `https://app.lepatron.email/mcp` ;
   - authentification : **OAuth**.
3. Enregistrer : ChatGPT ouvre l'écran de consentement LePatron. Autoriser avec votre propre compte, ce qui teste la connexion.
4. Vérifier la liste des actions proposées, puis **publier** l'application pour l'espace de travail.

## 2. Se connecter (chaque utilisateur)

Une fois l'application publiée, chaque utilisateur l'active dans ses applications ChatGPT, puis donne son accord sur l'écran LePatron. La connexion est personnelle : chacun lit LePatron avec ses propres droits.

## Bon à savoir

- **Liste des actions :** si LePatron ajoute des outils plus tard, l'admin doit rafraîchir la liste des actions de l'application. Sur certaines offres, il faut recréer l'application.
- **Application non vérifiée :** une application personnalisée n'est pas vérifiée par OpenAI. C'est l'admin de l'espace de travail qui la valide pour ses utilisateurs.

## Référence

- [Creating custom MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt) (OpenAI)
- [Admin controls for apps](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-in-apps-connectors-enterprise-edu-and-business) (OpenAI)
