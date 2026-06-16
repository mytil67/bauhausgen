# CLAUDE.md — Bauhaus Visual Generator

Mémo de travail pour Claude Code. À lire au début de chaque session.

## Vue d'ensemble
Éditeur graphique vectoriel (SVG) dans le navigateur pour composer des affiches/visuels
inspirés du Bauhaus. 100 % côté client, aucun backend. État persisté dans `localStorage`.

L'utilisateur (Julien) **adore ce projet** — on est en phase « corriger & améliorer ».
Réponses et UI en **français**.

## Stack
- React 19 + TypeScript (~6.0) + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite`, pas de `tailwind.config` — config dans le CSS)
- `lucide-react` (icônes), `uuid` (ids)

## Commandes
```bash
npm run dev      # serveur de dev Vite
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm run preview  # prévisualise le build
```

## Architecture (src/)
- `hooks/useComposition.ts` — **source de vérité unique**. État `CompositionState`,
  persistance localStorage (clé `bauhaus-composition-state`), et toutes les actions
  (add/update/remove, align, distribute, z-order, couleurs, polices, export reset).
- `hooks/useIsMobile.ts` — détection responsive (< 768px) via `useSyncExternalStore`
  + `matchMedia`. Utilisé par `App.tsx` pour basculer entre layout desktop et mobile.
- `components/Canvas.tsx` — rendu SVG + interactions souris **et tactiles** (déplacer/
  redimensionner/pivoter via poignées), cadre de sélection, et **smart guides type
  Figma/Canva** pendant le drag. Le plus gros et le plus délicat des fichiers.
- `components/Sidebar.tsx` — panneau gauche : ajout d'éléments, alignement auto,
  upload de police, couleurs, propriétés de l'élément sélectionné, export.
- `types/index.ts` — `CompositionElement = TextElement | ShapeElement`, `CompositionState`.
- `App.tsx` — assemble le tout + logique d'export SVG/PNG/JPG + **layout responsive**
  (desktop = flex 3 colonnes, mobile = drawers coulissants + barre d'outils en bas).

## Modèle de données
- `BaseElement` : id, type, x, y, rotation, scaleX, scaleY, color, opacity.
- `TextElement` : + text, fontSize, fontFamily, fontWeight.
- `ShapeElement` (rect/circle/triangle) : + width, height.
- Tout est centré sur (x, y) ; le SVG dessine autour de l'origine (ex. rect en -w/2,-h/2).
- L'**ordre du tableau `elements` = ordre de z-index** (dernier = premier plan).

## Conventions / pièges
- Les coordonnées canvas viennent de `getScreenCTM()` — ne pas mélanger avec coords écran.
  `getPositionFromClient(clientX, clientY)` est le helper unifié (mouse & touch).
- `bboxes` (getBBox) est recalculé via effet après chaque changement d'`elements` ; il y a
  un délai d'un render → les fallbacks `{-50,-25,100,50}` couvrent ce cas.
- Le scale est appliqué dans un `<g>` interne séparé pour que l'UI de sélection reste à
  taille constante.
- `tsc -b` passe. `eslint` : voir « Problèmes connus ».

## État (mis à jour 2026-06-15)
Refonte effectuée — build/lint/tsc OK. Ce qui a été fait :
- **Modèle** : `selectedId` → `selectedIds: string[]` (multi-sélection). `customFonts`
  est désormais `CustomFont[] = {name, data(dataURL)}`. État « document » = `DocState`.
- **Undo/Redo** : historique (max 50) dans `useComposition` via `commit`/`beginHistory`/
  `live`. Gestes canvas (drag/resize/rotate) et sliders sidebar = 1 entrée par geste
  (begin au début + maj `live` ensuite). Raccourcis Ctrl+Z / Ctrl+Maj+Z / Ctrl+Y.
- **Multi-sélection** : Maj+clic (toggle), Ctrl+A (tout), Échap (désélection), **cadre de
  sélection** (rubber-band) en tirant sur le fond — Maj fusionne ; clic simple désélectionne
  (`selectMany`, hit-test par croisement de boîtes, rotation ignorée). Déplacement
  de groupe.
- **Alignement (refondu, type Photoshop/Canva)** : basé sur les **bords réels** des
  éléments (et plus les centres). Les boîtes englobantes sont mesurées dans `Canvas`
  (`getBBox`) et remontées via `onBoundsChange` → `boundsRef` dans `App`, passées à
  `alignElements(dir, ids, bounds, toPage)` / `distributeElements(axis, ids, bounds)`.
  Helper `getBox(el, bounds)` = bords absolus (rotation ignorée). Cible **Sélection**
  (≥2, boîte de groupe) ou **Page** (canvas) via bascule dans la Sidebar. Distribution =
  espacement égal entre bords (≥3 éléments). UI = grille d'icônes lucide `Align*Vertical`
  (gauche/centre/droite) et `Align*Horizontal` (haut/milieu/bas).
- **Dupliquer** : Ctrl+D / bouton (offset +20,+20).
- **Rotation** : poignée circulaire au-dessus de la sélection (Maj = pas de 15°).
- **Polices au reload** : data URL persistée + ré-enregistrement `FontFace` au montage.
- **Export** : UI de sélection retirée (classe `export-ignore`), `@font-face` custom
  embarqués + tentative de fetch des Google Fonts, `await document.fonts.ready` avant raster.

## Smart guides (refondus, type Figma/Canva) — `Canvas.tsx`, branche `move` en sélection unique
Pipeline pendant le déplacement (1 seul élément) :
1. **Aimantation d'alignement** : ancres gauche/centre/droite (resp. haut/centre/bas) du
   bord déplacé vers les cibles = bords/centres des autres + bords/centre du canvas
   (seuil `SNAP_DISTANCE = 8`). `xSnapped`/`ySnapped` mémorisent si un axe a accroché.
2. **Voisins** : pour chaque côté, l'élément le plus proche QUI SE RECOUVRE sur l'axe
   perpendiculaire (sinon l'espace n'a pas de sens).
3. **Aimantation d'espace égal (par chaîne)** : on construit la « rangée » = D + voisins
   qui se recouvrent, triée. Trois cas (tolérance `EQ = SNAP*1.5`) : centré entre 2 voisins ;
   reproduire l'écart de la paire à gauche (`L.left - LL.right`) ; idem à droite. Quand ça
   matche, on aimante D ET on stocke les segments égaux (`equalSegH/V`) à dessiner.
4. **Lignes d'alignement** : rouge `#f43f5e`, nettes, pleine largeur/hauteur.
5. **Mesures = doubles flèches** : si espace égal détecté → flèches roses `#ec4899` sur
   TOUS les écarts égaux (l'écart en cours + l'écart de référence) pour comparer ; sinon →
   flèche bleue `#2563eb` vers le voisin le plus proche (ou le bord du canvas). Pastille
   décalée (au-dessus pour H, à droite pour V).
