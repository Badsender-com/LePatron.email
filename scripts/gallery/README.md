# Rattrapage des dimensions et des dates de la galerie

`scripts/backfill-gallery-metadata.js` donne aux images des galeries, là où ils manquent, leurs dimensions (`width`, `height`) et leur date d'arrivée (`uploadedAt`). Les deux viennent du stockage (S3 ou disque local), jamais d'une valeur inventée.

## À ne lancer qu'une fois #1293 déployée

Le script écrit des champs (`uploadedAt`, `width`, `height`) que seul le code de #1293 conserve. Avant #1293, et après un éventuel retour en arrière, la duplication d'un email (`GallerySchema.methods.duplicate`) relit les images à travers l'ancien getter, qui ne garde que `name`, `url`, `deleteUrl` et `thumbnailUrl` : la galerie de la copie perd ces champs (et `originalName`). La duplication réussit, mais la copie retombe sans dimensions ni date, et seule une nouvelle run du script les rattrape.

Donc : **déployer #1293, puis lancer le script ; ne plus revenir en arrière sur #1293 ensuite.** Le script ne peut pas le vérifier lui-même : rien dans la base ne dit quelle version de l'application tourne, et le code qu'il charge contient toujours #1293, puisqu'il en dépend.

## Ce qu'il écrit

| Champ             | Source                                                                                | Écrit si                       |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| `width`, `height` | l'en-tête du fichier (128 Ko, jusqu'à 4 Mo pour un JPEG aux métadonnées volumineuses) | l'un des deux manque ou vaut 0 |
| `uploadedAt`      | la date du stockage : `Last-Modified` de l'objet S3, `mtime` du fichier sur disque    | absent ou `null`               |

La date du stockage est celle de la dernière écriture du fichier : l'upload, ou la copie quand l'email a été dupliqué, c'est-à-dire le moment où l'image est arrivée dans cette galerie. Elle vient de la réponse à la lecture du fichier (pas de requête en plus) ; une image dont les dimensions sont déjà connues n'est lue que le temps d'obtenir cette date. Un stockage qui ne donne pas de date, ou une date illisible : l'image reste sans date (`Date not found`).

Les autres champs V1 (`label`, `source`, `externalMetadata`) n'ont pas besoin d'être écrits : depuis #1293, le getter du schéma leur donne leur valeur par défaut (le nom du fichier, `upload`, `{}`), et c'est la valeur qu'un script aurait écrite.

## Relançable

Le script ne lit que les galeries qui ont encore une image sans dimensions ou sans date, et chaque écriture porte sa précondition. Une relance ne refait rien de ce qui est fait, une run interrompue (Ctrl-C, `kill`, coupure réseau) reprend où elle s'est arrêtée, deux runs simultanées ne se gênent pas, et l'application peut servir pendant ce temps.

Depuis #1293, une galerie créée à l'ouverture d'une création (à partir du listing du stockage) naît au format V1, sans dimensions : il est sûr, et utile, de relancer le script tant que de telles galeries peuvent apparaître. Sur une base à jour, une relance coûte une requête.

**Ctrl-C** : chaque galerie en cours finit le fichier qu'elle lit, puis le résumé s'affiche (exit 1, `Interrupted`). Un **second Ctrl-C** sort immédiatement (exit 130), sans résumé : rien n'est perdu, la relance reprend.

## Environnement : celui de l'application

Le script lit la configuration de l'application (`packages/server/node.config.js`, variables `lepatron_*`, `.env` compris). **Il n'y a pas de variable propre au script.**

| Variable                                      | Valeur                            |
| --------------------------------------------- | --------------------------------- |
| `lepatron_database`                           | la chaîne de connexion de l'appli |
| `lepatron_storage__type`                      | `aws` en production               |
| `lepatron_storage__aws__accessKeyId`          | celles de l'application           |
| `lepatron_storage__aws__secretAccessKey`      |                                   |
| `lepatron_storage__aws__bucketName`           |                                   |
| `lepatron_storage__aws__region`, `__endpoint` |                                   |

Le plus sûr est de le lancer **sur une instance de l'application** (Clever Cloud : `clever ssh`), où ces variables sont déjà celles de l'appli. Sans les variables de stockage, il lirait le disque local et trouverait tous les fichiers « absents » ; il le détecte et s'arrête (voir plus bas), mais autant ne pas en arriver là.

Au démarrage, il affiche ce qu'il va toucher : le nom de la base et ses hôtes (`Database: "<nom>" on <hôtes>`, jamais la chaîne de connexion, qui porte le mot de passe) et le stockage (`S3, bucket "…" at <hôte>` ou `local directory …`).

