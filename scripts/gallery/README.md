# Scripts de maintenance de la galerie

Deux scripts, à lancer après le déploiement de la galerie V1 :

| Script                                   | Ce qu'il fait                                                                                       | Lit le stockage    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------ |
| `scripts/migrate-gallery-v1.js`          | donne `label`, `source`, `externalMetadata` et `uploadedAt` aux images qui n'ont pas d'`uploadedAt` | non                |
| `scripts/backfill-gallery-dimensions.js` | sonde `width` et `height` des fichiers stockés qui n'en ont pas                                     | oui (S3 ou disque) |

Ils partagent le même runner (`run-gallery-script.js`) : mêmes options, même résumé, mêmes codes de sortie.

## Relançables, pas « one-shot »

Les deux scripts ne lisent que les galeries qui ont encore du travail, et chaque écriture porte sa précondition. Une relance ne refait rien de ce qui est fait, une run interrompue (Ctrl-C, `kill`, coupure réseau) reprend où elle s'est arrêtée, et deux runs simultanées ne se gênent pas.

Une galerie est créée à la première ouverture d'une création, à partir du listing du stockage. Tant que ce chemin peut produire des images sans champs V1 ou sans dimensions (les créations antérieures à la collection `galleries`), il est sûr, et utile, de relancer les deux scripts : sur une base à jour, la migration coûte une requête.

`label` vaut le nom technique du fichier quand rien d'autre n'est connu, et `uploadedAt` la date de création de la galerie (à défaut celle de son `_id`) : c'est une approximation, pas la vraie date d'upload.

## Environnement : celui de l'application

Les scripts lisent la configuration de l'application (`packages/server/node.config.js`, variables `lepatron_*`, `.env` compris). **Il n'y a pas de variable propre aux scripts.**

| Variable                                      | Migration | Backfill | Valeur                            |
| --------------------------------------------- | --------- | -------- | --------------------------------- |
| `lepatron_database`                           | oui       | oui      | la chaîne de connexion de l'appli |
| `lepatron_storage__type`                      |           | oui      | `aws` en production               |
| `lepatron_storage__aws__accessKeyId`          |           | oui      | celles de l'application           |
| `lepatron_storage__aws__secretAccessKey`      |           | oui      |                                   |
| `lepatron_storage__aws__bucketName`           |           | oui      |                                   |
| `lepatron_storage__aws__region`, `__endpoint` |           | oui      |                                   |

Le plus sûr est de lancer les scripts **sur une instance de l'application** (Clever Cloud : `clever ssh`), où ces variables sont déjà celles de l'appli. Sans les variables de stockage, le backfill lirait le disque local et trouverait tous les fichiers « absents » ; il le détecte et s'arrête (voir plus bas), mais autant ne pas en arriver là.

Au démarrage, chaque script affiche ce qu'il va toucher : le nom de la base et ses hôtes (`Database: "<nom>" on <hôtes>`, jamais la chaîne de connexion, qui porte le mot de passe) et, pour le backfill, le stockage (`S3, bucket "…" at <hôte>` ou `local directory …`).

Si la variable de base ne s'applique pas (posée sans `export`, faute de frappe), la configuration retombe sur sa valeur par défaut : la base de production sur une instance de l'application, `localhost:27017/lepatron` ailleurs. C'est pourquoi **une run qui écrit doit nommer sa base** (`--database=<nom>`, voir plus bas) : si ce n'est pas celle à laquelle le script s'est connecté, il refuse avant toute écriture.

## Options

- `--dry-run` : lit tout, compte tout, n'écrit rien. Le backfill lit quand même les fichiers (c'est ce qu'il mesure). Affiche le nom de la base.
- `--database=<nom>` : **obligatoire sans `--dry-run`**. Le nom de la base que le dry-run a affiché (`Database: "<nom>"`). Absent, le script refuse de démarrer ; différent de la base réellement connectée, il refuse avant toute écriture (exit 1). Avec `--dry-run`, il est vérifié s'il est donné.
- `--concurrency=N` : nombre de galeries traitées en même temps (1 à 32, 4 par défaut). Le backfill fait au plus N lectures de stockage simultanées. Sur S3 la durée est proportionnelle à la latence : 8 divise le temps par environ 7 par rapport à 1.

## Procédure en production