Multi-sélection = déplacement de groupe sans guides. Resize = aimantation simple + guides.

## Pièges introduits par la refonte
- `updateElement` = AVEC historique ; `updateElementLive` = SANS. Pendant un geste,
  toujours `beginHistory()` une fois puis `*Live`.
- Les poignées de resize/rotation ne s'affichent qu'en **sélection unique**
  (`selectedIds.length === 1`). Le multi n'a que le contour + déplacement groupé.
- Le déplacement de groupe désactive smart guides/mesures (seulement en sélection unique).

## Ajouts (session du 2026-06-15, lot 2)
- **Modèle** : `BaseElement` a `name?`, `visible?`, `locked?`. Nouveaux `ShapeType` :
  `semicircle`, `quarter`, `ring` (path evenodd), `line` (rect fin). Rendus dans `Canvas`
  (sélecteur bbox inclut `path`). Invisibles non rendus/non sélectionnables ; verrouillés
  non manipulables au canvas ni au marquee (mais sélectionnables via les calques).
- **Panneau de calques** (`components/LayersPanel.tsx`, à droite) : liste affichée
  premier-plan→arrière-plan (`[...elements].reverse()`), **réordonnancement par glisser**
  (HTML5 draggable → `reorderElements(orderedIds)` en ordre tableau = arrière→avant),
  renommer (double-clic), œil (visible), cadenas (locked), supprimer.
