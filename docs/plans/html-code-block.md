# Bloc « Code HTML » — plan de référence

> **Branche** : `feat/html-code-block` > **Type de document** : plan d'implémentation (rédigé avant le code, tenu à jour pendant)
> **Statut** : MVP implémenté — une seule branche, une seule PR. Voir §5 pour l'état commit par commit.

---

## 1. Objectif

Permettre de coller du HTML arbitraire entre deux blocs du design system d'un template,
avec préview dans le canvas, export fidèle et envoi de test. La fonctionnalité est
activable **template par template** par le super-admin Badsender.

### Parcours utilisateur

1. **Super-admin** — active « Code HTML » sur un template (page d'édition du template).
2. **Utilisateur** — le bloc « Code HTML » apparaît en **dernière position** de la palette
   _Template Blocks_. Il le glisse dans le canvas, clique dessus, et une modale
   CodeMirror s'ouvre pour coller son HTML.
3. Le canvas affiche un rendu neutralisé (scripts/iframes désactivés). L'export
   téléchargé, l'envoi de test et les exports ESP contiennent le HTML tel quel.

---

## 2. Principe directeur

**Le bloc HTML traverse exactement la même chaîne que les blocs issus d'un template.
Aucune fonction partagée n'est modifiée au-delà de retouches strictement additives.**

Conséquences assumées :

- pas de tokenisation des tags ESP (toucherait tous les chemins d'export) ;
- pas de correction des regex de restauration ESP (`viewmodel.js:707,716`) ;
- `process-mosaico-html-render.js` n'est pas modifié ;
- `handleTrackingData` n'est pas corrigé ;
- les tests sont des **tests de caractérisation** : ils figent le comportement actuel
  pour prouver que le bloc HTML se comporte comme un bloc texte, pas pour l'améliorer.

### Garantie officielle de fidélité

> Le bloc se comporte **comme un bloc texte, ni mieux ni pire**.

Concrètement : équivalence sémantique du HTML, et pour les tags de personnalisation ESP,
le même niveau de préservation que les blocs texte existants — soit byte-identité pour
les tags mono-ligne en ASCII sans `<`, `>`, `&`. **Pas** de byte-identité globale : elle
est impossible (re-sérialisation DOM, void tags auto-fermés, tabulations converties en
espaces, caractères non-ASCII encodés). Les tests de caractérisation documentent
précisément où la fidélité s'arrête.

---

## 3. Décisions produit (actées)

| #   | Sujet                     | Décision                                                                                              |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Périmètre                 | **Tranche complète** : l'utilisateur fournit sa propre `<table>`                                      |
| 2   | Inlining juice            | **Zone protégée** dans `inliner.js`, strictement additive                                             |
| 3   | Tags ESP accentués        | Aucune modification du pipeline : caractérisation + limite documentée                                 |
| 4   | Flag                      | `htmlBlockEnabled` sur le template uniquement, super-admin                                            |
| 5   | Aperçu / XSS              | Neutralisation de **tout** l'aperçu via la réponse de `previewMail()` ; stockage et livrables intacts |
| 6   | Éditeur                   | CodeMirror 5, dans une modale Vue                                                                     |
| 7   | Snippet de départ         | **Placeholder grisé** CodeMirror, jamais persisté dans le modèle                                      |
| 8   | Limite de taille          | **100 000 caractères** par bloc — message éditeur à « Appliquer » + garde serveur                     |
| 9   | Tracking des liens collés | Comportement identique aux autres blocs, **aucun opt-out**                                            |
| 10  | `]]>` / Adobe             | **Hors périmètre** — fix à la source dans `adobeProvider` (échappement CDATA), issue séparée          |
| 11  | Nombre de blocs par email | **Illimité**, sans suivi d'usage                                                                      |
| 12  | Position en palette       | **Dernière position**, après tous les blocs du template                                               |

### Libellés

| Clé                    | fr                                                                                                                           | en                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Palette                | Code HTML                                                                                                                    | HTML code                                                                                                     |
| État vide (canvas)     | Bloc Code HTML — cliquez pour éditer                                                                                         | HTML code block — click to edit                                                                               |
| Placeholder CodeMirror | Collez ici votre code HTML. Fournissez une table complète : largeur, responsive et dark mode sont sous votre responsabilité. | Paste your HTML code here. Provide a complete table: width, responsive and dark mode are your responsibility. |

Vignette de palette : **icône + libellé i18n**, pas de PNG.

---

## 4. Architecture

### 4.1 Injection inconditionnelle du bloc, côté client

Dans `packages/editor/src/js/template-loader.js`, branche `process.env.BADSENDER`,
`onSuccess(templatecode)` (~ligne 255) — avant `templateCompiler` :

```js
templatecode = injectHtmlCodeBlock(templatecode);
```

Fonction **pure** (string → string) qui ajoute :

- un `<style>` **autonome** avant `</head>` portant les blockdefs ;
- le markup du bloc **juste après la balise ouvrante** du `data-ko-container`.

La balise ouvrante est localisée par un **scan linéaire**, pas par une regex : un motif
de liste d'attributs répété autour de l'attribut provoque un backtracking
catastrophique sur les vrais templates (plusieurs centaines de Ko, attributs `style`
contenant `>`) et gelait l'éditeur au chargement.

La **dernière position en palette** (décision 12) est obtenue en réordonnant
`blockDefs`, pas en cherchant la balise fermante du conteneur — cela éviterait de
compter la profondeur d'imbrication en ignorant les commentaires conditionnels, pour
un résultat identique. L'ordre dans le conteneur n'a pas d'autre effet : les enfants
`data-ko-block` sont retirés du DOM par le parser et ne servent qu'à générer les
définitions.

**L'injection n'est jamais conditionnée au flag.** Trois raisons :

1. `converter/checkmodel.js:137-141` ne se contente pas de signaler un bloc inconnu, il
   le **supprime** (`REMOVING IT!!` + `reference[prop].splice(i, 1)`), puis l'autosave
   persiste la perte. Un flag qui retirerait la blockdef **détruirait silencieusement le
   contenu des créas existantes**.
2. Un `<style>` autonome évite toute chirurgie dans le CSS client ; il est consommé puis
   supprimé par le parser (les `<style>` vidés sont retirés).
3. Cela rend le bloc portable d'un template à l'autre — prérequis de la v2 « bloc
   réutilisable ».

**Nom réservé** : `htmlCodeBlock` et la propriété `htmlCode` sont désormais réservés
pour les développeurs de templates. L'injecteur s'abstient si le markup déclare déjà
un bloc de ce nom, donc un template qui l'utiliserait pour autre chose désactiverait
silencieusement la fonctionnalité pour lui-même.

Pas de pollution des nouveaux mails : `translateTemplate` fait
`domutils.removeElements(containerBlocks, true)` (`converter/parser.js:698-712`) ; les
enfants `data-ko-block` du conteneur ne servent qu'à générer les templates, et
`mainBlocks.blocks` reste vide par défaut.

**Le flag ne pilote que la visibilité en palette** : `paletteBlockDefs` (= `blockDefs`
filtré) est passé à `initializeViewmodel`, `blockDefs` restant **intact** pour les appels
à `checkModel`.

### 4.2 Markup injecté

```html
<div class="lp-html-block-root" data-ko-block="htmlCodeBlock">
  <div
    class="lp-html-block"
    data-ko-display="htmlCode"
    data-bind="lpHtmlCode: htmlCode"
  ></div>
</div>
```

Deux `<div>` nus, et rien d'autre. L'enveloppe ne porte **aucune présentation** : pas de
table, pas de cellule, pas de `width`, pas d'`align`, pas de `valign`, pas de `bgcolor`,
pas de `style`, pas de classe stylée. Tout cela styleraient le HTML collé ou écraseraient
ce qu'il hérite.

Contraintes qui imposent cette forme :

- **Pas de `<td align>`.** `align` est mappé sur `text-align`, qui **est héritée** : un
  `align="left"` sur la cellule fixait le contexte d'alignement et écrasait celui hérité
  du template, empêchant une table collée en `align="center"` de se centrer comme un bloc
  natif. `valign` est parti avec la cellule : appliqué à une cellule unique dont le
  contenu est autoporteur, il ne changeait rien tout en rendant l'enveloppe moins neutre.
- **`data-ko-display` est obligatoire.** `_propEditor` retourne `''` si
  `model._usecount === undefined` (`converter/editor.js:248-255`), et `_usecount` n'est
  incrémenté que par `_increaseUseCount` (`converter/model.js:413-424`), atteint
  uniquement via le `bindingProvider` — que `wrapElementWithCondition`
  (`converter/parser.js:12-29`) appelle. Sans lui, **le widget serait invisible dans le
  panneau**.
- **Il ne peut PAS être sur la racine du bloc.** Le converter lève une erreur explicite
  (« Unsupported data-ko-display used together with data-ko-block »), et il en va de même
  pour `data-ko-wrap`. Tout le contenu visible pend donc de cet attribut.
- **Pas de classe du template** (`vb-outer` et consorts), pour ne pas hériter de ses
  règles CSS. Les deux classes présentes (`lp-html-block-root`, `lp-html-block`) ne sont
  jamais stylées : ce sont des points d'accroche.
- À ne pas utiliser : `data-ko-editable` (le converter le transforme en `wysiwygOrHtml`,
  `parser.js:311`, qui attache **TinyMCE** en mode wysiwyg et détruirait le HTML collé) ;
  `data-ko-properties` sur la racine (lu ligne 147 mais **non retiré** de la racine → il
  fuiterait dans l'export).

### 4.3 Ce qu'un bloc exporte réellement

| Étage         | Fichier:ligne                    | Effet sur l'enveloppe                                         |
| ------------- | -------------------------------- | ------------------------------------------------------------- |
| Parsing       | `parser.js:119`                  | `data-ko-block` retiré                                        |
| Parsing       | `parser.js:19`                   | `data-ko-display` retiré → `<!-- ko if -->` autour du contenu |
| Export client | `viewmodel.js:675-676`           | commentaires `ko` retirés                                     |
| Export client | `viewmodel.js:678`               | `data-bind` retiré                                            |
| Export client | `strip-empty-blocks.js`          | **racine d'un bloc vide retirée**                             |
| Export client | `viewmodel.js:729-737`           | _trash check_ `/ data-[^ =]+(="[^"]+")? /` → `console.warn`   |
| Serveur       | `process-mosaico-html-render.js` | **ne retire aucun attribut ni élément**                       |

**Bloc rempli** → l'enveloppe est deux `<div>` sans style autour du HTML collé.

**Bloc vide → zéro markup.** `data-ko-display` ne masque que le contenu ; la racine du
bloc survit toujours, Mosaico n'offrant aucun moyen de la supprimer (erreur explicite sur
`data-ko-display`/`data-ko-wrap`, et `templateCreator` enregistre l'`outerHTML` de la
racine — `template-loader.js:133`). Elle est donc retirée de la **chaîne sérialisée**, en
fin de cascade d'export, via la classe d'accroche `lp-html-block-root`. Cette étape est
strictement additive : elle ne matche qu'une racine **vide** de ce bloc, laisse intact un
bloc rempli, et ne matche rien du tout dans un mail qui n'en contient pas.

**Les marqueurs sont des classes CSS, pas des attributs `data-*`.** Un
`data-lp-html-block` survivrait intégralement (aucune regex ne le cible) _et_
déclencherait le warning du trash check. Une classe ne déclenche aucun warning, est
ignorée par tous les clients mail (Outlook compris), et est du même type que les artefacts
déjà présents dans tous les exports Mosaico (`vb-outer`, `vb-row`, `vb-content`,
`mobile-full`, `links-color`).

Le nom de classe est délimité **sur les espaces** et non avec `\b` : les frontières de mot
des regex traitent `-` comme un séparateur, donc `\blp-html-block-root\b` matcherait
aussi à l'intérieur de `not-lp-html-block-root-either`.

### 4.4 Rendu dans le canvas, et état vide

Fait structurant : **le canvas n'est pas une iframe**. Le
`<iframe data-bind="bindIframe: $data">` de `tmpl/main.tmpl.html:118` est à l'intérieur
d'un commentaire HTML. Le canvas réel est `#main-wysiwyg-area`
(`tmpl/main.tmpl.html:5`), un div du document principal. Donc : le CSS de l'éditeur s'y
applique et **n'est jamais exporté** (l'export passe par une iframe créée à la volée dans
`exportHTML`, `viewmodel.js:645-650`) ; et le XSS canvas est critique (même document,
même origine, même session).

**Rendu d'un bloc rempli** : binding `lpHtmlCode` calqué sur `virtualHtml`
(`bindings/virtuals.js:83-116`), `init: ko.bindingHandlers.html.init` → donc
`controlsDescendantBindings: true` : les `data-bind` du HTML collé sont **inertes**. Le
rendu est celui du navigateur (`innerHTML`), mais l'intérieur est **opaque** : aucun
binding ni thème Mosaico ne s'y applique, contrairement aux blocs du design system.

**Neutralisation** : DOMPurify côté client, appliqué **uniquement** en mode `wysiwyg`,
via un `ko.computed` dérivé — jamais réécrit dans le modèle, jamais dans l'export.

**État vide.** L'enveloppe `<div class="editable block">`
(`tmpl/block-wysiwyg.tmpl.html:1`) existe indépendamment du contenu (le contenu n'est
rendu qu'en ligne 34) et porte `click: $root.selectBlock`. Mais
`style_mosaico_content.less:3-6` ne définit que `position: relative`, **sans
`min-height`** : un bloc au contenu masqué est plat, donc inatteignable. D'où un état vide
visible, sur le modèle exact du **conteneur vide** :

- `tmpl/blocks-wysiwyg.tmpl.html:1` — attribut de fallback + `attr:` i18n + classe
  conditionnelle `css:` ;
- `style_mosaico_content.less:8-31` — `#main-edit-area .sortable-blocks-edit.empty` +
  `:after { content: attr(data-empty-content); }`.

Fuite à l'export **structurellement impossible**, par trois barrières indépendantes :
`block-wysiwyg.tmpl.html` n'est utilisé qu'en mode wysiwyg (l'export résout `type-show`,
réduit à `<!-- ko block: $data --><!-- /ko -->`) ; le CSS est scopé `#main-edit-area`,
identifiant absent de l'export ; le libellé passe par un binding `text:`, donc par un
nœud texte du DOM d'édition, jamais par un attribut du markup.

Écarté : porter l'attribut sur le markup injecté (un `attr:` s'exécute aussi en mode
`show` et l'attribut serait posé **après** la suppression des `data-bind` → fuite) ;
cibler `.lp-html-block:empty` en CSS pur (le `ko if` retire le div entier quand vide).

La retouche de `block-wysiwyg.tmpl.html` est **strictement additive** — le `ko if` est
faux pour tout autre bloc — et reproduit la façon dont l'icône content-feed a été ajoutée
ligne 29 (`<!-- ko if: $root.isFeedMappableBlock($rawData) -->`).

### 4.5 Zone protégée dans l'inliner

Dans `vm.inline(doc)` (`packages/editor/src/js/ext/inliner.js`) : extraire le sous-arbre
`.lp-html-block` **avant** `inlineDocument` (ligne 31), le réinsérer après.

**Ordre critique** : `inliner.js:10-13` recopie `style` → `replacedstyle` sur
`[style]:not([replacedstyle])` **avant** l'inlining. L'extraction doit intervenir **avant
cette recopie**, sinon les `style` du HTML collé seraient dupliqués en `replacedstyle`
puis restaurés par les regex `viewmodel.js:683-700`.

Additif : sans bloc HTML dans le document, le comportement est strictement inchangé — à
prouver par un **diff binaire** de l'export d'un mail existant.

Motif : les `<style data-inline="true">` du template portent des sélecteurs génériques
(`img { border: 0px; display: block; }`, `template-versafix-1.html:231-233`) qui seraient
inlinés sur les `<img>` collées.

### 4.6 Format de stockage (v2-ready sans migration)

Une simple propriété string du modèle de bloc :

```json
{ "type": "htmlCodeBlock", "id": "block_7", "htmlCode": "<table …>…</table>" }
```

`save-modal.js` construit le payload « bloc réutilisable » par déstructuration
(`{ blockInformation, customStyle, ...blockContent }`) et
`personalized-blocks-list-component.js` réinjecte `{ ...content, blockInformation, id: '' }`
— un bloc dont la seule propriété de contenu est `htmlCode` passe tel quel, sans code
spécifique.

**Nom de la propriété : `htmlCode`, jamais `htmlContent`.**
`packages/server/translation/mosaico-text-extractor.js` applique des
`TRANSLATABLE_FIELD_PATTERNS` incluant `/content$/i` : une propriété `htmlContent` serait
envoyée au LLM de traduction, qui réécrirait le HTML.

### 4.7 Chaîne du flag

`template.schema.js` (`htmlBlockEnabled`) → projection `findForApi` →
`findOneForMosaico` populate `_wireframe` `select` (`mailing.schema.js:455`) →
`metadata.htmlBlockEnabled` (à côté de `hasHtmlPreview` / `hasTranslationFeature`) →
`mosaico-editor.pug` (`initOptions`) → `template-loader.js`.

Route déjà protégée : `router.put('/:templateId', GUARD_ADMIN, templates.update)`
(`template.routes.js:49`). Aucune route à créer.

**Piège de cast** : `template.controller.js:153` fait
`_.assignIn(template, _.omit(body, ['images','assets']))` sur un body **multipart**, où
les booléens arrivent en `"true"`/`"false"`. Mongoose casterait la chaîne `"false"` en
`true`. Normalisation explicite obligatoire.

---

## 5. Feuille de route (une branche, un commit par étape)

| #   | Étape                        | Portée                                                                |
| --- | ---------------------------- | --------------------------------------------------------------------- |
| 1   | Flag serveur                 | schéma, `findForApi`, populate, `metadata`, cast multipart            |
| 2   | UI admin                     | switch super-admin dans le formulaire de template + i18n              |
| 3   | Injection + palette          | fonction pure d'injection, `paletteBlockDefs`, vignette, libellés     |
| 4   | Rendu neutralisé + état vide | DOMPurify client, binding `lpHtmlCode`, état vide CSS + i18n          |
| 5   | Modale CodeMirror            | dépendance, build, widget `code`, modale, placeholder, limite 100 000 |
| 6   | Zone protégée inliner        | extraction/réinsertion du sous-arbre                                  |
| 7   | Neutralisation aperçu        | sanitize en sortie de `previewMail()`                                 |
| 8   | Tests de caractérisation     | payloads ESP, injection, neutralisation, pipeline                     |
| 9   | Documentation                | ce document + doc technique                                           |

### Fichiers principaux

| Rôle                         | Fichier                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| Constantes partagées         | `packages/editor/src/js/ext/html-code-block/constants.js`                  |
| Injection + ordre palette    | `packages/editor/src/js/ext/html-code-block/inject-html-code-block.js`     |
| Neutralisation aperçu canvas | `packages/editor/src/js/ext/html-code-block/neutralize-html.js`            |
| Zone protégée inliner        | `packages/editor/src/js/ext/html-code-block/protect-from-inliner.js`       |
| Limite de taille (éditeur)   | `packages/editor/src/js/ext/html-code-block/validate.js`                   |
| Prédicats d'état d'un bloc   | `packages/editor/src/js/ext/html-code-block/block-state.js`                |
| Retrait d'un bloc vide       | `packages/editor/src/js/ext/html-code-block/strip-empty-blocks.js`         |
| Binding de rendu             | `packages/editor/src/js/bindings/html-code-block.js`                       |
| Widget `code`                | `packages/editor/src/js/ext/badsender-widget-code.js`                      |
| Modale CodeMirror            | `packages/editor/src/js/vue/components/html-code-modal/html-code-modal.js` |
| Limite de taille (serveur)   | `packages/server/mailing/html-code-block-guard.js`                         |
| Sanitizer d'aperçu           | `packages/server/utils/preview-html-sanitizer.js`                          |
| Payloads de caractérisation  | `tests/fixtures/esp-payloads.js`                                           |

### Points d'accroche dans le code existant

Toutes ces retouches sont additives — sans bloc HTML dans le document, le
comportement est inchangé :

- `template-loader.js` — appel de l'injecteur dans `onSuccess`, et
  `paletteBlockDefs` passé à `initializeViewmodel` (`blockDefs` reste complet
  pour `checkModel`) ;
- `viewmodel.js` — `isSyntheticBlock`, `isEmptyHtmlBlock` ;
- `ext/inliner.js` — détachement/réinsertion autour de `inlineDocument` ;
- `viewmodel.js` (`exportHTML`) — retrait de la racine d'un bloc vide, en fin de cascade ;
- `tmpl/block-wysiwyg.tmpl.html` — `ko if` de l'état vide ;
- `tmpl-badsender/toolbox.tmpl.html` — icône et libellé de palette ;
- `ext/badsender-extensions.js`, `vue/customizedBlockPlugin.js`,
  `ko-bindings.js` — enregistrements ;
- `gulpfile.js` — DOMPurify et CodeMirror dans les deux listes de libs.

---

## 6. Dette identifiée — hors périmètre, tracée en issues séparées

Bugs réels, vérifiés dans le code, **volontairement non corrigés** ici :

- `viewmodel.js:707,716` — regex de restauration ESP **gloutonnes et mono-ligne** : les
  tags multi-ligne ne sont jamais restaurés ; sur une ligne à deux tags, tout
  l'intervalle est décodé, ce qui peut transformer du texte littéral en balises.
- `process-mosaico-html-render.js:25` — `he.encode(decimal:true)` encode tout
  non-ASCII : un tag ESP accentué (`%%prénom%%` → `%%pr&#233;nom%%`) est altéré.
- `mailing.service.js:1096` — `linksRegex = /(<a .*?) *(https?:[^"]+)(")/g` : `[^"]+`
  peut traverser `</a><a href=`, donc une URL nue dans du texte corrompt le balisage.
- `esp/adobe/adobeProvider.js` — regex d'images `/https?:\S+\.(jpg|…)/g` non ancrée sur
  `src=` (réécrit des URLs hors attributs, et `fetch` sur URL arbitraire → SSRF) ; `]]>`
  littéral cassant le CDATA SOAP (décision 10 : fix à la source, issue séparée).
- `mailing.schema.js:120-145` — `duplicate()` remplace textuellement l'ObjectId dans tout
  le JSON, et ne traite pas `previewHtml`.
- **Divergence assumée** : l'envoi de test n'applique ni tracking ni réécriture d'images,
  contrairement au ZIP et aux ESP → le mail de test n'est pas identique au livrable.

---

## 7. Recette manuelle

Sur un template versafix, flag activé :

1. Ouvrir une créa existante → **aucune** modale « incompatible template version », rien
   d'anormal en console.
2. **Flag OFF** : le bloc n'apparaît pas en palette ; une créa contenant déjà un bloc
   **conserve son contenu** après sauvegarde (vérifier `mailing.data` en base). C'est le
   test de non-régression le plus important.
3. Le bloc apparaît en **dernière position** de la palette.
4. Bloc vide dans le canvas : visible, cliquable, libellé d'invite affiché.
5. Coller chaque payload de caractérisation, sauvegarder, recharger : contenu inchangé.
6. `<img src=x onerror=alert(1)>` → aucune alerte dans le canvas ni dans l'aperçu ; le
   script **est** présent dans le ZIP téléchargé.
7. Télécharger le ZIP → **diff binaire** entre le HTML collé et la portion correspondante.
8. Une créa **sans** bloc HTML → export **binairement identique** à celui de `develop`.
9. Envoi de test et export ESP → mêmes vérifications sur les tags ESP.
10. Dépassement de 100 000 caractères → message clair, pas d'écriture du modèle.
11. **Alignement hérité** : coller une table en `align="center"` avec un `max-width` →
    elle se centre comme un bloc natif du template, sans réglage supplémentaire.
12. **Bloc vide muet** : laisser un bloc vide dans une créa, exporter → **aucune trace**
    dans le HTML (ni `<div>`, ni `<table>`, ni `lp-html-block-root`), alors que le bloc
    reste visible et cliquable dans le canvas.
