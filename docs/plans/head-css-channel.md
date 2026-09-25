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
  → injectHeadCss(...)         (dernière étape de exportHTML)
  → <style> dans le <head>     (ZIP, envoi de test, ESP, previewHtml)
```

Au retour, le champ est renvoyé avec le contenu à la sauvegarde. Le serveur ne l'écrit **que s'il est présent dans la requête** : un bundle éditeur plus ancien, ou la route de métadonnées, ne doit pas effacer une feuille stockée.

## 4. Décisions

| Sujet             | Décision                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portée            | Par créa. Le CSS accompagne l'email, pas le template                                                                                                                                                                                                                                                          |
| Flag              | **Réutilise `htmlBlockEnabled`.** Le CSS existe pour styler du markup collé dans un bloc Code HTML ; un client sans ce bloc n'aurait rien à styler et gagnerait seulement le pouvoir de restyler tout l'email hors design system. Découpler plus tard est un ajout, pas une migration                         |
| Limite            | 20 000 caractères. Une feuille est bien plus compacte que le markup qu'elle style ; la copie stockée, doublée par `previewHtml`, reste négligeable contre la limite de 16 Mo par document                                                                                                                     |
| Surface d'édition | La modale CodeMirror du bloc Code HTML, rendue paramétrable (mode, libellés, borne) plutôt que dupliquée                                                                                                                                                                                                      |
| Emplacement       | **Deux points d'entrée, une seule valeur** : bas de l'onglet **Style** global (où le CSS appartient logiquement), et un second bouton dans le panneau du bloc Code HTML (où on le cherche réellement, juste après avoir collé du markup). Une phrase sous ce bouton rappelle que la portée est l'email entier |
| Constantes        | `packages/shared/head-css/constants.js`, requis par l'éditeur **et** le serveur. Le bloc Code HTML duplique les siennes avec un test de synchro parce que le serveur ne doit pas dépendre d'un bundle navigateur ; ici les deux côtés partagent déjà un module                                                |

## 5. Sécurité

- **`</style` dans la charge utile est neutralisé** (`<\/style`). Sans ça, un CSS collé pourrait fermer l'élément et ouvrir du markup arbitraire dans l'export. Testé sur toutes les casses.
- **Le flag est appliqué côté serveur**, pas seulement dans l'UI : la route accepte des requêtes écrites à la main.
- **Couper le flag après coup** laisse la créa sauvegardable et le CSS effaçable, mais refuse toute écriture nouvelle — un super-admin ne doit pas enfermer un auteur hors de son propre email.
- Le CSS **n'est pas assaini**. C'est assumé, et cohérent avec le bloc Code HTML : la promesse est la fidélité. Le garde-fou est le flag, pas un filtre.

## 6. Limites connues

- **Le CSS n'apparaît pas dans le canvas de l'éditeur.** Il est dans l'export et dans l'aperçu serveur, mais la zone d'édition ne le reflète pas. Pour du CSS responsive, l'effet n'est de toute façon visible qu'en bascule mobile.
- **La bascule mobile ne le pilotera pas** tant qu'on n'aura pas étendu `badsender-screen-preview.js`, qui ne réécrit les `@media` que de la feuille dont `stylesheet.title === 'template-stylesheet'`. À traiter quand le Block Builder en dépendra.
- **`he.encode` côté serveur** encode les non-ASCII en entités décimales, y compris dans le `<style>`. Un `content: "é"` ou un commentaire accentué en souffrira. Même limite que le bloc Code HTML, documentée là-bas.

## 7. Recette manuelle

Non-régression d'abord, le reste ensuite.

1. **Flag OFF, aucune créa touchée** : exporter un email sans CSS → le ZIP est binairement identique à celui d'avant la branche.
2. Flag OFF → la section « CSS personnalisé » n'apparaît pas dans l'onglet Style.
3. Flag ON → la section apparaît ; le bouton ouvre la modale en coloration CSS.
   3bis. Sélectionner un bloc Code HTML → le panneau offre « Éditer le CSS de l'email » sous le bouton HTML, avec la mention de portée. Les deux entrées ouvrent le même contenu.
4. Écrire `.foo{color:red}`, appliquer, sauvegarder, recharger → le CSS est retrouvé.
5. Exporter → `<style type="text/css" data-lp-head-css="true">` est présent dans le `<head>`, juste avant `</head>`, contenu intact.
6. Envoi de test et export ESP → même présence.
7. Coller `</style><script>alert(1)</script>` → l'export ne contient pas de `<script>` exécutable, et un seul `</style>`.
8. Dépasser 20 000 caractères → refus côté éditeur avec message, puis refus serveur si la requête est forcée.
9. Effacer le CSS et sauvegarder → l'export redevient identique au point 1.
10. Couper le flag après avoir écrit du CSS → la créa reste sauvegardable, le CSS reste effaçable, mais toute modification est refusée.
11. Un seul pas d'annulation après « Appliquer ».
12. Ouvrir la modale du bloc Code HTML après celle du CSS → coloration HTML, limite 100 000, libellés HTML (pas de fuite d'options).