- **Copier/Coller** : `clipboardRef` dans le hook ; `copySelection`/`pasteClipboard` ;
  raccourcis Ctrl+C / Ctrl+X / Ctrl+V dans `App`.
- **Palettes Bauhaus** + **formats de canvas** (`setCanvasSize`) + **templates**
  (`src/templates.ts`, `loadTemplate`) dans la Sidebar. `applyColor(color, ids)` =
  couleur sur sélection sinon fond (1 entrée d'historique).

## Édition de texte inline (Canvas)
Double-clic sur un texte → `editingId` ; on rend un `<input>` dans un `<foreignObject>`
placé dans le groupe interne (hérite translate/rotate/scale). `onChange` → `onUpdateLive`
(pas d'historique par frappe ; `beginHistory` au démarrage de l'édition). Sortie sur
Entrée/Échap/blur. Les poignées sont masquées pendant l'édition (`editingId !== el.id`).

## Version mobile (ajout 2026-06-16)
Layout responsive piloté par `useIsMobile` (breakpoint 768px).

**Desktop** (inchangé) : flex 3 colonnes — Sidebar | Canvas | LayersPanel.

**Mobile** :
- **Header** : hamburger (ouvre Sidebar en drawer gauche) + titre + icône calques
  (ouvre LayersPanel en drawer droit). Drawers avec backdrop semi-transparent + bouton ✕.
- **Canvas** : occupe tout l'espace central, zoom en haut à droite, padding réduit (`p-4`).
- **Barre d'outils en bas** : Annuler / Rétablir / bouton **+** central (menu popup
  d'ajout rapide : Texte, Rect, Cercle, Triangle) / Supprimer / Export PNG.
  Classe `.safe-area-bottom` pour les appareils à encoche.
- **Touch** : `onTouchStart` sur chaque élément SVG → sélection + drag.
  `handleCanvasTouchStart` sur le fond → désélection. Touch move/end branchés sur le
  même pipeline que les mouse events via objet synthétique `{ clientX, clientY }`.
  `touch-action: none` sur le conteneur canvas pour bloquer le scroll/zoom navigateur.
- **Viewport** : `maximum-scale=1, user-scalable=no` dans `index.html`.
  `touch-action: manipulation` sur les boutons (CSS).

**Limitations actuelles mobile** :
- Pas de pinch-to-zoom (zoom uniquement via boutons +/−).
- Pas de marquee (rubber-band) tactile, seulement tap-to-select.
- Les poignées de resize/rotation ne sont pas adaptées aux doigts (taille inchangée).
- Pas de double-tap pour édition inline de texte.

## Typographie — Lot 1 (ajout 2026-06-16)
Implémentation du « Lot 1 » de `TYPOGRAPHY_ROADMAP.md`. Nouvelles props sur `TextElement` :
`writingMode` (horizontal/vertical), `fontVariant` (small-caps), `textDecoration`
(underline/line-through/overline) + `textDecorationStyle` + `textDecorationColor`,
`wordSpacing`. Rendues dans les **deux** chemins de `Canvas` (`<text>` et `foreignObject`),
ajoutées à `copyStyle`, contrôlées dans la barre de style + sliders de la Sidebar. Le texte
courbé (`curve`) est désactivé quand `writingMode === 'vertical'`. Prochain : Lot 2.

## Dette restante / idées
- Coalescing d'historique sur les inputs number/text (1 entrée par caractère actuellement).
- Export Google Fonts dépend d'un fetch réseau (CORS) — peut retomber sur système hors-ligne.
- Pas de redimensionnement multi, pas de calques nommés, pas de copier/coller inter-onglets.
- `localStorage` réécrit à chaque changement de `doc` (mineur).
- Mobile : pinch-to-zoom, poignées plus grosses, marquee tactile, double-tap pour éditer.

## Décisions de design à respecter
- Esthétique sobre « pro » (gris/blanc, accents bleus #3b82f6, magenta pour guides,
  ambre #f59e0b pour distribution égale).
- Tout reste local/offline. Ne pas introduire de backend sans demander.
