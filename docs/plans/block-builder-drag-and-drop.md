# Block Builder — le glisser-déposer depuis la palette

> Relevé terrain du 26/09/2026, et mise à jour du plan qui en découle.
>
> **Décisions prises le 26/09 :**
>
> 1. Le drag-and-drop depuis la palette est **indispensable au produit** — le
>    paradigme actuel (boutons « + Texte » et flèches ↑ ↓) n'est pas démontrable
>    à un client.
> 2. **Pas de tactile** : desktop uniquement, donc API drag-and-drop HTML5 native.
> 3. **On garde l'iframe** : la fidélité de l'aperçu ne se négocie pas, c'est la
>    réponse au risque n°1.

## Ce qui a été livré, et l'écart

La modale actuelle a trois zones : palette et liste d'éléments à gauche, aperçu
au centre, réglages à droite. L'aperçu est une **iframe non interactive** : on ne
peut ni y déposer, ni y cliquer pour sélectionner.

Le plan promettait « il dépose des composants dans la zone d'édition », et une
zone de **composition** distincte de l'aperçu. La composition et l'aperçu ont été
fusionnés en une iframe en lecture seule, sans que l'arbitrage soit écrit. C'est
un écart de mise en œuvre, pas une décision documentée.

## Relevé terrain

Trois sources, manipulées ou lues directement.

### Stripo (démo publique, 26/09)

| Point              | Observation                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas             | **iframe** (`iframe.service-element`), dans un Shadow DOM `<ui-editor>`                                                                                                                 |
| Palette            | **hors** de l'iframe : barre d'icônes à gauche + panneau flottant                                                                                                                       |
| Mécanique de drag  | `draggable: false` sur les vignettes → **pas l'API HTML5**, donc événements souris/pointeur                                                                                             |
| Niveaux de palette | 3 : _Mises en page_ (structures), _éléments atomiques_ (barre d'icônes : image, texte, bouton, espaceur, social, menu…), _Modules_ (blocs pré-construits, ~350 rangés en 17 catégories) |
| Zone vide          | placeholder « **Déposez le contenu ici** » comme cible de dépôt                                                                                                                         |
| Sélection          | au **clic**, pas au drag — la doc intégrée dit « Click any element to see its settings »                                                                                                |

Le point décisif est le troisième : Stripo n'utilise pas le drag-and-drop natif
du navigateur. C'est ce qui lui permet de franchir la frontière de l'iframe et de
fonctionner au doigt. La seconde propriété ne nous est pas demandée (voir
« Tactile » plus bas), mais la première, si.

#### Le geste, image par image

Relevé sur captures d'écran du drag en cours (l'inspection du DOM ne pouvait pas
le montrer, les événements synthétiques ne déclenchant pas le drag) :

1. **Le fantôme** est l'icône de l'élément, dans une pastille bordée de vert, qui
   suit le curseur.
2. **Hors d'une zone valide**, un badge sombre « interdit » s'affiche près du
   curseur — et surtout **toutes les zones de dépôt du canvas s'entourent de
   bleu**. Le canvas révèle sa structure pendant le drag, au lieu de la laisser
   deviner.
3. **Sur une zone valide**, une étiquette « **Déposer ici** » s'affiche au-dessus
   de la cible, elle-même encadrée.
4. **Au dépôt**, l'élément s'insère à la position visée, **est sélectionné
   automatiquement**, et le panneau de droite bascule sur ses réglages.
5. **Un élément déposé n'est jamais vide** : un bloc de texte arrive avec une
   amorce (« Saisissez votre texte, travaillez sur ses styles… »).

Les points 4 et 5 sont les plus instructifs, et les moins chers à reprendre : le
dépôt enchaîne directement sur l'édition, sans clic supplémentaire, et l'élément
est visible immédiatement même si l'utilisateur ne tape rien. C'est exactement ce
qui manquait à notre version — un élément ajouté n'apparaissait nulle part.

### GrapesJS 0.22 (démo publique, open source)

