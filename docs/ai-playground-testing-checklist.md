# Checklist de recette — AI Playground (PR2 `feat/ai-playground`)

> Recette manuelle du module playground et de ses points de contact avec
> `ai-skill`. Les tests automatisés du périmètre (93 tests) sont couverts par
> `npx jest tests/server/ai-playground tests/scripts` — cette checklist ne
> couvre que ce qu'ils ne peuvent pas voir : l'UI, la chaîne réelle vers le LLM
> et les invariants en base.
>
> Écarts déjà connus et volontairement hors recette : voir
> [REVIEW_GUIDE_AI_MODULES.md](./REVIEW_GUIDE_AI_MODULES.md) §3, §4, §6, §6bis.

---

## 0. Prérequis — fixtures (~20 min, une seule fois)

### 0.1 Group plateforme + moteur IA

- [ ] `/groups` → bouton « groupe plateforme » (ou `yarn flag-platform-group`)
- [ ] `/groups/:id/settings/integrations` → créer une Integration **type `ai`** avec une vraie clé API
- [ ] `/groups/:id/settings/ai-features` → section **Moteur des skills** : Integration + modèle
- [ ] Le sélecteur d'Integration ne propose **que** les intégrations `type=ai`
- [ ] Changer d'Integration remet `model` à `null` dans le même appel
- [ ] Le modèle par défaut du provider est nommé dans la liste

### 0.2 Migrations (base locale antérieure)

- [ ] `node scripts/migrate-playground-filter-categories.js`
- [ ] Si la base date d'avant PR1 : `migrate-version-major-minor`, `migrate-skill-schemas-to-version`, `migrate-expertise-scope-normalize`, `migrate-expertise-transversal`, `migrate-invocation-source`, `migrate-invocation-expires-at`

### 0.3 Skill de test

`/ai-skills` → onglet **Skills** → **Ajouter une skill**

| Champ                 | Valeur                        |
| --------------------- | ----------------------------- |
| Titre                 | `Texte générique`             |
| Description           | `Skill de recette playground` |
| Catégorie             | `Rédaction`                   |
| Identifiant (déplier) | forcer `generic.text`         |

- [ ] L'identifiant suit le titre tant qu'il n'est pas édité, puis se figle
- [ ] Redirection sur l'onglet **Versions**, v1.0 DRAFT dépliée, schémas pré-remplis (`genericTextInput` / `genericTextOutput`)

Remplir la v1.0 :

| Champ             | Valeur                                                            |
| ----------------- | ----------------------------------------------------------------- |
| System prompt     | `Tu es un rédacteur senior spécialisé en marketing par email.`    |
| Corps de la skill | `Rédige des textes courts, percutants, en français. Pas d'emoji.` |
| Modèle d'entrée   | voir bloc ci-dessous                                              |

```
Demande : {{input.prompt}}

Contexte : {{input.context}}

Doctrine à respecter :
{{input.expertise}}
```

- [ ] Le helper de placeholders liste `{{input.prompt}}` (astérisque = requis), `{{input.context}}`, `{{input.expertise}}`
- [ ] Cliquer une puce de placeholder **la copie** dans le presse-papier
- [ ] Ajouter `{{input.brandVoice}}` → **Enregistrer** → warning non bloquant
- [ ] **Publier** avec ce placeholder → refus, champ fautif nommé
- [ ] Le retirer, enregistrer, publier (changelog obligatoire) → skill `ACTIVE` en v1.0, v1.0 en lecture seule

