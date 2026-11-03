# Connecter un assistant IA à LePatron

Votre assistant IA (Claude, ChatGPT, Copilot…) peut lire LePatron en votre nom :

- les expertises et les skills de Badsender, pour s'en servir quand vous lui demandez d'écrire ou de relire un email ;
- vos mailings : il les liste (par workspace, dossier, auteur, tags ou dates, avec leur statut) et en lit le texte, ou le HTML de l'aperçu. Les variables de personnalisation, comme `{{firstname}}`, restent telles quelles.

Il le fait avec **vos droits**, dans **une seule entreprise**, celle que vous choisissez au moment de la connexion. Il ne peut rien modifier dans LePatron.

Cette connexion passe par le protocole MCP (Model Context Protocol), que ces assistants savent tous utiliser.

## Avant de commencer

- **L'accès MCP doit être activé pour votre entreprise.** L'admin technique de l'entreprise (ou Badsender) l'active dans **Paramètres › Fonctionnalités IA › Accès MCP**, avec l'interrupteur de la section. S'il est coupé, la connexion est refusée.
- **Connectez-vous avec votre propre compte LePatron**, celui de tous les jours.
- **L'adresse du serveur MCP** est celle de votre LePatron suivie de `/mcp`, par exemple `https://app.lepatron.email/mcp`. Votre admin technique la copie dans **Paramètres › Fonctionnalités IA › Accès MCP**, sous « Adresse à donner à vos utilisateurs ». Les autres valeurs qu'un assistant peut demander sont sur la page des clients MCP (ligne « Clients enregistrés à la main », lien **Gérer**), sous « Paramètres du serveur ».

## Choisissez votre assistant

| Assistant                                       | Qui fait l'installation                           | Page                        |
| ----------------------------------------------- | ------------------------------------------------- | --------------------------- |
| Claude (claude.ai, Claude Desktop, Claude Code) | vous, ou le propriétaire de l'organisation Claude | [Claude](./claude.md)       |
| ChatGPT Business, Enterprise, Edu               | un admin de l'espace de travail ChatGPT           | [ChatGPT](./chatgpt.md)     |
| Microsoft Copilot Studio, Microsoft 365 Copilot | l'informatique de votre entreprise                | [Microsoft](./microsoft.md) |
| VS Code avec GitHub Copilot                     | vous                                              | [VS Code](./vscode.md)      |

## Ce qui se passe à la connexion

1. L'assistant ouvre une fenêtre LePatron. Connectez-vous si besoin (mot de passe, SSO de l'entreprise, double authentification).
2. L'écran **« Connecter … à LePatron »** indique :
   - quelle application demande l'accès ;
   - vers quel site vous serez renvoyé ;
   - ce qu'elle pourra faire ;
   - l'entreprise à laquelle la connexion sera liée.
3. Vérifiez le nom de l'application. Si l'écran précise que l'application « s'est enregistrée elle-même », ne continuez que si vous venez de lancer la connexion depuis votre assistant.
4. Cliquez sur **Autoriser**. Vous revenez dans votre assistant, qui est connecté.

L'écran de consentement s'affiche à chaque nouvelle connexion : c'est là que l'entreprise est choisie.

## Voir et révoquer vos applications connectées

L'icône en forme de prise, en bas de la barre latérale, ouvre **Applications connectées**. Vous y voyez, pour chaque assistant, l'entreprise, la date de connexion et la dernière utilisation.

**Révoquer** coupe l'accès immédiatement : l'assistant est refusé dès sa requête suivante. Pour l'utiliser de nouveau, il faut le reconnecter.

L'admin technique de l'entreprise peut aussi tout révoquer d'un coup, dans **Paramètres › Fonctionnalités IA › Accès MCP**, par exemple si un accès a fuité.

Une connexion dure 90 jours au plus : passé ce délai, l'assistant vous demande de le reconnecter. Changer de mot de passe déconnecte aussi tous vos assistants. Reconnecter un assistant déjà connecté remplace sa connexion précédente.

## Si la connexion échoue

| Message                                                                          | Cause                                                                                                                                                | Que faire                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Votre entreprise n'a pas l'accès MCP                                             | l'accès MCP est coupé                                                                                                                                | demander à l'admin technique de l'activer         |
| Ce compte ne peut pas connecter d'assistant                                      | vous êtes connecté avec le compte d'administration de la plateforme                                                                                  | vous connecter avec votre compte utilisateur      |
| Cette application est réservée aux utilisateurs de l'entreprise qui l'a déclarée | le client MCP appartient à une autre entreprise                                                                                                      | utiliser le connecteur de votre propre entreprise |
| Cette demande de connexion a expiré, ou a été lancée depuis un autre navigateur  | plus de 10 minutes se sont écoulées, ou la fenêtre a été ouverte dans un autre navigateur                                                            | relancer la connexion depuis l'assistant          |
| L'assistant dit ne plus avoir accès                                              | l'application a été révoquée, l'accès MCP a été coupé, votre mot de passe a changé, votre compte a été désactivé, ou la connexion a plus de 90 jours | reconnecter l'assistant une fois l'accès rétabli  |
