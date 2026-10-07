# Brief de mise à jour de la refonte : rôles, permissions et validation

Brief destiné au projet Claude Design de refonte (sidebar v2 et écrans associés). Il décrit ce que le produit fait réellement sur la branche `feat/roles-permissions` au mercredi 7 octobre 2026, pour que la maquette en tienne compte.

Les règles de fond sont dans [`docs/plans/rbac-refonte.md`](../plans/rbac-refonte.md). Ce brief les traduit en consignes de design. Il ne remplace pas ce document.

## Sommaire

1. [Rôles et vocabulaire](#1-rôles-et-vocabulaire)
2. [Sidebar v2 : évolutions à intégrer](#2-sidebar-v2--évolutions-à-intégrer)
3. [Listing des emails](#3-listing-des-emails)
4. [Éditeur](#4-éditeur)
5. [Écrans d'administration](#5-écrans-dadministration)
6. [Écrans à concevoir](#6-écrans-à-concevoir)
7. [Règles transverses](#7-règles-transverses)
8. [Points à valider](#8-points-à-valider)

---

## 1. Rôles et vocabulaire

Le rôle est global à la company. Il ne varie jamais selon le workspace.

| Rôle (valeur en base) | Libellé produit | Résumé                                                                                       |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `regular_user`        | Utilisateur     | Accès complet au builder, sur les workspaces qui lui sont assignés                           |
| `writer`              | Rédacteur       | Édite le contenu. Ni structure, ni style. Ne crée ni ne supprime un email                    |
| `reviewer`            | Relecteur       | Lit, commente, teste et approuve. Ne modifie rien                                            |
| `company_admin_tech`  | Admin technique | Réglages techniques : intégrations, IA, tracking, flux. Ni utilisateurs, ni workspaces       |
| `company_admin`       | Admin company   | Utilisateurs, rôles, workspaces, couleurs, réglages généraux. Plus d'accès aux réglages tech |
| `super_admin`         | Super admin     | Tout, sur toutes les companies. Plusieurs comptes possibles, gérés dans un écran dédié       |

Vocabulaire : « company » dans l'interface. Le code dit encore « group ».

## 2. Sidebar v2 : évolutions à intégrer

La sidebar compte trois zones : modules, contexte (arbre des workspaces ou liste des réglages), système (réglages, aide, déconnexion). Quatre évolutions de la branche la touchent.

### 2.1 Nouvelle entrée « Super admins »

- Catégorie « Super admin » de la liste des réglages, entre « Companies » et « AI Playground ».
- Icône `UserCog` (Lucide). Route `/super-admins`. Visible des seuls super admins.

### 2.2 Réglages scindés entre admin company et admin technique

La liste des réglages applique désormais deux droits distincts. Les entrées « Intégrations », « AI features », « Tracking » et « Feed mappings » quittent `company_admin` pour `company_admin_tech`. L'entrée « Variables » est partagée par les deux rôles.

| Entrée                                                            | Catégorie         | Rôles qui la voient                                  |
| ----------------------------------------------------------------- | ----------------- | ---------------------------------------------------- |
| Général, Utilisateurs                                             | Général           | `company_admin`, `super_admin` (voir 8.1)            |
| Workspaces, Taxonomie                                             | Général           | `company_admin`, `super_admin`                       |
| Intégrations, AI features                                         | Général           | `company_admin_tech`, `super_admin`                  |
| Email builder (réglages), Couleurs, Groupes d'emails              | Email builder     | `company_admin`, `super_admin`                       |
| Variables                                                         | Email builder     | `company_admin`, `company_admin_tech`, `super_admin` |
| Tracking, Feed mappings                                           | Email builder     | `company_admin_tech`, `super_admin`                  |
| Export options, Templates, Mailings, Profils ESP                  | Email builder     | `super_admin`                                        |
| Companies, Super admins, AI Playground, AI Skills, CRM dashboards | Super admin / CRM | `super_admin`                                        |

Conséquence de design : la catégorie « Général » est vide ou presque pour un admin technique. Prévoir son état réduit.

### 2.3 Arbre des workspaces

Le relecteur voit l'arbre et peut naviguer. Il n'a plus de menu d'actions sur les dossiers : pas de création de sous-dossier, de renommage, de déplacement ni de suppression. Le rédacteur garde ces actions aujourd'hui (voir 8.2).

### 2.4 Entrée « Réglages » de la zone système

Elle est visible des seuls `company_admin` et `super_admin`. Les rôles `regular_user`, `writer` et `reviewer` ne la voient pas, ce qui est voulu. L'admin technique ne la voit pas non plus : c'est un écart à corriger (voir 8.1).

### 2.5 Pas de changement

Les modules (Email builder, CRM Intelligence) restent conditionnés par les flags de la company. Aucun rôle ne modifie cette zone.

## 3. Listing des emails

| Élément                                     | `regular_user` | `writer`  | `reviewer` | Admins  |
| ------------------------------------------- | -------------- | --------- | ---------- | ------- |
| Bouton « Nouveau mail »                     | actif          | désactivé | désactivé  | actif   |
| Renommer, déplacer, dupliquer, tags         | visible        | visible   | masqué     | visible |
| Transférer                                  | visible        | masqué    | masqué     | visible |
| Supprimer                                   | visible        | masqué    | masqué     | visible |
| Barre d'actions groupées : tags et déplacer | visible        | visible   | masqué     | visible |
| Barre d'actions groupées : supprimer        | visible        | masqué    | masqué     | visible |

Le rédacteur peut dupliquer, renommer et déplacer pour créer des variantes. Il ne peut ni créer un email de zéro, ni en supprimer.

**Nouveau : pastille de validation.** Un email est « validé » quand son dernier commentaire racine non supprimé est une approbation. La pastille verte avec un check remplace alors la pastille bleue du nombre de commentaires non résolus. Elle n'affiche aucun nombre : le détail reste dans le panneau de commentaires. Un commentaire posté ensuite, même simple, retire la validation et la pastille bleue revient.

## 4. Éditeur

### 4.1 Panneau de commentaires et action « Approuver »

C'est la fonctionnalité de validation du relecteur.

- Une seule décision est exposée : **Approuver**. Un commentaire simple vaut déjà demande de changement. Il n'y a pas de bouton « Demander des changements ».
- Elle se pose depuis le composeur de commentaire, sur un commentaire racine.
- Le texte est facultatif. S'il est vide, un message par défaut est inséré, dans la langue du compte.
- Elle est visible pour `reviewer`, `company_admin` et `super_admin`. Elle est masquée pour `writer`, `regular_user` et `company_admin_tech`.
- Dans le fil, un badge distinct signale les commentaires d'approbation.
- Le panneau s'ouvre par défaut à l'arrivée dans l'éditeur, pour le relecteur seulement.
- Les catégories (`design`, `content`, `general`) et les sévérités (`info`, `important`, `blocking`) existent déjà. La sévérité ne conditionne pas la validation.

À maquetter : le composeur avec le bouton « Approuver », le badge dans le fil, l'état validé et l'état levé par un commentaire ultérieur.

### 4.2 Toolbox et canvas par rôle

| Zone                                              | `regular_user` | `writer`                                          | `reviewer`                      |
| ------------------------------------------------- | -------------- | ------------------------------------------------- | ------------------------------- |
| Onglet Blocs (structure)                          | actif          | verrouillé                                        | onglets masqués, message unique |
| Onglet Contenu                                    | actif          | actif                                             | verrouillé                      |
| Onglet Style, CSS de l'email                      | actif          | verrouillé (lecture)                              | verrouillé                      |
| Barre d'outils d'un bloc                          | complète       | sans déplacer, dupliquer, supprimer, bibliothèque | « Commenter » seul              |
| Édition en ligne du texte, de l'image, du lien    | oui            | oui                                               | inerte                          |
| Constructeurs (bloc composé, bloc code HTML, CSS) | oui            | refusés                                           | refusés                         |
| Renommer l'email (titre)                          | oui            | oui                                               | non                             |
| Bouton « Sauvegarder »                            | actif          | actif                                             | désactivé                       |
| Envoi de test                                     | oui            | oui                                               | oui                             |

Principe de design : un verrouillage affiche un message qui explique pourquoi. Il ne laisse jamais une zone vide ou cassée.

### 4.3 Contrôle qualité

Panneau « tester l'email avant envoi » : résultats, relance, envoi de test, ressources.

- Tous les rôles voient les résultats, relancent, envoient un test et transforment un résultat en commentaire.
- « Ignorer un résultat » est masqué pour `reviewer` et `writer`. Ils gardent la consultation, le saut vers le bloc et le commentaire.

### 4.4 Liens de partage

Aperçu public en lecture seule de la dernière version enregistrée, avec expiration et révocation. Pas de commentaire possible pour la personne qui consulte.

- Tous les rôles listent et créent un lien.
- La révocation vise ses propres liens (tous les rôles) ou ceux des autres (`company_admin`, `company_admin_tech`, `super_admin`).

### 4.5 Génération de texte par IA (sujet, préheader)

- Utilisable dans l'éditeur par tous les rôles sauf `reviewer`.
- Configurable par `company_admin` et `company_admin_tech` (voir 8.3).

## 5. Écrans d'administration

### 5.1 Sélecteur de rôle

Une liste unique, dans l'ordre : Utilisateur, Rédacteur, Relecteur, Admin technique, Admin company. `super_admin` n'y figure pas : il se pose depuis l'écran des super admins. Le sélecteur ne le propose que si la personne l'a déjà.

### 5.2 Écran « Super admins »

Liste des comptes super admin, rattachés à la company plateforme. Garde-fous visibles : on ne se rétrograde pas, on ne se désactive pas, il reste au moins un super admin actif. Le compte de bootstrap défini en variable d'environnement n'est jamais listé.

## 6. Écrans à concevoir

À maquetter. Aucun n'est livré dans le code.

| Écran                                     | État           | Contenu attendu                                                                             |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| Spectateur qui commente (lien de partage) | Différé, #1104 | Vue en lecture seule, nom saisi à la volée, commentaire contextualisé, bandeau d'expiration |
| Journal d'audit                           | Non commencé   | Liste filtrée par company : changement de rôle, création de lien, réglages sensibles        |
| Équipes                                   | Différé, #1100 | Écran calqué sur les workspaces, sélecteur multiple dans le profil et le workspace          |
| Assignation des workspaces à la création  | Non couvert    | Sélecteur multiple, comme dans le formulaire de workspace                                   |
| Garde-fou « dernier admin company »       | Différé        | Message bloquant lors du retrait du dernier `company_admin`                                 |

## 7. Règles transverses

1. Une action indisponible est **désactivée avec une infobulle**, sauf quand elle n'a aucun sens pour le rôle : elle est alors masquée.
2. Le verrouillage de l'éditeur passe par des surcouches. Aucune zone n'est retirée du DOM, car les onglets en dépendent.
3. Les restrictions de `reviewer` et `writer` sont **visuelles** pour l'instant. Le serveur ne les impose pas encore (voir 8.4). La maquette ne doit pas laisser croire à une sécurité qui n'existe pas.
4. Les icônes sont des icônes Lucide. Les couleurs viennent des tokens, voir [01-tokens.md](./01-tokens.md).

## 8. Points à valider

### 8.1 Écarts constatés dans la sidebar

- **Admin technique sans accès aux réglages.** L'entrée « Réglages » de la zone système ne teste que `isAdmin` et `isGroupAdmin`. Un `company_admin_tech` n'a donc aucun chemin vers les pages qui lui sont réservées. À corriger dans le code, ou à représenter ainsi dans la maquette si c'est voulu.
- **Liens morts pour l'admin technique.** « Général » et « Utilisateurs » s'affichent pour tout rôle qui entre dans les réglages, mais leurs pages exigent `company_admin` ou `super_admin`. Un admin technique serait redirigé.

### 8.2 Décisions produit ouvertes

- Gestion des dossiers par le rédacteur : aujourd'hui permise, seul le relecteur est restreint.
- Bloc code HTML : rangé avec la structure, donc refusé au rédacteur. À confirmer.
- Exports de la barre d'actions groupées : ouverts au relecteur, non tranché.
- Droits sur le contrôle qualité, les liens de partage et la génération IA : « à confirmer par tests fonctionnels et review » dans le plan.

### 8.3 Incohérence possible sur la génération IA

Le plan donne la configuration à `company_admin` et `company_admin_tech`. La page « AI features » n'est accessible qu'à `company_admin_tech` et `super_admin`. À vérifier côté code avant de maquetter l'écran.

### 8.4 Sécurité

Aucune restriction serveur pour `reviewer` et `writer` : l'API reste ouverte à qui l'appelle directement. Le correctif est suivi dans l'issue #1103.

## Sources

- `docs/plans/rbac-refonte.md`, sections 3.2, 3.2 bis, 3.3 et 3.4
- `packages/ui/components/sidebar/` (`bs-sidebar-system-zone.vue`, `context/bs-sidebar-settings-list.vue`, `context/bs-sidebar-workspace-tree.vue`)
- `packages/ui/helpers/roles.js`, `packages/ui/helpers/pages-acls.js`
- Commit `1c3359cc` (pastille de validation), commits `cd315fff`, `bdaefa47`, `a271a50e` (rôles, restrictions, écran super admins)