Si la variable de base ne s'applique pas (posée sans `export`, faute de frappe), la configuration retombe sur sa valeur par défaut : la base de production sur une instance de l'application, `localhost:27017/lepatron` ailleurs. C'est pourquoi **une run qui écrit doit nommer sa base** (`--confirm-database=<nom>`, voir plus bas) : si ce n'est pas celle à laquelle le script s'est connecté, il refuse avant toute lecture et toute écriture.

## Options

- `--dry-run` : lit tout, compte tout, n'écrit rien. Lit quand même les fichiers (c'est ce qu'il mesure). Affiche le nom de la base.
- `--confirm-database=<nom>` : **obligatoire sans `--dry-run`**. Le nom de la base que le dry-run a affiché (`Database: "<nom>"`). Absent, le script refuse de démarrer ; différent de la base réellement connectée, il se déconnecte et refuse (une ligne `Fatal error`, exit 1). Avec `--dry-run`, il est vérifié s'il est donné. (Pas `--database` : la configuration de l'application lit aussi la ligne de commande, et prendrait ce nom pour sa chaîne de connexion.)
- `--concurrency=N` : nombre de galeries traitées en même temps (1 à 32, 4 par défaut), donc au plus N lectures de stockage simultanées. Sur S3 la durée est proportionnelle à la latence : 8 divise le temps par environ 7 par rapport à 1.

## Procédure en production

