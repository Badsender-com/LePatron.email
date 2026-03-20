# Plan : Scalabilité des providers IA

> Contexte : l'architecture actuelle supporte 4 providers (OpenAI, Mistral, Infomaniak, DeepL).
> Ce plan prépare l'ajout de N providers supplémentaires sans accumulation de dette technique.

---

## Problèmes identifiés

1. **Duplication OpenAI/Mistral/Infomaniak** — les 3 providers LLM partagent ~80% de code
2. **Conditionals frontend en dur** — `isDeepLProvider` dans `ai-features-tab.vue` ne scale pas
3. **Models statiques dans le controller** — `integration.controller.js` contient des données qui appartiennent aux classes providers
4. **Schema `config` de type `Mixed`** — contourne la validation Mongoose pour les configs spécifiques (ex: `productId` Infomaniak)

---

## 1. `BaseLLMProvider` — priorité haute, effort faible

Factoriser les 3 providers LLM en une classe commune :

```
BaseProvider
  └── AIProviderInterface
        ├── BaseLLMProvider              ← nouveau
        │     ├── OpenAIProvider         (surcharge: defaultModel, apiHost, options spécifiques)
        │     ├── MistralProvider        (surcharge: gestion dot-notation JSON)
        │     └── InfomaniakProvider     (surcharge: productId, pas de response_format)
        └── DeepLProvider                (reste à part — API fondamentalement différente)
```

Ajouter un 6e provider LLM devient alors trivial.

---

## 2. `getCapabilities()` sur les providers — priorité haute, effort moyen

Remplacer les conditionals frontend en dur par une API de capabilities déclarée dans chaque provider :

```js
// Dans chaque provider
getCapabilities() {
  return {
    supportsModelSelection: true,
    supportsFormality: false,
    requiresProductId: false,
  }
}
```

Le frontend lit les capabilities retournées par l'API — plus de logique spécifique par provider dans les composants Vue. Ajouter un provider avec des options custom ne touche plus au frontend.

---

## 3. Models statiques dans les providers, pas dans le controller — priorité moyenne, effort faible

Déplacer les fallback models de `integration.controller.js` vers chaque classe provider :

```js
getStaticModels() {
  return ['gpt-4o-mini', 'gpt-4o']
}
```

Le controller devient un proxy, pas un registre de données métier.

---

## 4. Schema `config` typé — priorité basse, effort moyen

Remplacer le type `Mixed` par une validation explicite par provider au moment de la création/update. Évite les bugs silencieux si un champ obligatoire (ex: `productId`) manque.

---

## Ce qu'on ne fait pas

- Pas de plugin system ou registry dynamique tant que les providers sont dans le même repo (over-engineering)
- Pas de refacto du factory pattern — il est déjà correct

---

## Ordre d'implémentation recommandé

| Priorité | Tâche | Impact | Effort |
|----------|-------|--------|--------|
| 1 | `BaseLLMProvider` | Réduit la duplication, facilite les nouveaux providers LLM | Faible |
| 2 | `getCapabilities()` + models dans les classes | Frontend stable, controller allégé | Moyen |
| 3 | Schema `config` typé | Qualité, pas urgence | Moyen |
