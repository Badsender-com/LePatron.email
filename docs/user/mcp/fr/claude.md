# Connecter Claude à LePatron

[← Connecter un assistant](./connecter-un-assistant.md)

LePatron s'ajoute à Claude comme **connecteur personnalisé** (custom connector). Claude s'enregistre seul auprès de LePatron : il n'y a ni identifiant ni secret à saisir.

## claude.ai et Claude Desktop

Un connecteur ajouté sur claude.ai est aussi disponible dans Claude Desktop, avec le même compte Claude.

Les intitulés ci-dessous sont ceux de l'interface anglaise de Claude.

### Offres Team et Enterprise

1. **Le propriétaire de l'organisation Claude** ajoute le connecteur, une fois pour tous :
   1. **Organization settings › Connectors › Add**, puis **Custom › Web** ;
   2. nom : `LePatron` ; URL : l'adresse du serveur MCP, par exemple `https://app.lepatron.email/mcp` ; **Continue** ;
   3. garder les réglages d'authentification détectés ;
   4. **OAuth client** : **Use Claude's published identity (Recommended)** ;
   5. **Add**.
2. **Chaque utilisateur** ouvre ensuite **Customize › Connectors**, trouve **LePatron** (marqué « Custom »), clique sur **Connect** et donne son accord sur l'écran LePatron.

### Offres individuelles (Pro, Max)

**Customize › Connectors › + Add › Add custom connector** : saisir le nom et l'URL, garder les réglages proposés (**Use Claude's published identity**), puis **Add** et **Connect**.

### Utilisation

Dans une conversation, activez LePatron avec le bouton **+**, puis **Connectors**. Claude peut alors :

- lire les expertises Badsender et retrouver celles qui s'appliquent à votre demande ;
- utiliser les skills Badsender, que vous retrouvez aussi parmi les commandes proposées ;
- envoyer un avis à Badsender quand vous le lui demandez.

## Claude Code

Dans un terminal :

```bash
claude mcp add --transport http lepatron https://app.lepatron.email/mcp
```

Puis, dans une session Claude Code, tapez `/mcp`, choisissez **lepatron** et **Authenticate** : le navigateur ouvre l'écran de consentement LePatron.

Ajoutez `--scope user` pour disposer de LePatron dans tous vos projets.

## Référence

- [Utiliser les connecteurs sur claude.ai](https://support.claude.com/en/articles/11175166-using-connectors-in-claude-ai) (Anthropic)