0. **#1293 est déployée** (voir plus haut).
1. **Sur une copie** : restaurer un dump de production dans une base à part, au nom distinct (par ex. `<base>-copie`), faire pointer `lepatron_database` dessus avec `export` (le script peut lire le bucket de production, il n'y écrit jamais).
   ```bash
   node scripts/backfill-gallery-metadata.js --dry-run
   ```
   Vérifier que `Database: "<nom>"` est bien celui de la copie, puis lire le résumé (ci-dessous). Lancer ensuite en nommant la copie, et relancer : la seconde run doit annoncer `Galleries to process: 0`, hors fichiers absents ou illisibles, relus à chaque run.
   ```bash
   node scripts/backfill-gallery-metadata.js --confirm-database=<nom de la copie> --concurrency=8
   ```
2. **En production**, depuis une instance de l'application :
   ```bash
   node scripts/backfill-gallery-metadata.js --dry-run
   node scripts/backfill-gallery-metadata.js --confirm-database=<nom affiché par le dry-run> --concurrency=8
   ```
   Pas besoin de fenêtre de maintenance : les écritures sont atomiques et ne touchent que les champs manquants.
3. **Lire le code de sortie** (`echo $?`). 0 : terminé. 1 : le bloc `FAILED` en fin de sortie dit pourquoi ; corriger la cause et relancer, la run reprend où elle s'est arrêtée.

## Lire le résumé

```
--- Result ---
Galleries processed  : 2/2
Dimensions filled    : 3
Dates filled         : 4
Already complete     : 1
Changed meanwhile    : 0
Missing from storage : 1
Not an image         : 1
Size not found       : 0
Date not found       : 0
Unusable name        : 0
Read timed out       : 0
Storage error        : 0
```

Les compteurs portent sur des images (une entrée de galerie), pas sur des galeries.

| Ligne                                | Sens                                                                                                                                          | Action                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `Dimensions filled` / `Dates filled` | écritures effectives (`modifiedCount`), pas intentions ; en dry-run, `… to fill` : ce qui serait écrit                                        |                                                   |
| `Already complete`                   | image qui avait déjà dimensions et date                                                                                                       | aucune                                            |
| `Changed meanwhile`                  | image supprimée, ou champ rempli par l'appli, entre la lecture et l'écriture ; laissée telle quelle                                           | aucune                                            |
| `Missing from storage`               | le fichier n'est pas dans le stockage ; chaque fichier est nommé dans le flux (`missing: "<nom>"`) avec sa galerie                            | vérifier à la main ; une relance les relira       |
| `Not an image`                       | aucun en-tête d'image reconnu (un PDF, un fichier tronqué) ; sa date est quand même écrite                                                    | examiner à la main ; une relance les relira       |
| `Size not found`                     | un JPEG dont la taille n'a pas été trouvée dans ses 4 premiers Mo (métadonnées énormes, fichier abîmé) : c'est une image, sans doute utilisée | aucune ; le survol n'affichera pas ses dimensions |
| `Date not found`                     | le stockage n'a pas donné de date lisible ; aucune n'est inventée                                                                             | aucune ; l'image reste sans date                  |
| `Unusable name`                      | entrée sans nom exploitable (pas une chaîne, ou un chemin) ; jamais passée au stockage                                                        | à examiner à la main                              |
| `Read timed out`, `Storage error`    | transitoire ; l'erreur de stockage porte son code (`error (AccessDenied)`)                                                                    | exit 1 : relancer                                 |

Une galerie en erreur n'arrête pas les autres ; les ids des galeries en erreur sont listés dans le bloc `FAILED`, et le code de sortie vaut 1.

## Garde-fous

- **Base confirmée** : sans `--dry-run`, rien ne part sans `--confirm-database=<nom>` égal à la base réellement connectée.
- **Contrôle du stockage au démarrage** : avant tout, il relit jusqu'à 3 fichiers déjà mesurés. Si aucun n'est lisible, ce n'est pas le stockage de l'application : il s'arrête avant d'avoir rien lu ni écrit (exit 1).
- **Run qui n'a rien pu lire** : sur une base où rien n'est encore mesuré (pas de contrôle possible), une run où aucun fichier n'a pu être lu finit en exit 1 au lieu de conclure.
- **Stockage qui tombe en cours de run** : après 10 lectures de suite en échec (délai dépassé ou erreur), la run s'arrête d'elle-même, affiche le résumé et sort en exit 1 (`Stopped: … the storage looks down`). Relancer une fois le stockage revenu.
- **Lecture de l'en-tête seulement** : 128 Ko, et jusqu'à 4 Mo pour un JPEG dont les métadonnées (EXIF, XMP, profil ICC) repoussent la taille plus loin. Délai de 20 s par fichier.
- **Rien n'est supprimé**, ni par le script ni sur la foi de son résumé : un fichier sans dimensions ou sans date reste affiché dans la galerie et dans les emails qui l'utilisent.
- **Noms** : un nom stocké qui n'est pas un simple nom de fichier (`../`, `/`, octet nul, pas une chaîne) n'est jamais passé au stockage.
- **Pas d'effet de bord** : le script ne charge que le modèle des galeries (pas de vérification SMTP) et se connecte sans construire d'index, dry-run compris.

## Pourquoi ces écritures

Une première version lisait `gallery.files`, modifiait le tableau et le réécrivait (`gallery.save()`). C'était faux deux fois :

- le getter du schéma **projette** chaque fichier sur un jeu de clés fixe ; réécrire cette projection efface tout ce qu'elle ne liste pas (`originalName` en particulier) ;
- réécrire le tableau entier perd tout upload arrivé pendant la lecture.

Le script lit donc la collection brute (sans getter) et écrit un `$set` par nom de fichier et par champ, avec `arrayFilters` : la précondition (« pas encore de dimensions », « pas encore de date ») fait partie de l'écriture. Deux entrées legacy de même nom sont complétées toutes les deux.

La pagination se fait par `_id`, une requête par page de 100 galeries, sans curseur serveur : un curseur sans `getMore` pendant 10 minutes est tué par MongoDB 4.0 (le script y arrivait entre deux lots sur un stockage lent), une page ne peut pas expirer.

## Ordres de grandeur

Mesurés sur une base jetable (MongoDB 4.4 en local) avec un faux S3 local qui répond en 20 ms, 2 000 galeries de 5 images (10 000 images, dont 2 000 déjà mesurées), concurrence 8 :

| Run                                                                    | Durée | Mémoire max | Requêtes                                                    |
| ---------------------------------------------------------------------- | ----- | ----------- | ----------------------------------------------------------- |
| dry-run                                                                | 33 s  | 207 Mo      | 10 001 GET S3 (une par image, plus le contrôle), 0 écriture |
| run réelle                                                             | 41 s  | 207 Mo      | 10 001 GET S3, 16 000 écritures (une par champ et par nom)  |
| relance (un PDF par galerie reste à mesurer, il est relu à chaque run) | 7,6 s | 158 Mo      | 2 001 GET S3, 0 écriture                                    |

Une image dont seules les dimensions manquent, ou seule la date, coûte la même requête : la date vient des en-têtes de la réponse, et la lecture s'arrête au premier paquet quand la taille est déjà connue. La mémoire tient à une page de 100 galeries et aux en-têtes en cours de lecture (au plus N × 128 Ko, 4 Mo pour un JPEG aux métadonnées volumineuses), quelle que soit la taille de la collection.
