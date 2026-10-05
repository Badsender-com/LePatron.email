# Spike — colonnes et taille de police mobile

> Fait le 28/09/2026 sur `spike/columns-and-responsive`, à partir du sommet de la
> pile block-builder. **Le code du spike a été supprimé** : ce document est ce
> qu'il en reste, et c'est le seul livrable qu'il devait produire.

## La question posée

« Est-ce que tout ne va pas s'écrouler quand on va faire du multi-colonne ? » —
et sa suite : est-ce qu'il faudra revenir sur la structure des composants pour
exposer des réglages par type d'élément ?

Le raisonnement seul ne pouvait pas répondre. Le spike a donc écrit une vraie
mise en page 2 colonnes avec une taille de police mobile, jusqu'à la sortie
HTML, en mesurant ce qui casse.

## Verdict : go

L'architecture tient. 94 lignes sur 9 fichiers, **zéro** dans le générateur,
l'export, l'inliner, la substitution, la traduction ou le modèle de données.
Les colonnes sortent en vraies cellules à 50 %, sans ghost table Outlook, et le
CSS d'empilement est accepté tel quel par le canal `<head>` de la PR #1119 :

```css
@media only screen and (max-width: 600px) {
  .lp-sm-fs14 {
    font-size: 14px !important;
  }
  .lp-stack {
    display: block !important;
    width: 100% !important;
  }
}
```

Les classes sont nommées par valeur, donc dédupliquées : deux éléments en 14 px
produisent une seule règle — le nommage retenu au plan, et celui de Dartagnan.

## Les quatre trouvailles

Aucune des quatre n'était prévisible sans écrire le code. C'est ce qui justifie
le spike.

### 1. Le compilateur retirait _toutes_ les classes après inlining

`markup-pipeline.js` faisait `inlined.replace(/\s+class="[^"]*"/g, '')`. C'était
juste tant que le responsive était interdit : les utilitaires Tailwind sont
inlinés, leurs noms ne sont plus que du poids mort dans un email envoyé.

Mais une classe d'empilement est l'exact inverse — **elle ne peut pas être
inlinée par définition**, puisqu'elle ne signifie quelque chose qu'à l'intérieur
d'une media query. Le strip total était donc la cause première de
l'impossibilité du responsive, et personne ne l'aurait vu en lisant le fichier.

À faire : ne retirer que les classes qui ne viennent pas du générateur (préfixe
`lp-`, plus les sentinelles `LPSLOT`).

### 2. Il faut un contexte qui n'échappe pas — et c'est le point à surveiller

Une colonne contient du HTML **déjà généré**. Tous les contextes existants
échappent ; vérifié, la sortie donnait `&lt;table`. Il faut donc un contexte
`MARKUP` qui insère tel quel.

C'est la seule brèche possible dans le modèle de sécurité, et ce qui la tient
n'est pas le contexte lui-même mais **où il a le droit d'être déclaré** :

- les slots d'un **élément** sont remplis depuis l'état stocké, donc depuis ce
  qu'un utilisateur a tapé → jamais `MARKUP` ;
- les slots d'une **mise en page** sont remplis par `generate` avec sa propre
  sortie, et par rien d'autre → `MARKUP` admis.

**Cette règle doit être appliquée par le compilateur**, comme une cinquième
garde, et pas seulement écrite en commentaire. C'est la condition pour que
`MARKUP` reste sûr quand quelqu'un d'autre ajoutera un élément dans six mois.

### 3. `generateElement` embarque sa propre ligne

Un élément rend aujourd'hui son `<tr><td>`. Posé dans une cellule de colonne,
ça produit `<td><tr>` — invalide, et les navigateurs le jettent.

À faire : séparer « rendre un élément » de « rendre une ligne de bloc ». Les
mises en page appellent le premier, le rendu mono-colonne actuel continue
d'appeler le second. C'est un découpage, pas une réécriture.

### 4. La trouvaille qui répond à la crainte sur les réglages

Mon premier câblage du responsive **ne marchait pas**. J'avais posé la classe
mobile sur la cellule extérieure, alors que le `font-size` est en inline sur une
cellule descendante — et **une classe sur un ancêtre ne bat jamais une
déclaration inline sur l'enfant**, `!important` ou pas.

La conséquence est structurelle : **chaque composant d'élément doit exposer un
slot de classe, posé sur la cellule qui porte le style inline correspondant.**

```vue
<td
  :align="align"
  :class="responsiveClass"
  :style="`… font-size:${fontSize}px; …`"
  v-html="content"
></td>
```

Trois lignes par élément, dans le fichier `.vue` — le plus facile à modifier de
toute la chaîne, précisément parce qu'on l'a sorti du JS à l'étape des
composants Vue. **C'est la réponse à la crainte d'un retour en arrière sur la
structure : il y en a un, il est réel, et il coûte trois lignes par élément.**

## Ce que le spike a aussi mesuré

Trois assertions de tests ont refusé le spike, et **c'est le résultat attendu** :
deux « aucun attribut `class` dans la sortie compilée », une « tout trou déclare
un contexte connu ». Ce sont les garde-fous qui font leur travail. Ils devront
être mis à jour délibérément, jamais contournés.

Vérifications finales, toutes vraies : pas de `<tr>` orphelin, classe sur la
même cellule que le `font-size`, une seule règle pour deux éléments, `width="50%"`
sur de vraies cellules, aucune ghost table mso.

## Empreinte, pour la tranche colonnes

| Ce qui change                                  | Ce qui ne change pas                              |
| ---------------------------------------------- | ------------------------------------------------- |
| Un slot de classe par composant (5 × 3 lignes) | `generate.js`, `state.js`                         |
| Le contexte `MARKUP` + sa garde au compilateur | `slot-contexts.js` pour les cinq autres contextes |
| La séparation élément / ligne                  | L'inliner, le strip, la substitution              |
| Le filtre de classes du compilateur            | La traduction, l'export                           |
| 3 assertions de tests à revoir                 | Le modèle de données                              |

Le vrai travail de la tranche colonnes n'est donc pas là où on le craignait. Il
est dans **la forme de l'état** (aujourd'hui une liste plate d'éléments, demain
des lignes contenant des colonnes) et dans **l'arithmétique d'index du
glisser-déposer**, qui est aujourd'hui unidimensionnelle. Ces deux points sont
réels et non triviaux — mais ils sont localisés, et aucun des deux ne remet en
cause ce qui est dans la pile.
