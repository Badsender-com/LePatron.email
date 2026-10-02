# Canal CSS dans le `<head>` — implémentation livrée

> Fait suite au bloc « Code HTML » ([html-code-block.md](./html-code-block.md)), et prépare le Block Builder.

## 1. Objectif

Permettre d'ajouter une feuille de style dans le `<head>` de l'email exporté, propre à chaque créa.

Deux besoins, un seul canal :

|             | CSS **utilisateur** (livré ici)               | CSS **généré** (Block Builder, à venir) |
| ----------- | --------------------------------------------- | --------------------------------------- |
| Qui l'écrit | l'utilisateur, à la main                      | le générateur                           |
| Contenu     | arbitraire                                    | déterministe, dédupliqué, préfixé       |
| Risque      | élevé : le CSS est global par nature          | nul — on maîtrise ce qu'on émet         |
| Garde-fous  | taille, flag template, exclusion de l'inliner | aucun nécessaire                        |

Le canal est identique pour les deux ; seuls les garde-fous diffèrent. Le CSS utilisateur est livré en premier parce qu'il a une valeur immédiate — c'est la demande issue de la recette du 23/09 — et parce qu'il valide le canal de bout en bout avant que le générateur existe.

## 2. Pourquoi une transformation de chaîne, et pas un `<style>` dans le template

Deux impasses, vérifiées dans le code :

- **Le `<head>` d'un export n'est pas un littéral.** C'est le rendu Knockout du template `template-head` (`template-loader.js:119`), construit à la compilation. Il n'y a pas de nœud à cibler avant que la frame d'export soit bindée.
- **Tout `<style>` présent dans le markup d'un template est consommé par le parser** : son contenu est remplacé par un binding `template:`, et l'élément est supprimé si le résultat est vide (`converter/parser.js:191-210`). C'est d'ailleurs ce qui fait disparaître proprement le `<style>` de blockdefs injecté par le bloc Code HTML.

D'où le choix : une fonction pure `injectHeadCss(html, css)` appliquée à l'export **terminé**. Le CSS ne traverse ni les regex de la cascade, ni la re-sérialisation DOM, ni l'inliner.

**L'inliner n'était pas la menace attendue.** LePatron appelle `inlineDocument` de juice, qui n'a pas d'option `removeStyleTags`, et ne collecte que les `<style data-inline="true">` (`ext/inliner.js`). Un `<style>` ordinaire le traverse déjà intact — c'est ainsi que les `@media` responsive des templates survivent aujourd'hui.

## 3. Où le CSS vit

`mailing.headCss`, **hors de `data`**. Le modèle de contenu Mosaico n'était pas une option : `checkmodel.js` supprime toute propriété que les définitions de blocs ne déclarent pas, et cette feuille appartient à la créa, pas à un bloc.

Chemin complet :

```
mailing.headCss (Mongo)
  → metadata.headCss           (mailing.schema.js, même canal que htmlBlockEnabled)
  → viewModel.headCss()        (observable, seedé dans template-loader.js)
  → exportedHeadCss()         (vide si la créa n'a aucun bloc Code HTML)
  → injectHeadCss(...)         (dernière étape de exportHTML)
  → <style> dans le <head>     (ZIP, envoi de test, ESP, previewHtml)
```

Au retour, le champ est renvoyé avec le contenu à la sauvegarde. Le serveur ne l'écrit **que s'il est présent dans la requête** : un bundle éditeur plus ancien, ou la route de métadonnées, ne doit pas effacer une feuille stockée.

## 4. Décisions

### Le CSS suit les blocs Code HTML, pas le flag

Le CSS n'existe que pour styler du markup collé dans un bloc Code HTML. Ce qui décide s'il part dans l'export, c'est donc la présence d'un tel bloc — vide ou non, dans n'importe quel conteneur de premier niveau (`mainBlocks` ou un autre) — et non le flag du template. Le flag décide seulement de qui peut **écrire** le CSS.

| Flag | Bloc Code HTML dans la créa | CSS stocké | Exporté (export, canvas, copie traduite) | Interface (onglet Style, panneau du bloc)                                                      |
| ---- | --------------------------- | ---------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ON   | au moins un                 | oui / non  | oui                                      | « Éditer le CSS », comme avant                                                                 |
| ON   | aucun                       | oui / non  | **non**                                  | « Éditer le CSS » + mention « non exporté tant que l'email ne contient pas de bloc Code HTML » |
| OFF  | au moins un                 | oui        | oui                                      | **lecture seule** : « Voir le CSS » → modale sans « Appliquer », avec « Supprimer le CSS »     |
| OFF  | au moins un                 | non        | —                                        | rien                                                                                           |
| OFF  | aucun                       | oui / non  | **non**                                  | rien                                                                                           |

