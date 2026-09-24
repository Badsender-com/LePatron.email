# Recette — Métadonnées email (PR #1081 · #1083 · #1085, puis vocabulaire Badsender)

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
3. Dans l'écran des **expertises IA**, le filtre par type propose les **six**
   types Badsender : Éditorial, Promotionnel, Serviciel, Suivi, Transactionnel,
   Institutionnel. **Aucun** « Newsletter », « Promo » ni « Marketing Automation »
   — sauf en valeur héritée, cf. D6.

### D5. Typologies par défaut — le seed

1. En **super admin**, interface en **français**, créer une company — depuis la
   liste des companies **et** depuis `/groups/new`, les deux écrans créent.
   Réglages → Général → Typologies. **Attendu** : les **six** typologies
   Badsender, dans l'ordre, en français (Éditorial → Institutionnel), chacune
   avec sa définition et sa correspondance IA.
2. Recommencer avec l'interface en **anglais**. **Attendu** : les mêmes six, en
   anglais (Editorial → Institutional). C'est la langue de l'**interface** qui
   compte : la session super admin n'a pas de langue à elle, et sans ce que
   l'écran envoie toutes les companies démarraient en anglais.
3. Renommer une typologie, en désactiver une, en supprimer une. **Attendu** :
   ce sont des typologies ordinaires, rien ne les protège.

### D5 bis. Le bouton « Typologies par défaut »

Le seed automatique ne tourne qu'à la création d'une company. Ce bouton est ce qui
rattrape les companies plus anciennes, et répare une suppression.

1. Sur une company **sans aucune typologie**, ouvrir Réglages → Général →
   Typologies. **Attendu** : le bouton est présent **deux fois** — dans l'en-tête
   de page, et dans l'état vide à côté de « Créer une typologie ».
2. Cliquer. **Attendu** : une modale **nomme** les six typologies qui vont être
   créées, dans la langue de l'interface. Valider. **Attendu** : elles
   apparaissent, et un message dit combien ont été créées.
3. **Recliquer.** **Attendu** : la modale dit qu'il n'y a rien à ajouter, et le
   bouton de validation **disparaît** — on ne valide pas une action sans effet.
4. **Réparation d'une suppression** : supprimer « Serviciel », recliquer.
   **Attendu** : seule celle-là est proposée, et elle revient **à sa place dans
   l'ordre** (3ᵉ), pas à la fin.
5. **Typologie renommée** : renommer « Éditorial » en « Contenu de marque » en
   **gardant** la correspondance IA `editorial`, recliquer. **Attendu** : elle
   n'est **pas** recréée. C'est la correspondance qui fait foi, pas le libellé —
   l'outil ne défait pas le travail de l'admin.
6. **Libellé déjà pris** : créer à la main une typologie nommée « Suivi » **sans**
   correspondance IA, recliquer. **Attendu** : la modale signale que « Suivi » ne
   sera pas créée, son libellé étant déjà utilisé, et crée les autres. Pas de
   « Suivi (2) ».
7. **Cloisonnement** : en tant qu'admin d'une company, appeler
   `GET /api/taxonomy-items/default-email-types?groupId=<autre company>`.
   **Attendu** : **403**. Idem sur le POST avec un `groupId` étranger dans le corps.

### D5 ter. Le script, pour traiter tout le parc d'un coup

1. En lecture seule d'abord :

   ```bash
   node scripts/seed-default-email-types.js --dry-run --lang=fr
   ```

   **Attendu** : il liste les companies sans aucune typologie, et compte les
   autres en « already had their own ». Puis l'exécuter pour de vrai, et le
   relancer : **le second passage ne fait rien**.

2. Sur une company qui a **déjà** des typologies créées à la main, vérifier
   qu'elle est laissée **intacte** — ni complétée, ni dupliquée.

   C'est là que le script et le bouton **diffèrent volontairement** : le script
   balaie tout le parc sans que personne regarde, donc il renonce dès qu'une
   typologie existe ; le bouton est réclamé explicitement par quelqu'un qui a la
   liste sous les yeux, donc il complète. Sur une company vide, les deux font
   exactement la même chose.

### D6. Expertises IA taguées avec l'ancien vocabulaire

Le changement de vocabulaire **n'a pas été migré**, c'est un choix. Conséquence à
vérifier, et à traiter **avant la mise en production** :

1. Lister les expertises concernées :

   ```bash
   node scripts/report-legacy-expertise-email-types.js
   ```

   Il affiche chaque expertise dont le champ « types d'email » porte `promo`,
   `newsletter` ou `marketing-automation`, avec la valeur à mettre à la place, et
   sort en code 1 tant qu'il en reste. Lecture seule.

2. **Attendu** : ces valeurs restent **visibles et sélectionnables** dans le
   combobox, affichées telles quelles (non traduites). C'est ce qui rend le
   retagage possible depuis l'écran.
3. **Attendu, et c'est le piège** : tant qu'elles ne sont pas retaguées, ces
   expertises **ne se chargent plus** pour un email dont la typologie pointe vers
   le nouveau vocabulaire — silencieusement, le filtre étant une égalité de
   chaîne. Les retaguer sur le type Badsender correspondant.