Créer une **v2.0** avec le system prompt `Tu es un rédacteur senior. Réponds INTÉGRALEMENT EN MAJUSCULES.` puis la publier (sert au test d'épinglage §6).

- [ ] v1.0 passe `ARCHIVED`, la version active devient `2.0`

### 0.4 Trois expertises

`/ai-skills` → onglet **Expertises** → **Ajouter** (× 3)

| Champ         | E1                    | E2                               | E3                |
| ------------- | --------------------- | -------------------------------- | ----------------- |
| Titre         | `CTA promo — règles`  | `Voix de marque par défaut`      | `QC CTA — grille` |
| Catégorie     | Rédaction             | Rédaction                        | QC                |
| Transversale  | non                   | **oui**                          | non               |
| Périmètre     | `cta`                 | _(vide)_                         | `cta`             |
| Types d'email | `promo`               | _(vide)_                         | _(vide)_          |
| Langues       | `fr`                  | _(vide)_                         | _(vide)_          |
| Identifiant   | `redaction.cta.promo` | `redaction.brand-voice-defaults` | `qc.cta.grille`   |

Corps de version 1.0, puis activation :

- E1 : `Commence toujours le CTA par un verbe à l'infinitif.`
- E2 : `Ton tutoyant, phrases de moins de 12 mots.`
- E3 : `Vérifie la présence d'un bénéfice client dans le CTA.`

- [ ] Saisir `CTA` en majuscules matche `cta` à la lecture (normalisation des périmètres)
- [ ] Le sélecteur de langues est recherchable
- [ ] Les types d'email s'affichent traduits, pas en brut

---

## 1. Création d'un scénario

`/ai-playground` → **Nouveau scénario**

- [ ] Liste vide → empty state « Créez un scénario pour tester une skill… »
- [ ] Un **seul** bouton « Nouveau scénario »

| Section               | Champ                    | Valeur                                               |
| --------------------- | ------------------------ | ---------------------------------------------------- |
| —                     | Nom \*                   | `Recette — CTA promo`                                |
| —                     | Identifiant technique    | auto : `recette-cta-promo`                           |
| —                     | Description              | `Scénario de recette PR2`                            |
| —                     | Tags                     | `recette` + Entrée, `pr2` + Entrée                   |
| Skill à invoquer      | Skill cible              | `Texte générique`                                    |
|                       | Version                  | `Suivre l'active`                                    |
| Expertises            | Mode                     | `Aucune`                                             |
| Contenu de la demande | Instruction / demande \* | `Rédige un CTA pour une promo -20 % sur les vestes.` |
|                       | Contexte additionnel     | `Marque jeune, audience 25-35 ans.`                  |

- [ ] Seules les skills **ACTIVE** sont proposées
- [ ] Le slug suit le nom, puis se figle après édition manuelle
- [ ] Mode `Aucune` → alerte info non bloquante
- [ ] Le formulaire d'input expose **exactement** `Instruction / demande` (\*) et `Contexte additionnel` — jamais `expertise`
- [ ] Vider le nom, puis l'instruction → **Créer** se désactive
- [ ] **Créer** → snackbar + redirection sur le détail

---

## 2. Premier run

- [ ] **Enregistrer** et **Exécuter** sont sur la même ligne
- [ ] Exécution → « Invocation en cours, peut prendre jusqu'à 90 secondes… »
      (le timeout du playground est `PlaygroundTimeoutMs` = 90 s, pas le défaut
      user-facing de 30 s d'`invoke()`)
- [ ] Carte résultat : statut **Succès**, latence, tokens
- [ ] Historique : 1 ligne (Quand / Statut / Latence / Tokens / Référence / Feedback)
- [ ] Modale run : onglets **Output**, **Input**, **Output (JSON)**, **Feedback**
- [ ] Onglet **Input** : `composedInput` = `{ prompt, context }` — **sans clé `expertise`**
- [ ] Onglet Output : rendu markdown lisible

**Execute-saves-first** (commit `fd48fca8`) :

- [ ] Modifier l'instruction **sans enregistrer** → Exécuter → l'onglet Input du nouveau run porte la nouvelle valeur
- [ ] Recharger la page → la saisie est persistée

---

## 3. Modes d'expertise

### 3a. Sélection explicite

- [ ] Picker : section « Recommandées pour cette skill » (E1, E2) puis « Toutes les expertises » (E3)
- [ ] Sélectionner E1 puis E2 → liste numérotée avec flèches ↑↓
- [ ] Flèche ↑ sur E2 → E2 passe en 1
- [ ] Enregistrer + Exécuter → onglet Input : `expertise` = 2 entrées, **E2 en premier**
- [ ] La sortie porte la trace des deux doctrines

### 3b. Filtre dynamique — table de vérité du preview

- [ ] `Catégories` se pré-remplit avec la catégorie de la skill
- [ ] Idem en choisissant **le mode avant la skill** (les deux ordres de saisie)

| Catégories | Périmètre | Type d'email | Langue | Preview attendu                         | Qui remonte                                    |
| ---------- | --------- | ------------ | ------ | --------------------------------------- | ---------------------------------------------- |
| Rédaction  | _(vide)_  | —            | —      | « Sélectionnez un périmètre »           | —                                              |
| _(vide)_   | cta       | —            | —      | « Sélectionnez au moins une catégorie » | —                                              |
| Rédaction  | cta       | —            | —      | **2**                                   | E2 (transversale) puis E1                      |
| Rédaction  | cta       | promo        | fr     | **2**                                   | E1 + E2                                        |
| Rédaction  | cta       | newsletter   | —      | **1**                                   | E2 seule                                       |
| Rédaction  | cta       | —            | en     | **1**                                   | E2 seule                                       |
| QC         | cta       | —            | —      | **1**                                   | E3 seule (E2 transversale mais hors catégorie) |
| Rédaction  | `zzz`     | —            | —      | **1**                                   | E2 + warning dans les logs serveur             |

- [ ] Le compteur se rafraîchit à chaque changement (pas seulement au blur), sans 400 ni 304 figé
- [ ] Enregistrer + Exécuter → `resolvedExpertise` du run = le compte du preview, E2 en premier

### 3c. Cas limites — non-régression sur la perte de saisie

- [ ] Mode filtre, **catégorie remplie, périmètre vide** → enregistrer →
      recharger → le mode rouvre sur **`Filtre dynamique`**, la catégorie est
      toujours là, et un second enregistrement ne l'efface pas
- [ ] Scénario à 4 expertises explicites sur une skill **sans champ
      `expertise`** → ouvrir le détail, ne toucher à rien, **Exécuter** (qui
      enregistre) → les 4 expertises sont **toujours là**, une alerte explique
      qu'elles ne seront pas injectées
- [ ] Basculer le mode à la main (`Explicite` → `Filtre`) efface bien l'autre
      champ : le reset est lié à l'action, pas au chargement
- [ ] Passer de `Filtre dynamique` à un autre mode puis revenir : les champs
      Catégories / Périmètre / Type d'email / Langue **s'affichent** (le mode
      filtre ne rendait rien du tout avant le correctif R-01)
- [ ] Taper vite dans `Périmètre` : le compteur affiche « Comptage… » puis **le
      résultat de la dernière saisie**, pas celui d'une réponse en retard

---

## 4. Formulaire d'input / JSON / changement de skill

- [ ] Bascule **Mode avancé (JSON)** → JSON fidèle à la saisie
- [ ] Retour **Formulaire** → aucune perte
- [ ] Ajouter `"brandVoice": "test"` en JSON → le warning « champs ne
      correspondant pas au schéma » s'affiche **dès le mode JSON**, sans
      attendre le retour au Formulaire
- [ ] Ajouter `"expertise": []` en JSON → message **dédié** (« injecté
      automatiquement, votre saisie sera écrasée »), et **pas** compté comme
      champ inconnu
- [ ] Exécuter avec ce champ → run `Erreur de validation`, message par champ
- [ ] JSON cassé (`{`) → « JSON invalide » + Exécuter désactivé
- [ ] **Insérer le gabarit** → squelette dérivé du schéma
- [ ] Vider `Instruction / demande` + Exécuter → erreur **sous le bon champ** ;
      en base `errorMessage` = le message zod brut et `fieldErrors` =
      `[{ field: 'prompt', issue: 'required' }]` (le libellé vient des locales)
- [ ] Ce run raté **ne consomme pas** de budget : le compteur affiché ne bouge
      pas (aucun appel provider n'a eu lieu)
- [ ] Rouvrir ce run plus tard → la modale affiche **la même erreur traduite**,
      pas seulement le message brut
- [ ] Changer de skill avec des champs saisis → modale « Changer de skill ? » → tester **Garder mes saisies (JSON)** et **Continuer (champs supprimés)**

---

## 5. Runs, feedback, référence, comparaison

- [ ] Feedback (Positive / 4 / commentaire) → **Enregistrer le feedback** → persistant après F5
- [ ] **Marquer comme référence** run A → étoile sur la ligne + sur la liste des scénarios
- [ ] Marquer le run B → **A est démarqué automatiquement** (un seul golden par scénario)
- [ ] **Comparer avec la référence** → vue côte à côte Référence / Run sélectionné
- [ ] Démarquer puis comparer → « Aucune référence définie », pas d'erreur
- [ ] Action ⋮ **Supprimer ce run** sur une ligne d'historique → confirmation →
      le run disparaît ; supprimer le golden retire aussi l'étoile du scénario
- [ ] Supprimer le scénario → confirmation → runs supprimés en cascade

---

## 6. Versions épinglées

- [ ] Mode `Suivre l'active` → Exécuter → sortie **EN MAJUSCULES** (v2.0)
- [ ] `Version figée` → le sélecteur liste toutes les versions avec leur statut (DRAFT/ARCHIVED comprises)
- [ ] Épingler `v1.0 (ARCHIVED)` → Exécuter → sortie **en casse normale** (preuve que la version épinglée tourne réellement)
- [ ] Le run affiche `generic.text v1.0`
- [ ] Épingler une version DRAFT puis la supprimer → Exécuter → **404 explicite**, pas de 500
- [ ] Liste : colonne Skill = `generic.text v1.0` en figé, `generic.text` en actif

---

## 6 bis. Skill archivée — échec tôt à l'exécution, tolérance à l'édition

- [ ] Archiver la skill du scénario, puis **Exécuter** → refus **immédiat**
      (400, la skill n'est pas ACTIVE), **aucun run créé** et **aucun budget
      consommé**
- [ ] Sur le même scénario, **renommer** puis Enregistrer → **ça passe** (avant,
      tout PATCH répondait 400 et seule la suppression fonctionnait)
- [ ] Le picker de skill affiche toujours la skill référencée, avec un badge de
      statut `ARCHIVED`, et permet d'en choisir une autre
- [ ] Choisir une skill non-ACTIVE dans le picker → refus (400)

---

## 7. Erreurs et budget

- [ ] **CONFIG_ERROR** : désactiver le moteur Skills → Exécuter → statut `Erreur de configuration`
- [ ] **Pas de Group plateforme** : retirer `isPlatform` en base → 400 avec message d'aide, pas de 500
- [ ] **PROVIDER_ERROR** : clé API bidon → statut `Erreur provider`, **aucun détail upstream** dans l'UI (modèle, hôte d'API) ; détail dans `AISkillInvocation.error`
- [ ] **Skill sans version active** : archiver toutes les versions → 400 « has no active version »
- [ ] **429** : passer `MaxDailyPlaygroundRuns` à 2 dans `playground-constants.js`, redémarrer, 3 runs → message de budget

---

## 8. Liste et filtres

- [ ] Recherche **live** (debounce 300 ms), sans Entrée ni blur
- [ ] Filtre Skill et filtre Tag (facettes), cumulables avec la recherche
- [ ] Colonnes : Runs, Dernier run (`BsTimestamp`), Statut, Référence (étoile + tooltip), Mis à jour le

---

## 9. Vérifications en base (mongo)

```js
// Un seul golden par scénario
db.aiplaygroundruns.find({ isGolden: true }, { _scenario: 1 });

// Golden jamais purgé, rétention 365 j sur les autres
db.aiplaygroundruns.find({}, { isGolden: 1, expiresAt: 1, createdAt: 1 });

// Runs playground typés non productifs
db.aiskillinvocations.find({ invocationSource: 'playground' }).count();

// Traçabilité
db.aiplaygroundscenarios.find({}, { scenarioId: 1, owner: 1, createdBy: 1 });
```

- [ ] `isGolden: true` ⇒ `expiresAt: null`
- [ ] Démarquer un golden ⇒ `expiresAt` recalculé depuis `createdAt`
- [ ] `fieldErrors` présent sur un run en `VALIDATION_ERROR`, sous forme de
      codes (`{ field, issue }`), sans phrase française
- [ ] `owner` / `createdBy` / `feedback.ratedBy` sont **`null`** : c'est le
      comportement attendu tant que le super-admin est un pseudo-compte sans
      ligne `users` — cf. [issue #1086](https://github.com/Badsender-com/LePatron.email/issues/1086)
- [ ] `?status[$ne]=` sur `/runs` répond **400**, pas 500
- [ ] Un `:runId` qui n'est pas un ObjectId répond **400**, pas 500

---

## 10. Analytics et i18n

- [ ] Onglet **Invocations** de la skill : les runs playground **absents** par défaut
- [ ] Switch « Inclure les invocations non productives » → ils apparaissent **et les stats changent**
- [ ] Tri et pagination côté serveur
- [ ] « Tester dans le playground » depuis le header de la skill → `/ai-playground/new?skillId=…` pré-rempli
- [ ] Refaire l'étape 1 en **anglais** → aucune clé brute affichée

---

## Historique des passes de recette

| Date       | Périmètre                                       | Retours                                                                                                              |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 2026-08-24 | §1 à §8 et §10 (§9 non joué), fixtures créées   | 8 retours (R-01 → R-08) — [commentaire de la PR #1076](https://github.com/Badsender-com/LePatron.email/pull/1076)    |
| _à jouer_  | Repasse complète après les correctifs de review | §3c, §4, §6 bis et §9 sont neufs ou modifiés — R-06 et R-07 doivent être **rejoués** maintenant que R-01 est corrigé |

Les retours de recette vivent dans les commentaires de PR, pas dans ce fichier :
la checklist doit rester rejouable à l'identique d'une passe à l'autre.
