# LePatron Design System

Ce document définit les standards de design pour les nouvelles fonctionnalités de LePatron.email, alignés sur l'identité visuelle du site marketing.

---

## 1. Couleurs

### Couleurs principales

| Nom | Hex | Usage |
|-----|-----|-------|
| **Primary Dark** | `#0d2b3e` | Titres, texte principal, header |
| **Primary** | `#1a4a5e` | Fonds sombres, éléments secondaires |
| **Accent Teal** | `#2dd4bf` | Liens, éléments interactifs |
| **Accent Coral** | `#f04e23` | CTA principaux, alertes, badges importants |
| **Accent Orange** | `#ff8c42` | Warnings, sévérité "Important" |

### Couleurs neutres

| Nom | Hex | Usage |
|-----|-----|-------|
| **Gray 900** | `#1a1a2e` | Texte principal |
| **Gray 600** | `#6b7280` | Texte secondaire |
| **Gray 400** | `#9ca3af` | Texte désactivé, placeholders |
| **Gray 200** | `#e5e7eb` | Bordures |
| **Gray 100** | `#f3f4f6` | Fonds alternés |
| **Gray 50** | `#f9fafb` | Fonds de cards |
| **White** | `#ffffff` | Fond principal |

### Couleurs sémantiques

| Nom | Hex | Usage |
|-----|-----|-------|
| **Success** | `#10b981` | Validations, "Résolu" |
| **Warning** | `#f59e0b` | Alertes, "Important" |
| **Error** | `#ef4444` | Erreurs, "Bloquant", suppression |
| **Info** | `#3b82f6` | Informations, "Info" |

---

## 2. Typographie

### Police

