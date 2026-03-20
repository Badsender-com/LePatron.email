# Checklist de Tests - Feature Commentaires MVP

## Pre-requis
- [ ] Rebuild l'éditeur : `cd packages/editor && npm run build`
- [ ] Redémarrer le serveur

---

## 1. Commentaires - Création

### Depuis le panneau général
- [ ] Ouvrir l'éditeur sur un mailing
- [ ] Cliquer sur l'icône commentaires dans la sidebar
- [ ] Écrire un commentaire et cliquer "Ajouter"
- [ ] Vérifier que le commentaire apparaît dans la liste

### Depuis un bloc
- [ ] Survoler un bloc dans l'éditeur
- [ ] Cliquer sur l'icône commentaire (bulle) dans la toolbar du bloc
- [ ] Vérifier que le panneau s'ouvre avec le bloc pré-sélectionné
- [ ] Ajouter un commentaire
- [ ] Vérifier que le badge compteur apparaît sur le bloc

### Options de commentaire
- [ ] Tester les catégories : Général, Design, Contenu
- [ ] Tester les sévérités : Info, Important, Bloquant
- [ ] Vérifier l'affichage des badges de sévérité

---

## 2. Commentaires - Réponses

- [ ] Cliquer sur "Répondre" sur un commentaire existant
- [ ] Vérifier que le formulaire de réponse s'affiche inline sous le commentaire
- [ ] Écrire une réponse et valider
- [ ] Vérifier que la réponse apparaît indentée sous le commentaire parent
- [ ] Tester "Annuler" pour fermer le formulaire de réponse

---

## 3. Commentaires - Modification

- [ ] Créer un commentaire
- [ ] Cliquer sur "Modifier" (visible seulement pour l'auteur)
- [ ] Changer le texte et sauvegarder
- [ ] Vérifier que le texte est mis à jour

---

## 4. Commentaires - Suppression

- [ ] Cliquer sur "Supprimer" sur un commentaire
- [ ] Confirmer la suppression
- [ ] Vérifier que le commentaire disparaît
- [ ] Tester la suppression cascade (supprimer un commentaire avec réponses)

---

## 5. Commentaires - Résolution

- [ ] Cliquer sur "Résoudre" sur un commentaire non résolu
- [ ] Vérifier que le badge "Résolu" apparaît
- [ ] Vérifier que le compteur "non résolus" se met à jour
- [ ] Vérifier que le badge sur le bloc se met à jour

---

## 6. Mentions (@user)

- [ ] Dans le champ de commentaire, taper "@"
- [ ] Vérifier que la liste des utilisateurs du groupe apparaît
- [ ] Continuer à taper pour filtrer (ex: "@joh")
- [ ] Cliquer sur un utilisateur pour insérer la mention
- [ ] Vérifier le format inséré : `@[Nom Utilisateur](userId)`
- [ ] Soumettre le commentaire avec mention

---

## 7. Bloc supprimé

- [ ] Créer un commentaire sur un bloc
- [ ] Supprimer le bloc dans l'éditeur
- [ ] Sauvegarder le mailing
- [ ] Recharger la page
- [ ] Vérifier que le commentaire affiche "Bloc supprimé" en rouge

---

## 7b. Navigation vers le bloc

- [ ] Créer un commentaire sur un bloc
- [ ] Dans le panneau commentaires, cliquer sur l'identifiant du bloc (badge gris)
- [ ] Vérifier que le bloc se sélectionne dans l'éditeur
- [ ] Vérifier que la page scrolle vers le bloc
- [ ] Vérifier l'effet de surbrillance bleu temporaire (2 pulsations)
- [ ] Tester avec un bloc supprimé → doit afficher un message d'erreur

---

## 8. Notifications

### Création de notifications
- [ ] Mentionner un autre utilisateur dans un commentaire
- [ ] Se connecter avec cet utilisateur
- [ ] Vérifier que la cloche affiche un badge

### Cloche de notifications
- [ ] Cliquer sur la cloche dans le header
- [ ] Vérifier que les notifications apparaissent dans le dropdown
- [ ] Cliquer sur "Marquer tout comme lu"
- [ ] Vérifier que le badge disparaît

### Types de notifications
- [ ] Mention : "@user vous a mentionné dans un commentaire"
- [ ] Réponse : "user a répondu à votre commentaire"
- [ ] Résolution : "user a résolu un commentaire"

---

## 9. Liste des mailings

- [ ] Aller sur la liste des mailings
- [ ] Vérifier la colonne "Commentaires" avec le compteur
- [ ] Cliquer sur l'icône commentaires
- [ ] Vérifier la redirection vers l'éditeur avec `?comments=1`

---

## 10. Filtres et navigation

- [ ] Avec plusieurs commentaires sur différents blocs
- [ ] Cliquer sur un bloc → vérifier le filtre automatique
- [ ] Cliquer "Tout afficher" → vérifier que tous les commentaires apparaissent
- [ ] Vérifier le scroll avec beaucoup de commentaires

---

## 11. Permissions

### Utilisateur standard
- [ ] Peut créer/modifier/supprimer SES commentaires
- [ ] Ne peut PAS supprimer les commentaires des autres
- [ ] Peut résoudre n'importe quel commentaire

### Admin groupe
- [ ] Peut supprimer n'importe quel commentaire du groupe

---

## Résultat des tests

| Section | Statut | Notes |
|---------|--------|-------|
| 1. Création | | |
| 2. Réponses | | |
| 3. Modification | | |
| 4. Suppression | | |
| 5. Résolution | | |
| 6. Mentions | | |
| 7. Bloc supprimé | | |
| 8. Notifications | | |
| 9. Liste mailings | | |
| 10. Filtres | | |
| 11. Permissions | | |

Date des tests : ____________
Testeur : ____________
