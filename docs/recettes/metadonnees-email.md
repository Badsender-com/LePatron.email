# Recette — Métadonnées email (PR #1081 · #1083 · #1085)

Guide de recette manuelle de la phase 1 « métadonnées email ». Il couvre les trois
PR empilées, plus les deux PR extraites qui doivent être vérifiées **avant** elles.

| PR    | Sujet                                                     | Base      |
| ----- | --------------------------------------------------------- | --------- |
| #1106 | Échappement du bloc `script` de l'éditeur                 | `develop` |
| #1107 | Appariement label/champ des composants de formulaire      | `develop` |
| #1081 | Couche serveur : métadonnées du mailing, schéma taxonomie | `develop` |
| #1083 | CRUD des typologies + écrans de réglages                  | #1081     |
| #1085 | Section « Paramètres de l'email » dans l'éditeur          | #1083     |

---

## 0. Préparation

### Environnement

LePatron exige **Node 18.18.0**. Le `default` de nvm peut être une autre version :

```bash
nvm use 18.18.0 && node -v   # doit afficher v18.18.0
```

Mongo de dev : conteneur `lepatron_mongo_container`, base `lepatron`, **port 27019**.

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep mongo
```

### Sauvegarde avant toute écriture en base

**À faire systématiquement.** La recette écrit dans `creations`, `companies`,
`taxonomyitems` et `workspaces`.

```bash
docker exec lepatron_mongo_container mongodump --port 27019 --db lepatron \
  --out /tmp/recette-$(date +%F_%H-%M)
```

Restauration si besoin :

```bash
docker exec lepatron_mongo_container mongorestore --port 27019 --drop \
  --db lepatron /tmp/recette-AAAA-MM-JJ_HH-MM/lepatron