- **Retirer le dernier bloc n'efface pas le CSS.** Il reste dans `viewModel.headCss` et sur la créa ; un Ctrl+Z ou un bloc rajouté le fait revenir tel quel. Aucune perte silencieuse.
- **En lecture seule, le CSS est traité comme le bloc lui-même** : le bloc reste, non éditable, supprimable ; le CSS reste, non éditable, supprimable. « Supprimer » demande confirmation, vide le CSS en un pas annulable, et le serveur l'accepte flag OFF (seul un CSS inchangé ou vidé passe).
- **Côté éditeur**, la règle vit dans `ext/head-css/exported-css.js` (`hasHtmlCodeBlock`, `headCssToExport`) ; `exportHTML` et l'aperçu canvas lisent tous deux `viewModel.exportedHeadCss()`. L'aperçu passe par un `ko.pureComputed`, disposé avec le plugin, qui ne notifie que si le CSS exporté change.
- **Côté serveur**, `headCssToExport` (`mailing/head-css-guard.js`, sur `findHtmlCodeBlocks`) applique la même règle au `previewHtml` d'une copie traduite. Un test fait tourner les deux prédicats sur les mêmes jeux de données.
- Les prédicats de l'interface sont dans `ext/head-css/view-model.js` : `isHeadCssEditable` (flag ON, inchangé), `isHeadCssReadOnly` (flag OFF, CSS non vide, au moins un bloc), `isHeadCssAwaitingBlock` (flag ON, aucun bloc).

### Autres décisions

| Sujet             | Décision                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portée            | Par créa. Le CSS accompagne l'email, pas le template                                                                                                                                                                                                                                                                                                                             |
| Flag              | **Réutilise `htmlBlockEnabled`.** Le CSS existe pour styler du markup collé dans un bloc Code HTML ; un client sans ce bloc n'aurait rien à styler et gagnerait seulement le pouvoir de restyler tout l'email hors design system. Découpler plus tard est un ajout, pas une migration                                                                                            |
| Limite            | 20 000 caractères. Une feuille est bien plus compacte que le markup qu'elle style ; la copie stockée, doublée par `previewHtml`, reste négligeable contre la limite de 16 Mo par document                                                                                                                                                                                        |
| Surface d'édition | La modale CodeMirror du bloc Code HTML, rendue paramétrable (mode, libellés, borne) plutôt que dupliquée                                                                                                                                                                                                                                                                         |
| Emplacement       | **Deux points d'entrée, une seule valeur** : bas de l'onglet **Style** global (où le CSS appartient logiquement), et un second bouton dans le panneau du bloc Code HTML (où on le cherche réellement, juste après avoir collé du markup). Une phrase sous ce bouton rappelle que la portée est l'email entier                                                                    |
| Aperçu mobile     | La feuille est **régénérée depuis la source** à chaque changement de CSS ou de mode, plutôt que réécrite dans la CSSOM comme le fait `badsender-screen-preview.js` pour le template. Ce module construit son index de media rules une fois, au chargement d'un template ; une feuille remplacée à chaque « Appliquer », annulation ou changement de mode n'y aurait pas sa place |
| Annulation        | La pile d'annulation ne surveille que `viewModel.content`, et la feuille vit hors de lui : `undomain.js` empile donc ses changements à la main, comme des actions ordinaires. Un « Appliquer » = un pas, que Ctrl+Z défait sans toucher à la dernière édition de contenu, et que Ctrl+Y refait. La valeur chargée avec la créa n'est pas annulable                               |
| Constantes        | `packages/shared/head-css/constants.js`, requis par l'éditeur **et** le serveur. Le bloc Code HTML duplique les siennes avec un test de synchro parce que le serveur ne doit pas dépendre d'un bundle navigateur ; ici les deux côtés partagent déjà un module                                                                                                                   |

## 5. Sécurité

- **`</style` dans la charge utile est neutralisé** (`<\/style`). Sans ça, un CSS collé pourrait fermer l'élément et ouvrir du markup arbitraire dans l'export. Testé sur toutes les casses.
- **Le flag est appliqué côté serveur**, pas seulement dans l'UI : la route accepte des requêtes écrites à la main.
- **Couper le flag après coup** laisse la créa sauvegardable et le CSS effaçable, mais refuse toute écriture nouvelle — un super-admin ne doit pas enfermer un auteur hors de son propre email. L'éditeur montre alors ce CSS en lecture seule, avec sa suppression, tant qu'il est encore exporté (voir § 4).
- Le CSS **n'est pas assaini**. C'est assumé, et cohérent avec le bloc Code HTML : la promesse est la fidélité. Le garde-fou est le flag, pas un filtre.

## 6. Limites connues