4. Relancer le script. **Attendu** : « No expertise tagged with the retired
   vocabulary. », code de sortie 0.

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

### E2. Enregistrement

1. Saisir un objet, cliquer **Save**. **Attendu** : message de succès.
2. Recharger la page. **Attendu** : l'objet est là.
3. Modifier **un bloc** de l'email **et** l'objet, cliquer **Save**, recharger.
   **Attendu** : les deux sont enregistrés.

> Il n'y a **aucun indicateur visuel** de modification non enregistrée, ni pour les
> métadonnées ni pour le contenu. C'est volontaire : un signal qui ne couvrirait
> que les métadonnées mentirait par omission sur tout le reste de l'éditeur. La
> seule exception est la confirmation à la fermeture de l'onglet (§E3 ter), qui ne
> ment sur rien parce qu'elle n'affirme rien tant qu'elle ne se déclenche pas.

### E3. Le cas critique — échec des métadonnées

**Le plus important de cette recette.** Il vérifie qu'un échec côté métadonnées ne
prend plus le contenu de l'email en otage.

1. Ouvrir un email, **modifier du contenu** (un bloc, un texte) **et** l'objet.
2. Dans un autre onglet, **désactiver le flag** de la company
   (Paramètres → Email Builder → Configuration).
3. Revenir à l'éditeur, cliquer **Save**.
4. **Attendu** : un message d'avertissement qui dit les **deux** choses —
   « L'email a été sauvegardé, mais les paramètres de l'email n'ont pas pu être
   enregistrés : <raison> ». Pas de message de succès seul, et pas d'erreur seule
   non plus : le contenu EST passé, et ne pas le dire pousse l'utilisateur à
   recliquer Save, ce qui rejoue exactement le même échec.
5. Recharger. **Attendu** : les modifications de contenu sont là. L'objet, non.
6. **À ne surtout PAS voir** : un email qu'on ne peut plus jamais enregistrer,
   chaque clic échouant à l'identique.
7. Réactiver le flag, rouvrir l'email, resaisir l'objet, **Save**, recharger.
   **Attendu** : l'objet est enregistré.
8. **Les deux en échec** : couper le réseau et cliquer **Save**. **Attendu** :
   deux messages — celui des métadonnées, puis l'erreur d'enregistrement
   générique. Le message générique seul ne dirait rien d'une typologie retirée.

### E3 bis. Le PATCH ne porte que ce qui a changé

Ce que ça évite : deux personnes ouvrent le même email ; celle qui ne touche
qu'à la typologie renvoyait aussi l'objet **tel qu'il était à SON ouverture**, et
effaçait la modification de l'autre sans conflit ni message.

1. Ouvrir le même email dans **deux onglets** (A et B).
2. Dans A, modifier **l'objet**, **Save**.
3. Dans B — ouvert avant, donc porteur de l'ancien objet — modifier **uniquement
   la typologie**, **Save**.
4. Recharger. **Attendu** : la typologie de B **et** l'objet de A. B n'a pas
   renvoyé l'objet.
5. Variante à vérifier aussi : un email dont la typologie a été **supprimée** en
   base. Modifier **uniquement l'objet**, **Save**. **Attendu** : l'objet est
   enregistré — la typologie périmée ne part pas dans la requête, donc elle ne
   peut plus faire échouer un champ que l'utilisateur n'a pas touché.

### E3 ter. Fermeture avec des métadonnées non enregistrées

1. Modifier l'objet, **sans enregistrer**, fermer l'onglet (ou recharger).
   **Attendu** : le navigateur demande confirmation.
2. Enregistrer, puis fermer l'onglet. **Attendu** : **aucune** confirmation.
3. Ne rien modifier du tout et fermer. **Attendu** : aucune confirmation.

> C'est une confirmation **à la sortie**, pas un indicateur permanent. La pastille
> sur le bouton Save a été retirée volontairement parce qu'elle couvrait les
> métadonnées et rien d'autre ; celle-ci ne se déclenche que quand les trois
> champs sont réellement modifiés, et se tait le reste du temps.

### E4. Course frappe / enregistrement

1. Saisir un objet, cliquer **Save**, puis **continuer à taper immédiatement**
   pendant que la requête part.
2. Attendre la fin de la requête, **sans rien faire d'autre**. Recharger.
   **Attendu** : la base porte l'objet **tel qu'il était au moment du clic** — la
   frappe suivante n'a pas été envoyée, ce qui est normal.
3. Re-cliquer **Save**, recharger. **Attendu** : la dernière version saisie est en
   base. C'est l'étape qui compte : si l'état modifié n'avait pas survécu à la
   première sauvegarde, ce second Save n'aurait rien envoyé et la correction
   serait perdue.

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
3. Modifier du contenu, enregistrer. **Attendu** : fonctionne normalement, et
   **aucune requête vers `/metadata`** dans l'onglet Réseau.

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