| Point             | Observation                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| Canvas            | **iframe** (`iframe.gjs-frame`, sans `src`, donc same-origin)                        |
| Palette           | hors de l'iframe, à droite                                                           |
| Mécanique de drag | `draggable: true` → **API HTML5 native**, et elle traverse bien l'iframe same-origin |
| Indicateur        | un élément unique `.gjs-placeholder` (ligne d'insertion), masqué hors drag           |
| Compléments       | `.gjs-highlighter` (contour au survol) et `.gjs-badge` (nom de l'élément)            |

GrapesJS prouve que **l'API HTML5 suffit** quand l'iframe est same-origin et sans
`src` — c'est exactement la configuration de notre aperçu. C'est la voie la moins
chère. Son défaut : pas de tactile.

### Le POC Badsender de mars (`WYSIWYG-block-builder`)

Correction d'une affirmation antérieure de ma part : le POC **avait** le drag
depuis la palette, pas seulement du réordonnancement.

- `BuilderToolbox.js` et `BlockBuilderCanvas.js` utilisent **vuedraggable**
  (groupes liés palette → canvas) ;
- un `drop-placeholder` sert d'état vide (« Drop an element here ») ;
- et surtout : « **Click to add layout (works alongside drag & drop)** » — le
  clic et le drag coexistaient.

**Mais son canvas n'était pas une iframe** : c'était un rendu Vue. Aucune
occurrence de `iframe` dans `BlockBuilderCanvas.js`. C'est pour ça que le drag y
était facile — et c'est aussi pour ça que ce qu'on y voyait n'était pas le HTML
email réellement généré.

## Le vrai arbitrage : fidélité contre manipulabilité

C'est le cœur du sujet, et il n'était écrit nulle part.

|                       | POC de mars   | Ce qui est livré         | Stripo / GrapesJS        |
| --------------------- | ------------- | ------------------------ | ------------------------ |
| Canvas                | rendu Vue     | iframe, HTML généré réel | iframe, HTML généré réel |
| Fidélité de l'aperçu  | approximative | **fidèle**               | fidèle                   |
| Drag palette → canvas | facile        | **impossible en l'état** | résolu                   |
| Coût                  | faible        | —                        | moyen                    |

Le POC a choisi la manipulabilité et perdu la fidélité. J'ai choisi la fidélité et
perdu la manipulabilité. **Les trois builders du marché ne choisissent pas : ils
gardent l'iframe et paient le drag.** C'est la seule combinaison qui tient les
deux promesses, et c'est celle à viser.

Renoncer à l'iframe pour retrouver le drag serait un retour en arrière : c'est
elle qui donne la largeur réelle de 600 px, l'isolation du CSS de l'éditeur et la
bascule mobile honnête — c'est-à-dire la réponse au risque n°1 (« voir le rendu
final immédiatement »).

## Décision proposée

**Garder l'iframe, ajouter le drag.** Trois briques, dans cet ordre, chacune
utile seule :

### D1 — Sélection au clic dans l'aperçu

Cliquer un élément dans l'iframe le sélectionne et ouvre ses réglages.
Chaque élément généré porte déjà `data-lp-el="<id>"` sur sa cellule, et l'iframe
est same-origin : il suffit d'écouter le clic dans son document.
**Petit.** Supprime la gêne la plus fréquente (« je veux corriger ce bouton-là »).

### D2 — Drag depuis la palette vers l'aperçu

**API HTML5 native**, comme GrapesJS : `draggable=true` côté palette,
`dragover`/`drop` écoutés dans le document de l'iframe. Le tactile n'étant pas
demandé, c'est la voie la moins chère, et elle est prouvée sur exactement notre
configuration (iframe same-origin, sans `src`).

Comportement cible, repris de Stripo :

| Moment          | Ce qu'on affiche                                                                            |
| --------------- | ------------------------------------------------------------------------------------------- |
| Début du drag   | fantôme = icône de l'élément qui suit le curseur                                            |
| Pendant le drag | **les zones de dépôt se révèlent** (contour léger sur chaque intervalle entre éléments)     |
| Sur une cible   | **ligne d'insertion** entre les deux éléments concernés, plus une étiquette « Déposer ici » |
| Hors cible      | curseur « interdit », aucune ligne                                                          |
| Au dépôt        | l'élément s'insère, **devient sélectionné**, et le panneau de réglages s'ouvre sur lui      |

Une ligne d'insertion (GrapesJS) plutôt que le seul encadré de Stripo : en
mono-colonne, la seule question est « entre quels deux éléments », et une ligne y
répond sans ambiguïté. Jamais de reflow en direct — coûteux, et ça clignote.

**Tout élément déposé arrive avec un contenu d'amorce** (un texte, une image
placeholder, un libellé de bouton). C'est ce qui manque le plus à la version
actuelle : un élément ajouté n'apparaît nulle part tant qu'il est vide.

