# Roadmap Améliorations — Bauhaus Visual Generator

Analyse du 2026-06-19. Plan d'amélioration en étapes progressives.

---

## Étape 1 — Corrections de bugs et nettoyage ✧ Priorité haute

- [ ] **1.1** `handleExportProject` n'exporte pas `backgroundGradient` → perdu au save/load JSON (`App.tsx` ~l.250)
- [ ] **1.2** `GuidesOverlay` : branche `kind === 'equal'` vs `'spacing'` jamais différenciée visuellement (`GuidesOverlay.tsx` l.32)
- [ ] **1.3** `onInteractionChange` dans `SidebarProps` jamais utilisé → supprimer l'interface morte (`Sidebar.tsx`)
- [ ] **1.4** `blendMode` : seulement 5/16 modes exposés dans l'UI → ajouter les 11 manquants (`Sidebar.tsx`)
- [ ] **1.5** `loadInitial()` pas dans un initializer `useState` → re-parse inutile au HMR (`useComposition.ts` l.110)
- [ ] **1.6** Duplication de constantes (palettes, polices) entre `Sidebar` et `MobileToolbar` → extraire dans un fichier partagé
- [ ] **1.7** `void scaleX; void scaleY;` → destructure idiomatique avec `_` prefix (`useComposition.ts`)

## Étape 2 — Améliorations UX rapides ✧ Priorité moyenne

- [ ] **2.1** Indicateur visuel pour éléments verrouillés sur le canvas (icône cadenas ou opacité réduite)
- [ ] **2.2** Modale de confirmation custom au lieu de `window.confirm()` (templates, clear)
- [ ] **2.3** Knockout ignoré sur texte courbé → avertissement dans l'UI
- [ ] **2.4** Exposer les 16 blend modes (fait en 1.4 si regroupé)
- [ ] **2.5** Tooltip sur undo/redo indiquant l'action à annuler

## Étape 3 — Nouvelles fonctionnalités ✧ Priorité moyenne

- [ ] **3.1** Zoom to fit (Ctrl+1) / Zoom to selection (Ctrl+2)
- [ ] **3.2** Coller une image depuis le presse-papier système (Ctrl+V détecte `clipboardData.items`)
- [ ] **3.3** Éditeur inline multi-ligne (`<textarea>` dans `foreignObject`)
- [ ] **3.4** Prévisualisation des templates avant chargement
- [ ] **3.5** Redimensionnement multi-sélection (scale proportionnel du groupe)

## Étape 4 — Refactoring et performance ✧ Priorité basse

- [ ] **4.1** Découper `Sidebar.tsx` en sous-composants (AppearanceSection, TypographySection, etc.)
- [ ] **4.2** Extraire `useResizeGesture` / `useRotateGesture` de `useCanvasGestures.ts`
- [ ] **4.3** Code-splitting : lazy import des sections lourdes
- [ ] **4.4** Limiter la taille des polices custom uploadées (avertissement > 2 Mo)

## Étape 5 — Mobile ✧ Priorité basse

- [ ] **5.1** Pinch-to-zoom
- [ ] **5.2** Poignées de resize/rotation plus grosses (touch-friendly)
- [ ] **5.3** Double-tap pour édition inline de texte
- [ ] **5.4** Parité des fonctions entre MobileToolbar et Sidebar desktop