- **Toutes les media queries sont neutralisées en aperçu mobile, pas seulement les `max-width`.** Une règle `@media (min-width: 700px)` s'appliquerait donc à tort dans cet aperçu. C'est le comportement qu'a déjà `badsender-screen-preview.js` sur le CSS du template : s'en écarter serait plus déroutant que s'y conformer.
- **En aperçu « les deux » (le mode par défaut), les règles mobiles ne s'affichent pas**, comme celles du template : la condition est forcée, mais chaque sélecteur reçoit le suffixe `.visible-on-both`, qu'aucun élément ne porte. Les deux feuilles lisent ces règles dans un seul module, `ext/preview-media.js`.
- **Le canvas peut montrer une règle que l'email n'appliquera pas.** À l'export, juice écrit les styles du template en ligne, et un style en ligne l'emporte sur le `<head>` sauf `!important` ; dans le canvas, ces mêmes styles sont une feuille scopée que le CSS de l'email peut battre en spécificité. Les deux textes d'aide le disent.
- **`he.encode` côté serveur** encode les non-ASCII en entités décimales, y compris dans le `<style>`. Un `content: "é"` ou un commentaire accentué en souffrira. Même limite que le bloc Code HTML, documentée là-bas.

## 7. Recette manuelle

Non-régression d'abord, le reste ensuite. Les points 3 à 12 supposent une créa contenant au moins un bloc Code HTML : sans bloc, le CSS n'est pas exporté (points 13 et suivants).

1. **Flag OFF, aucune créa touchée** : exporter un email sans CSS → le ZIP est binairement identique à celui d'avant la branche.
2. Flag OFF, sans CSS stocké → la section « CSS personnalisé » n'apparaît pas dans l'onglet Style.
3. Flag ON → la section apparaît ; le bouton ouvre la modale en coloration CSS.
   3bis. Sélectionner un bloc Code HTML → le panneau offre « Éditer le CSS de l'email » sous le bouton HTML, avec la mention de portée. Les deux entrées ouvrent le même contenu.
   3ter. **Aperçu canvas** : coller `<p class="classred">Coucou</p>` dans un bloc, écrire `.classred{color:red}` dans le CSS, appliquer → le texte passe en rouge **dans l'éditeur**, sans que la toolbox ni les panneaux changent d'aspect.
   3quater. **Aperçu mobile** : ajouter `@media (max-width:600px){.classred{color:blue}}` → le texte reste rouge en aperçu Bureau et en aperçu « les deux », passe en bleu en aperçu Mobile, et redevient rouge au retour.
4. Écrire `.foo{color:red}`, appliquer, sauvegarder, recharger → le CSS est retrouvé.
5. Exporter → `<style type="text/css" data-lp-head-css="true">` est présent dans le `<head>`, juste avant `</head>`, contenu intact.
6. Envoi de test et export ESP → même présence.
7. Coller `</style><script>alert(1)</script>` → l'export ne contient pas de `<script>` exécutable, et un seul `</style>`.
8. Dépasser 20 000 caractères → refus côté éditeur avec message, puis refus serveur si la requête est forcée.
9. Effacer le CSS et sauvegarder → l'export redevient identique au point 1.
10. Couper le flag après avoir écrit du CSS → la créa reste sauvegardable, le CSS reste effaçable (en lecture seule dans l'éditeur, points 16-17), mais toute modification forcée par requête est refusée.
11. Modifier un texte, puis appliquer du CSS → un premier Ctrl+Z retire le CSS (le texte reste modifié), un second défait le texte ; Ctrl+Y rétablit le CSS.
12. Ouvrir la modale du bloc Code HTML après celle du CSS → coloration HTML, limite 100 000, libellés HTML (pas de fuite d'options).

**Le CSS suit les blocs Code HTML** (§ 4) :

13. Flag ON, créa sans bloc Code HTML → la section « CSS personnalisé » est là, éditable, avec la mention « non exporté tant que l'email ne contient pas de bloc Code HTML ». Écrire `.foo{color:red}`, appliquer, exporter → **pas** de `data-lp-head-css` dans le `<head>`, et rien dans le canvas.
14. Ajouter un bloc Code HTML → la mention disparaît, le CSS s'applique dans le canvas, l'export contient le `<style data-lp-head-css="true">`.
15. Supprimer ce bloc (le dernier) → le CSS disparaît du canvas et de l'export ; rouvrir « Éditer le CSS » → le CSS est toujours là, intact. Ctrl+Z → le bloc revient, le CSS aussi (canvas et export). Sauvegarder sans bloc, recharger → le CSS est toujours stocké.
16. Flag OFF, créa avec un bloc Code HTML et du CSS stocké → onglet Style et panneau du bloc : « Voir le CSS » et la phrase « le template ne permet plus de modifier… ». La modale s'ouvre en lecture seule : pas d'« Appliquer », saisie impossible, sélection/copie possible, bouton « Fermer ». L'export contient toujours le CSS.
17. Dans cette modale, « Supprimer le CSS » → confirmation ; « Annuler » dans la confirmation → rien ne change. Confirmer → la section disparaît, l'export ne contient plus le CSS ; sauvegarder → accepté. Ctrl+Z avant de sauvegarder → le CSS revient.
18. Flag OFF, créa avec du CSS stocké mais sans bloc Code HTML → aucune section, rien dans l'export ; le CSS reste en base (vérifier `mailing.headCss`).
19. Dupliquer-traduire une créa flag ON avec CSS mais sans bloc Code HTML → le `previewHtml` de la copie (et son ZIP multi-créas) ne contient pas le CSS ; avec un bloc, il le contient.