Le clic sur un élément de palette **continue d'ajouter en fin de liste** : c'est
le chemin rapide, l'accessibilité clavier, et le filet si le drag échoue. Stripo
fait de même, et le POC de mars aussi (« Click to add works alongside drag &
drop »).

**Moyen.** C'est la brique qui rend la démo possible.

### D3 — Réordonner et supprimer par le drag

Glisser un élément déjà posé pour le déplacer, même indicateur. Les flèches ↑ ↓
restent.
**Moyen.**

### Points techniques à traiter

- **La boucle d'aperçu ne doit pas se rafraîchir pendant un drag.** Le
  `requestAnimationFrame` qui réécrit `doc.body.innerHTML` détruirait les nœuds
  sous le curseur. Geler le rendu entre `dragstart` et `drop`.
- **`data-lp-el` ne doit pas partir dans l'email.** Il sert à la modale ; la
  ré-éditabilité passe par `builderState`. Aujourd'hui il est exporté. À retirer
  du HTML final (correctif indépendant, petit).
- **Tactile : hors périmètre (tranché le 26/09).** L'API HTML5 ne gère pas le
  toucher, et le besoin n'existe pas — pas de démo au doigt attendue. On part
  donc sur l'API native. À rouvrir seulement si une démo sur tablette devient un
  cas d'usage : le passage aux événements pointeur, à la Stripo, serait alors une
  réécriture de la couche de drag, pas un ajustement.

## Conséquence sur le séquencement

Deux changements par rapport au plan.

**1. Le drag-and-drop devient un chantier du MVP**, avant l'étape 5 (le serveur et
la traduction). Le critère n'est plus technique mais commercial : sans lui, la
fonctionnalité n'est pas montrable.

**2. La frontière entre la modale et l'édition inline s'efface.** Une fois D1, D2
et D3 livrés, la modale possède un canvas interactif, une ligne d'insertion et la
sélection au clic — c'est-à-dire l'essentiel de l'étape 7. L'étape 7 ne consiste
plus alors qu'à déplacer ce canvas dans le canvas Mosaico, avec ses vraies
difficultés propres (undo, focus, sortable jQuery UI).

**À arbitrer** : construire la modale interactive puis la porter en inline, ou
viser l'inline directement. Je recommande de **garder la modale** — la largeur
utile (#main-toolbox fait 400 px) et l'absence d'interaction avec le sortable de
Mosaico restent des arguments forts, et l'ordre proposé ne jette rien.

## Ce qui reste à trancher

1. **Structures multi-colonnes** : Stripo sépare _Mises en page_ et _éléments_.
   Notre MVP est mono-colonne, donc la palette n'a qu'un niveau. Quand les
   colonnes arriveront (tranche 2), il faudra le second niveau — à prévoir dans
   la structure de la palette dès D2, pas à rajouter après.
2. **Modules pré-construits** : les ~350 modules de Stripo correspondent à notre
   étape 6 (bibliothèque de blocs perso). Même mécanique de dépôt, donc D2 doit
   être écrit pour accepter n'importe quelle source de dépôt, pas seulement les
   cinq éléments atomiques.