```css
font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Échelle typographique

| Nom | Taille | Poids | Usage |
|-----|--------|-------|-------|
| **Heading 1** | 24px | 600 | Titres de page |
| **Heading 2** | 18px | 600 | Titres de section |
| **Heading 3** | 16px | 600 | Titres de cards |
| **Body** | 14px | 400 | Texte courant |
| **Body Small** | 13px | 400 | Texte secondaire |
| **Caption** | 12px | 400 | Labels, metadata |
| **Micro** | 11px | 500 | Badges, tags |

---

## 3. Espacements

Basé sur une échelle de 4px :

| Nom | Valeur | Usage |
|-----|--------|-------|
| **xs** | 4px | Espacement minimal |
| **sm** | 8px | Entre éléments proches |
| **md** | 12px | Padding interne cards |
| **lg** | 16px | Marges entre sections |
| **xl** | 24px | Séparations majeures |
| **2xl** | 32px | Espacement de page |

---

## 4. Composants

### 4.1 Boutons

#### Bouton primaire
```css
.btn-primary {
  background: linear-gradient(135deg, #1a4a5e 0%, #0d2b3e 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 13px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(13, 43, 62, 0.3);
}
```

#### Bouton secondaire
```css
.btn-secondary {
  background: transparent;
  color: #6b7280;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-secondary:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}
```

#### Bouton icône
```css
.btn-icon {
  background: transparent;
  color: #6b7280;
  padding: 6px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-icon:hover {
  background: #f3f4f6;
  color: #1a4a5e;
}
.btn-icon--danger:hover {
  background: #fef2f2;
  color: #ef4444;
}
```

### 4.2 Cards

Style flat, pas d'ombres portées. Bordures fines pour délimiter.

```css
.card {
  background: white;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 14px;
  transition: border-color 0.15s ease;
}
.card:hover {
  border-color: #d1d5db;
}
```

#### Cards avec état (commentaires)

Les cards de commentaires n'utilisent **pas de bordure de couleur sur le côté gauche**. La distinction se fait par :
- **Badges** dans le header (Résolu, Important, Bloquant)
- **État replié/déplié** pour les commentaires résolus
- **Fond grisé** pour les commentaires résolus (`#f9fafb`)

### 4.3 Chips / Pills

Design flat, sans bordure. Fond léger au repos, fond foncé quand sélectionné.

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
}
.chip:hover {
  background: #e5e7eb;
}
.chip--selected {
  background: #0d2b3e;
  color: white;
}
```

### 4.4 Inputs

```css
.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s ease;
  background: #f9fafb;
}
.input:focus {
  outline: none;
  border-color: #2dd4bf;
  background: white;
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
}
.input::placeholder {
  color: #9ca3af;
}
```

### 4.5 Badges

Forme pill (border-radius arrondi), fond léger, pas de bordure.

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}
.badge--info {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}
.badge--warning {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
}
.badge--error {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}
.badge--success {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}
```

### 4.6 Toolbar Badge (compteur)

Badge compact aligné horizontalement à côté de l'icône, sans ombre.

```css
.toolbar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f04e23;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  cursor: pointer;
}
```

### 4.7 Indicateur flottant

Pill fixe en bas à droite pour les compteurs globaux (ex: commentaires non résolus). Se masque quand le panneau associé est ouvert.

```css
.floating-indicator {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0d2b3e;
  color: white;
  padding: 12px 18px;
  border-radius: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(13, 43, 62, 0.3);
  font-weight: 500;
  font-size: 14px;
  z-index: 1000;
}
```

---

## 5. Icônes

Utiliser **Font Awesome** (déjà intégré) avec les conventions suivantes :

| Action | Icône | Code |
|--------|-------|------|
| Répondre | 💬 | `fa-reply` |
| Résoudre | ✓ | `fa-check` |
| Modifier | ✏️ | `fa-pencil` |
| Supprimer | 🗑️ | `fa-trash-o` |
| Aller au bloc | 🔗 | `fa-external-link` |
| Info | ℹ️ | `fa-info-circle` |
| Warning | ⚠️ | `fa-exclamation-triangle` |
| Bloquant | 🚫 | `fa-ban` |
| Général | 💬 | `fa-comment-o` |
| Design | 🎨 | `fa-paint-brush` |
| Contenu | 📝 | `fa-file-text-o` |

---

## 6. Animations et transitions

### Durées

| Nom | Durée | Usage |
|-----|-------|-------|
| **Fast** | 150ms | Hovers, toggles |
| **Normal** | 200ms | Transitions générales |
| **Slow** | 300ms | Apparitions, modals |

### Easing

```css
--ease-out: cubic-bezier(0.33, 1, 0.68, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Exemple d'animation d'apparition

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-slide-in {
  animation: slideIn 0.3s var(--ease-out);
}
```

---

## 7. Format de dates

Utiliser des dates relatives pour une meilleure UX :

| Condition | Affichage |
|-----------|-----------|
| < 1 minute | "À l'instant" |
| < 60 minutes | "Il y a X min" |
| < 24 heures | "Il y a Xh" |
| < 7 jours | "Il y a X jours" |
| > 7 jours | "12 jan." ou "12 jan. 2025" |

---

## 8. Patterns d'interaction

### Commentaires résolus / non-résolus

- Les commentaires **non-résolus** sont affichés en premier, dépliés
- Les commentaires **résolus** sont affichés en dessous, **repliés** par défaut
  - Header visible : auteur, date, badge "Résolu", catégorie, icône chevron
  - Clic sur le commentaire → déplie (texte, actions, réponses)
  - Fond grisé (`Gray 50`) pour distinction visuelle

### Actions sur les commentaires

Disposées en ligne horizontale, icônes uniquement :
- **Répondre** (`fa-reply`) — à gauche
- **Résoudre** (`fa-check`) — à gauche
- **Éditer** (`fa-pencil`) — à gauche (auteur uniquement)
- **Supprimer** (`fa-trash-o`) — à gauche (auteur/admin)
- **Aller au bloc** (`fa-external-link`) — aligné à droite (`margin-left: auto`)

### Visibilité des compteurs

Deux indicateurs complémentaires pour les commentaires non résolus :
1. **Badge toolbar** : pill coral alignée horizontalement à côté du bouton Comments
2. **Indicateur flottant** : pill en bas à droite, visible quand le panneau est fermé, chargé dès l'initialisation via un appel API léger (`/comments/unresolved-count`)

---

## 9. Responsive

L'éditeur étant principalement desktop, les breakpoints ne sont pas prioritaires. Cependant, la sidebar doit rester fonctionnelle jusqu'à 300px de largeur minimum.

---

## 10. Accessibilité

- Contraste minimum : 4.5:1 pour le texte
- Focus visible sur tous les éléments interactifs
- Attributs `title` ou `aria-label` sur les boutons icônes
- Taille de clic minimum : 44x44px pour les actions tactiles

---

## Changelog

| Date | Version | Changements |
|------|---------|-------------|
| 2026-02-02 | 1.0 | Création initiale - Feature Commentaires |
| 2026-02-03 | 1.1 | Design flat : suppression ombres/bordures lourdes, chips sans bordure, cards avec border fine, badges pill, commentaires résolus repliés, indicateur flottant, toolbar badge horizontal |