```

> `mongodump` n'exclut aucun champ, donc `mongorestore` n'en détruit aucun. Un
> script maison qui excluait les credentials du dump a effacé tous les hash de
> mots de passe de cette base le 2026-08-29 : la restauration remplaçait les
> collections entières, et ce qui n'était pas dans le dump disparaissait.

### Lancement

```bash
yarn dev
```

Attendre `worker <pid> started.` puis `DB Connection open`, **sans**
`UNCAUGHT EXCEPTION`. Un `EADDRINUSE` sur le port 3000 signifie qu'un serveur
tourne déjà :

```bash
ss -lptn 'sport = :3000'
```

### Jeu de données

| Company             | Flag `emailMetadata` | Usage                   |
| ------------------- | -------------------- | ----------------------- |
| **Test Group Main** | activé               | parcours nominal        |
| **Test Group**      | désactivé            | vérification du opt-out |
| **Demo company**    | désactivé            | idem                    |

Typologies configurées sur « Test Group Main » : **Infolettre** (`newsletter`),
**Promotion** (`promo`), **Marketing automation** (`marketing-automation`).

---

## A. #1106 — Échappement du bloc `script`

**Ce qui est corrigé** : le payload de l'éditeur est sérialisé dans un bloc
`script` via l'interpolation non échappée de Pug. Une chaîne contenant une balise
de fermeture de script en sortait et s'exécutait sur l'origine de l'application.

1. Renommer un email avec un nom contenant une balise de fermeture de script
   suivie d'un `alert(1)` dans une balise ouvrante.
2. Ouvrir cet email dans l'éditeur.
3. **Attendu** : l'éditeur s'ouvre normalement, aucune boîte de dialogue, aucune
   erreur en console. Le nom s'affiche tel quel dans la barre du haut.
4. **Attendu, source de la page** : la chaîne apparaît échappée en séquences
   unicode dans `var initOptions = …`.

> Sans le correctif, l'`alert` se déclenche. À tester sur `develop` d'abord si
> vous voulez voir la différence.

---

## B. #1107 — Labels des composants de formulaire

**Ce qui est corrigé** : `bs-text-field`, `bs-select` et `bs-textarea` rendaient un
label sans `for` et un champ sans `id`.

1. Ouvrir **Paramètres → Général → Email types** (EN) / **Typologies** (FR), créer
   une typologie.
2. **Cliquer sur le libellé « Libellé »** (pas sur le champ). **Attendu** : le
   curseur se place dans le champ. Idem pour « Définition », « Ordre » et
   « Typologie IA correspondante ».
3. Ouvrir **Paramètres → Utilisateurs**, éditer un utilisateur. **Attendu** : les
   champs fonctionnent comme avant — c'est le cas de non-régression, ce formulaire
   passe ses propres `id`.
4. Ouvrir un écran **AI Skills** avec un textarea. **Attendu** : rien n'a changé.

---

## C. #1081 — Couche serveur

Rien à cliquer : cette PR n'a pas d'interface. Elle se vérifie par l'API.

1. **Le flag protège l'écriture.** Sur une company **désactivée**, un `PATCH` sur
   `/api/mailings/<id>/metadata` doit répondre **403**.
2. **Les clés inconnues sont refusées.** Un `PATCH` portant une clé qui n'existe
   pas doit répondre **422**, pas 200. Le corps accepte exactement trois clés :
   `subject`, `plannedSendDate`, `emailTypeId` — les mêmes noms que la réponse.
   `_emailType`, l'ancien nom, doit désormais être refusé comme n'importe quelle
   clé inconnue.
3. **La date est normalisée.** Envoyer une date à n'importe quelle heure, relire en
   base : elle doit être stockée à **12:00:00.000Z**, quelle que soit l'heure
   envoyée.
4. **Une typologie d'une autre company est refusée.** Envoyer l'identifiant d'une
   typologie appartenant à une autre company : **404**, identique à une typologie
   inexistante — aucun canal d'énumération.

---

## D. #1083 — Typologies et réglages

### D1. L'écran de réglages

1. **Paramètres → Email Builder → Configuration** : l'interrupteur des métadonnées
   est présent et reflète l'état de la company.
2. Le désactiver puis l'enregistrer : **attendu**, la liste des typologies reste
   accessible (elle n'est pas gouvernée par le flag).
3. Le réactiver.

### D2. CRUD des typologies

1. **Paramètres → Général → Typologies**. Créer une typologie : libellé,
   définition, correspondance IA, ordre.
2. **Attendu dans le select « Typologie IA correspondante »** : quatre choix —
   Promotionnel, Infolettre, Transactionnel, **Marketing Automation**.
3. Modifier, réordonner, désactiver. **Attendu** : une typologie désactivée
   disparaît des sélecteurs mais reste dans l'écran d'administration.
4. Tenter de créer un doublon de libellé. **Attendu** : l'erreur s'affiche **sous
   le champ**, pas dans un bandeau en bas d'écran.
5. Tenter de supprimer une typologie utilisée par un email. **Attendu** : refus,
   avec le nombre d'emails concernés.

### D3. État d'erreur de chargement

**Le cas à ne pas rater** : il ne se produit pas tout seul.

1. Couper le serveur (`Ctrl+C` sur `yarn dev`) pendant que l'écran Typologies est
   ouvert, puis recharger la page — ou bloquer la requête dans l'onglet Réseau.
2. **Attendu** : un message d'erreur avec un bouton **Réessayer**.
3. **À ne surtout PAS voir** : « Aucune typologie pour le moment » avec un bouton
   de création — c'est ce que l'écran affichait avant, et il invitait à recréer une
   liste que personne n'avait su lire.
4. Relancer le serveur, cliquer **Réessayer**. **Attendu** : la liste s'affiche.

### D4. Vocabulaire

1. Passer l'interface en **anglais**. **Attendu** : « Email types » partout —
   entrée de sidebar, titre, formulaire, états vides, erreurs. **Aucun**
   « Typology ».
2. Repasser en **français**. **Attendu** : « Typologie » / « Typologies ».
3. Dans l'écran des **expertises IA**, le filtre par type propose bien
   **Marketing Automation**.

---

## E. #1085 — Section « Paramètres de l'email »

### E1. Présence et emplacement

1. Ouvrir un email de **Test Group Main**, onglet **Contenu**, aucun bloc
   sélectionné.
2. **Attendu** : deux bandeaux qui se suivent et se lisent comme un seul panneau —
   « Template Options » puis « Paramètres de l'email ». **Même taille de texte,
   même hauteur de bandeau, même filet bleu à gauche.**
3. **Attendu** : trois champs — Objet, Date d'envoi prévue, Typologie. **Aucune
   phrase d'explication sous les champs, aucun compteur de caractères.**
4. **Attendu** : aucun bouton d'enregistrement dans la section.

### E2. Enregistrement et pastille

1. Saisir un objet. **Attendu** : une **pastille** apparaît sur le bouton Save en
   haut à droite.
2. **Survoler le bouton Save.** **Attendu** : la pastille reste nettement visible —
   le bouton change de couleur au survol, et c'est le cas où l'anneau disparaissait.
3. Cliquer **Save**. **Attendu** : message de succès, la pastille s'éteint.
4. Recharger la page. **Attendu** : l'objet est là.

### E3. Le cas critique — échec des métadonnées

**Le plus important de cette recette.** Il vérifie qu'un échec côté métadonnées ne
prend plus le contenu de l'email en otage.

1. Ouvrir un email, **modifier du contenu** (un bloc, un texte) **et** l'objet.
2. Dans un autre onglet, **désactiver le flag** de la company
   (Paramètres → Email Builder → Configuration).
3. Revenir à l'éditeur, cliquer **Save**.
4. **Attendu** : un message d'erreur nommant le problème de métadonnées, **et
   l'email lui-même est enregistré**. La pastille **reste allumée**.
5. Recharger. **Attendu** : les modifications de contenu sont là.
6. **À ne surtout PAS voir** : un email qu'on ne peut plus jamais enregistrer,
   chaque clic échouant à l'identique.
7. Réactiver le flag, re-sauvegarder : l'objet passe, la pastille s'éteint.

### E4. Course frappe / enregistrement

1. Saisir un objet, cliquer **Save**, puis **continuer à taper immédiatement**
   pendant que la requête part.
2. **Attendu** : la pastille **reste allumée** après la réponse — la frappe faite
   pendant la requête n'a pas été envoyée et est signalée comme telle.
3. Re-cliquer Save, recharger. **Attendu** : la dernière version saisie est en base.

### E5. Date d'envoi prévue

1. Saisir une date, enregistrer, recharger. **Attendu** : la **même** date.
2. Vérifier en base : stockée à **12:00:00.000Z**.

```bash
docker exec lepatron_mongo_container mongo --quiet --port 27019 lepatron --eval \
  'var m = db.creations.findOne({_id: ObjectId("<id>")}, {plannedSendDate:1});
   print(m.plannedSendDate.toISOString());'
