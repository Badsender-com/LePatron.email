# Refonte des panneaux de droite de l'éditeur

Référence de conception pour la refonte des trois panneaux de droite : Commentaires, Tester l'email (Contrôle qualité, Envoi de test, lien d'aperçu) et Outils IA. Décisions produit du 2026-11-04.

- `png/` : les 17 planches, à regarder en premier.
- `html/` : leur source. Les valeurs de couleur, de taille et d'espacement y sont en clair. Elles reprennent les jetons de l'éditeur (`--primary`, `--accent`, `--gray-*`, `--error`, `--success`) : à l'implémentation, on utilise les jetons, jamais les hex.

Les maquettes fixent la structure, la hiérarchie, les libellés et les états. Ce ne sont pas des spécifications au pixel près.

## Planches

| Fichier          | Contenu                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `v3-shell`       | Shell commun : rail, en-tête, fermer, corps, pied ; états chargement, vide plein, vide compact, erreur |
| `v3-comments-c1` | Rédacteur : filtre « Tous », cible = bloc sélectionné                                                  |
| `v3-comments-c2` | Menu de la cible du commentaire                                                                        |
| `v3-comments-c3` | Relecteur : bloquant ouvert, Approuver désactivé avec la raison                                        |
| `v3-comments-c5` | Relecteur : nouveaux commentaires arrivés, Approuver disponible                                        |
| `v3-comments-c4` | Email approuvé : l'approbation comme événement dans le fil                                             |
| `v3-comments-c6` | Validation levée par un nouveau commentaire                                                            |
| `v3-ai-a1`       | Outils IA : rien de sélectionné                                                                        |
| `v3-ai-a2`       | Outils IA : champ sélectionné, chaque action nomme sa portée                                           |
| `v3-ai-a3`       | Générer l'objet : propositions                                                                         |
| `v3-ai-a4`       | Corriger tout l'email : analyse en cours                                                               |
| `v3-ai-a5`       | Corriger tout l'email : bilan                                                                          |
| `v3-test-q1`     | Contrôle qualité : avant lancement                                                                     |
| `v3-test-q2`     | Contrôle qualité : pas prêt, un bloquant                                                               |
| `v3-test-q3`     | Contrôle qualité : prêt, infos à consulter                                                             |
| `v3-test-q4`     | Envoi de test : saisie, aucun lien                                                                     |
| `v3-test-q5`     | Envoi de test : test envoyé, lien actif                                                                |

Non dessinés, à traiter sur le même modèle : pause sur quota de l'IA (compte à rebours dans le bandeau de progression), mode Copier, lien expiré, adresse invalide, panneau Commentaires vide.

## Périmètre

Seulement la droite de l'éditeur : la coque (topbar et rail) et les trois panneaux, avec leurs flux et leur comportement selon le rôle. La barre de gauche fera l'objet d'une itération suivante ; la grammaire commune doit pouvoir s'y appliquer.

## Décisions produit

| #   | Sujet                                                   | Décision                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Commentaires en Vue                                     | Le panneau est réécrit en Vue directement dans le nouveau design. Le rail de marqueurs et l'outil « Commenter ce bloc », qui vivent dans le canevas, restent en Knockout. Un shell Vue commun porte la grammaire des trois panneaux.                                                                  |
| 2   | Position du panneau                                     | Ancré : il pousse le canevas. Les boutons quittent la topbar pour un rail vertical, sous la topbar, au bord droit.                                                                                                                                                                                    |
| 2b  | Place insuffisante                                      | Recouvrement accepté : sous environ 1450 px de large, panneau ouvert, l'email passe en partie sous le panneau. Pas de repli automatique de la barre de gauche.                                                                                                                                        |
| 3   | Qui approuve                                            | Relecteur et admins. Nouvelle capacité `mailing.approve`.                                                                                                                                                                                                                                             |
| 4   | Outils IA sans droit d'édition                          | Masqué, avec tous ses points d'entrée.                                                                                                                                                                                                                                                                |
| 5   | Désactiver un lien d'aperçu                             | Tout le monde peut désactiver n'importe quel lien, comme aujourd'hui. Action définitive, signalée comme telle.                                                                                                                                                                                        |
| 6   | Email « prêt »                                          | Aucune erreur ni avertissement non ignoré, et tous les contrôles exécutés. Les infos ne comptent pas, sauf si elles sont bloquantes. Une seule règle pour le badge du rail, la carte du panneau et le bandeau de l'envoi de test (le `cleared` actuel). Rouge = bloquant uniquement, accent = volume. |
| 7   | Filtre et cible des commentaires                        | Le filtre ne sert qu'à lire. La cible du nouveau commentaire est explicite dans le pied (« Sur : Tout l'email » ou le bloc sélectionné), modifiable, et suit la sélection par défaut.                                                                                                                 |
| 7b  | Marqueur actif du rail des commentaires                 | Celui de la cible.                                                                                                                                                                                                                                                                                    |
| 8   | Base de code                                            | La refonte s'empile au-dessus de `feat/ai-correction-entry-points`.                                                                                                                                                                                                                                   |
| 9   | Approuver avec un bloquant ouvert                       | Bouton désactivé avec la raison ; règle vérifiée aussi côté serveur et dans le calcul de « Validé ».                                                                                                                                                                                                  |
| 10  | Approbation dans le fil                                 | Événement à part : sans type ni priorité, hors des compteurs de non résolus, retirable par son auteur ou un modérateur des commentaires. Valable jusqu'à son retrait, même si l'email est modifié ensuite.                                                                                            |
| 11  | Texte par défaut d'une approbation                      | « Bon pour envoi ».                                                                                                                                                                                                                                                                                   |
| 12  | Rafraîchissement des commentaires                       | Toutes les 30 s tant que le panneau est ouvert et l'onglet visible, une seule requête par cycle, allégée côté serveur ; et à chaque réouverture.                                                                                                                                                      |
| 13  | Ce qui lève la validation                               | Tout nouveau commentaire racine. Le fil le dit sous l'approbation (planche `c6`).                                                                                                                                                                                                                     |
| 14  | Deux approbations, l'une retirée                        | L'email reste validé par l'autre.                                                                                                                                                                                                                                                                     |
| 15  | Suppression du commentaire qui avait levé la validation | L'email redevient validé.                                                                                                                                                                                                                                                                             |
| 16  | Pied tronqué des panneaux (régression de #1185)         | Corrigé dans #1185, hors refonte.                                                                                                                                                                                                                                                                     |

## Partis pris de la maquette

- Commentaires : Type et Priorité en deux menus ; la cible ne propose que « Tout l'email » ou le bloc sélectionné ; les nouveaux commentaires arrivent derrière une pastille « N nouveaux commentaires · Afficher » ; le bouton dit « Approuver l'email ».
- Outils IA : chaque action nomme sa portée (« Corriger ce champ », « Corriger ce bloc », « Corriger tout l'email ») ; correction affichée avant barré / après, avec Accepter et Ignorer ; « Tout accepter » est l'action principale du pied ; bilan chiffré en fin d'analyse.
- Tester l'email : « Lancer le contrôle » et « Envoyer un test » dans le pied ; bandeau rouge seulement s'il y a un bloquant ; un seul champ Destinataires pour les adresses et les listes enregistrées ; un seul bouton « Copier » pour le lien.