1. **Sur une copie** : restaurer un dump de production dans une base à part, au nom distinct (par ex. `<base>-copie`), faire pointer `lepatron_database` dessus avec `export` (le backfill peut lire le bucket de production, il n'y écrit jamais).
   ```bash
   node scripts/migrate-gallery-v1.js --dry-run
   node scripts/backfill-gallery-dimensions.js --dry-run
   ```
   Vérifier que `Database: "<nom>"` est bien celui de la copie, puis lire le résumé (ci-dessous). Lancer ensuite sans `--dry-run` en nommant la copie, et relancer : la seconde migration doit annoncer `Galleries to process: 0`.
   ```bash
   node scripts/migrate-gallery-v1.js --database=<nom de la copie>
   node scripts/backfill-gallery-dimensions.js --database=<nom de la copie> --concurrency=8
   ```
2. **En production**, depuis une instance de l'application :
   ```bash
   node scripts/migrate-gallery-v1.js --dry-run
   node scripts/migrate-gallery-v1.js --database=<nom affiché par le dry-run>
   node scripts/backfill-gallery-dimensions.js --dry-run
   node scripts/backfill-gallery-dimensions.js --database=<nom affiché par le dry-run> --concurrency=8
   ```
   Pas besoin de fenêtre de maintenance : les écritures sont atomiques et ne touchent que les champs migrés.
3. **Lire le code de sortie** (`echo $?`). 0 : terminé. 1 : le bloc `FAILED` en fin de sortie dit pourquoi ; corriger la cause et relancer, la run reprend où elle s'est arrêtée.

## Lire le résumé

```
--- Result ---
Galleries processed  : 4499/4499
Images migrated      : 26466
Already up to date   : 1895
Changed meanwhile    : 0
Without a name       : 0
```

| Ligne                                   | Sens                                                                                                                                          | Action                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `Images migrated` / `Dimensions filled` | écritures effectives (`modifiedCount`), pas intentions                                                                                        |                                                   |
| `Changed meanwhile`                     | image supprimée, migrée ou mesurée par l'appli entre la lecture et l'écriture ; laissée telle quelle                                          | aucune                                            |
| `Without a name` / `Unusable name`      | entrée sans nom exploitable (pas une chaîne, ou un chemin) ; jamais passée à une requête ni au disque                                         | à examiner à la main                              |
| `Missing from storage`                  | le fichier n'est pas dans le stockage ; chaque fichier est nommé dans le flux (`missing: "<nom>"`) avec sa galerie                            | vérifier à la main ; une relance les relira       |
| `Not an image`                          | aucun en-tête d'image reconnu (un PDF, un fichier tronqué)                                                                                    | examiner à la main ; une relance les relira       |
| `Size not found`                        | un JPEG dont la taille n'a pas été trouvée dans ses 4 premiers Mo (métadonnées énormes, fichier abîmé) : c'est une image, sans doute utilisée | aucune ; le survol n'affichera pas ses dimensions |
| `Read timed out`, `Storage error`       | transitoire ; l'erreur de stockage porte son code (`error (AccessDenied)`)                                                                    | exit 1 : relancer                                 |

Une galerie en erreur n'arrête pas les autres ; les ids des galeries en erreur sont listés dans le bloc `FAILED`, et le code de sortie vaut 1.

## Garde-fous du backfill

- **Contrôle du stockage au démarrage** : avant tout, il relit jusqu'à 3 fichiers déjà mesurés. Si aucun n'est lisible, ce n'est pas le stockage de l'application : il s'arrête avant d'avoir rien lu ni écrit (exit 1).
- **Run qui n'a rien pu lire** : sur une base où rien n'est encore mesuré (pas de contrôle possible), une run où aucun fichier n'a pu être lu finit en exit 1 au lieu de conclure.
- **Lecture de l'en-tête seulement** : 128 Ko, et jusqu'à 4 Mo pour un JPEG dont les métadonnées (EXIF, XMP, profil ICC) repoussent la taille plus loin. Délai de 20 s par fichier.
- **Rien n'est supprimé**, ni par le script ni sur la foi de son résumé : un fichier sans dimensions reste affiché dans la galerie et dans les emails qui l'utilisent.
- **Noms** : un nom stocké qui n'est pas un simple nom de fichier (`../`, `/`, octet nul, pas une chaîne) n'est jamais passé au stockage.

## Pourquoi ces écritures

La première version lisait `gallery.files`, modifiait le tableau et le réécrivait (`gallery.save()`). C'était faux deux fois :

- le getter du schéma **projette** chaque fichier sur un jeu de clés fixe ; réécrire cette projection efface tout ce qu'elle ne liste pas (`originalName` en particulier) ;
- réécrire le tableau entier perd tout upload arrivé pendant la lecture.

Les scripts lisent donc la collection brute (sans getter) et écrivent un `$set` par nom de fichier, avec `arrayFilters` : la précondition (« pas encore d'`uploadedAt` », « pas encore de dimensions », « pas de label ») fait partie de l'écriture. Un utilisateur qui renomme une image pendant la migration garde son libellé ; deux entrées legacy de même nom sont migrées toutes les deux.

La pagination se fait par `_id`, une requête par page de 100 galeries, sans curseur serveur : un curseur sans `getMore` pendant 10 minutes est tué par MongoDB 4.0 (le backfill y arrivait entre deux lots sur un stockage lent), une page ne peut pas expirer.

## Ordres de grandeur

Mesurés sur une base jetable (MongoDB 4.4 en local, 5 000 galeries, 28 910 images) :

| Run                                                               | Durée              | Mémoire max  | Requêtes Mongo                   |
| ----------------------------------------------------------------- | ------------------ | ------------ | -------------------------------- |
| migration, concurrence 1 / 4 / 8                                  | 14,5 / 4,5 / 3,4 s | 124 à 133 Mo | 46 lectures + 1 écriture par nom |
| migration relancée sur base à jour                                | 0,4 s              | 103 Mo       | 1 lecture, 0 écriture            |
| backfill, stockage à 20 ms, concurrence 1 / 8 / 16 (2 908 images) | 67 / 9 / 5 s       | 118 à 158 Mo | 1 écriture par nom mesuré        |

Le processus Node charge les modèles de l'application (environ 100 Mo à lui seul) ; une page de 100 galeries s'y ajoute, quelle que soit la taille de la collection.