```

> Midi UTC, pas minuit : une date est un **jour**, pas un instant. Minuit UTC est
> la veille pour tout le monde à l'ouest de Greenwich, et midi _local_ décale d'un
> jour entre deux collègues de fuseaux différents.

### E6. Typologie

1. Le select propose les typologies **actives** de la company, plus « Aucune ».
2. Sélectionner, enregistrer, recharger. **Attendu** : conservée.
3. **Typologie retirée** : désactiver dans les réglages une typologie portée par un
   email, rouvrir cet email. **Attendu** : le select affiche « Typologie
   désactivée » — l'email ne perd pas silencieusement sa typologie.

### E7. Company sans typologie configurée

1. Désactiver **toutes** les typologies de la company.
2. Ouvrir un email. **Attendu** : le select est vide et désactivé, **et une aide
   indique où les créer**. C'est la seule aide conservée sous un champ, et c'est
   volontaire : sans elle, l'utilisateur voit un champ mort sans savoir quoi faire.

### E8. Company sans le flag — non-régression

1. Ouvrir un email de **Test Group** ou **Demo company**.
2. **Attendu** : **aucune** section « Paramètres de l'email ». L'onglet Contenu est
   celui d'avant.
3. Modifier du contenu, enregistrer. **Attendu** : fonctionne normalement, aucune
   pastille, aucune requête vers `/metadata` dans l'onglet Réseau.

### E9. Bloc sélectionné

1. Sélectionner un bloc dans l'email.
2. **Attendu, conséquence assumée** : les options du bloc occupent le haut du
   panneau et « Paramètres de l'email » passe derrière un défilement. Elle doit
   rester **atteignable**.

---

## F. Accessibilité

1. **Au clavier seul**, dans la section de l'éditeur : `Tab` atteint les trois
   champs dans l'ordre, chacun avec un anneau de focus **visible**.
2. Cliquer sur le libellé d'un champ place le curseur dedans.
3. Avec un lecteur d'écran, chaque champ est annoncé **avec son nom**.

---

## Ce qui n'est pas dans cette phase

À ne pas signaler comme manquant :

- **Le preheader** reste dans les options du template, il n'est pas une métadonnée.
- **Aucun champ n'est obligatoire** — `requiredFields` est stocké mais rien ne
  l'applique. Aucun astérisque ne doit apparaître.
- **Pas d'écran de listing ni de modale de création** portant les métadonnées :
  c'est la PR4.
- **Pas de filtre ni de tri** par typologie ou par date d'envoi dans le listing.
- **Langue, marque, libellé expéditeur, nom de campagne** : reportés.
