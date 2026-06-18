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
  Partiellement découpé dans `components/canvas/` (refactor 2026-06-17) :
  - `canvas/render.tsx` — helpers de rendu PURS : `shapeGeom` (géométrie de chaque forme),
    `glyphText`, `hexToRgba`, `curveRadius`, `FALLBACK_BBOX`, `buildElementDefs(el, bboxes)`
    (filtre d'ombre, dégradé, motif, masques de contour/knockout, path de courbe), et
    `renderElementContent({...})` (rendu du contenu d'un élément : texte knockout/enveloppé/
    normal+courbé, édition inline, image, forme avec contour intérieur/extérieur).
  - `canvas/smartGuides.ts` — `computeMoveSnap(...)` : fonction PURE qui calcule
    l'aimantation (alignement + espacement égal + voisins) et renvoie `{guidesX, guidesY,
    measurements, dx, dy}`. Le composant applique le résultat (états + `onNudge`).
  - `canvas/CanvasContextMenu.tsx` — menu contextuel (clic droit) présentationnel.
  - `canvas/SelectionHandles.tsx` — `ResizeRotateHandles` : les 8 poignées de
    redimensionnement + la rotation, partagées entre sélection unique et groupe (exporte
    aussi le type `ResizeHandle`). N'inclut pas le contour (bleu/rose gardé par l'appelant).
  - `canvas/GuidesOverlay.tsx` — overlay présentationnel des smart guides pendant le drag :
    lignes d'alignement (rouge) + doubles flèches d'espacement à badge (rose). Affiche
    seulement ce que `computeMoveSnap` a produit.
  Reste inline dans `Canvas.tsx` (~800 lignes) : la boucle `elements.map` (le `<g>` externe
  transform/rotation, les calculs de boîte de sélection, l'aiguillage vers
  `renderElementContent` et les poignées), et les gestionnaires de gestes (mouse/touch :
  move/resize/rotate, marquee, drag de repères). Candidat suivant : isoler ces gestes dans
  un hook `useCanvasGestures`.
- `components/Sidebar.tsx` — panneau gauche : ajout d'éléments, alignement auto,
  upload de police, couleurs, propriétés de l'élément sélectionné, export.
- `types/index.ts` — `CompositionElement = TextElement | ShapeElement`, `CompositionState`.
- `App.tsx` — assemble le tout + logique d'export SVG/PNG/JPG + **layout responsive**
  (desktop = flex 3 colonnes, mobile = drawers coulissants + barre d'outils en bas).

## Modèle de données (`types/index.ts`)
- `BaseElement` : id, type, x, y, rotation, scaleX, scaleY, **skewX/skewY**, color, opacity,
  **blendMode** (16 modes), name/visible/locked (calque), **groupId**, **ombre**
  (shadowColor/Blur/OffsetX/OffsetY/Opacity), **contour** (strokeColor/strokeWidth/strokeAlign
  center|inside|outside), **noFill** (remplissage transparent), **gradient** (linear|radial,
  colors[], rotation), **pattern** (stripes|dots|grid|checker + color/background/scale/angle ;
  prioritaire sur gradient/couleur).
- `TextElement` : + text, fontSize, fontFamily, fontWeight, **fontWidth** (polices variables),
  letterSpacing, lineHeight, textAlign, textTransform, italic, **maxWidth** (wrapping), curve
  + curveType (arc|circle) + curveInvert, **bgEnabled/bgColor/bgPadding/bgRadius** (badge),
  **knockout** (lettres évidées), **textShadows[]** (ombres multiples), + props Lot 1 typo
  (writingMode, fontVariant, textDecoration*, wordSpacing).
- `ShapeElement` : type ∈ rect/circle/triangle/semicircle/quarter/ring/line/**hexagon/diamond/
  star/cross/arrow** + width, height.
- `ImageElement` : type 'image' + href (data URL embarqué) + width, height. Ajouté via `addImage`.
- `DocState` (partie historisée) : name, elements, backgroundColor, **backgroundGradient**,
  canvasWidth, canvasHeight, customColors, customFonts.
- Tout est centré sur (x, y) ; le SVG dessine autour de l'origine (ex. rect en -w/2,-h/2).
- L'**ordre du tableau `elements` = ordre de z-index** (dernier = premier plan).

## Conventions / pièges
- Les coordonnées canvas viennent de `getScreenCTM()` — ne pas mélanger avec coords écran.
  `getPositionFromClient(clientX, clientY)` est le helper unifié (mouse & touch).
- `bboxes` (getBBox) est recalculé via effet après chaque changement d'`elements` ; il y a
  un délai d'un render → les fallbacks `{-50,-25,100,50}` couvrent ce cas.
- Le scale est appliqué dans un `<g>` interne séparé pour que l'UI de sélection reste à
  taille constante.
- `tsc -b` **et** `eslint .` passent sans erreur ni warning (dette ESLint soldée le
  2026-06-17 : plus aucun `any`, deps d'effets complètes). Garder ce niveau : pas de
  nouveau `as any` ni de `eslint-disable` sans justification.

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

## Lots intermédiaires (synthèse, jusqu'au 2026-06-17)
Plusieurs gros lots ajoutés après la refonte de base. État actuel des fonctionnalités :
- **Groupes** : `groupId` partagé ; Ctrl+G groupe (≥2), Ctrl+Maj+G dégroupe. `expandGroups`
  étend toute sélection à ses groupes (clic, marquee, duplication régénère les groupIds).
- **Retournement** : `flipSelection('horizontal'|'vertical')` = inverse scaleX/scaleY.
- **Z-order incrémental** : en plus de bringToFront/sendToBack, `bringForward`/`sendBackward`
  (d'un cran, sans franchir les autres éléments sélectionnés).
- **Nudge clavier** : flèches = 1 px, Maj+flèches = 10 px (`nudgeSelection`, live + historique).
- **Copier la mise en forme** : `copyStyle`/`pasteStyle` (Ctrl+Alt+C / Ctrl+Alt+V). Copie les
  `COMMON_STYLE_PROPS` (couleur, opacité, blend, ombre, dégradé, motif, contour, noFill) ; pour
  un texte ajoute `TEXT_STYLE_PROPS` (typo + scale). Coller un style texte sur une forme omet le scale.
- **Copier/Coller éléments** : via `localStorage['bauhaus-clipboard']` (donc **inter-onglets**),
  Ctrl+C / Ctrl+X / Ctrl+V. Offset +24,+24 au collage, regénère les groupIds.
- **Remplissages avancés** : dégradés (par élément ET fond via `backgroundGradient`), motifs
  (rayures/points/grille/damier), contour avec alignement, `noFill` (contour seul / texte évidé).
- **Images** : import PNG/JPG/SVG (`handleImportImage` → data URL → `addImage`), dimensionnées
  pour tenir dans 60 % du canvas. Rendues comme `<image>` dans le Canvas.
- **Effets texte** : knockout (lettres découpées laissant voir le fond, filtre SVG), ombres
  multiples (`textShadows[]`), badge de fond, courbure arc/cercle.
- **Sauvegarde projet** : export/import `.json` portable (`handleExportProject`/`handleImportProject`,
  `loadProject`) — polices embarquées en data URL. Distinct des exports SVG/PNG/JPG.
- **Grille & magnétisme** : `grid {show, snap, size}` persisté dans `localStorage['bauhaus-grid']`.
  Snap-to-grid pendant drag/resize (désactivé si Maj). Barre dédiée en bas à gauche (desktop).
- **Repères manuels (guides)** : `guides {x:number[], y:number[]}` en coords canvas, persistés
  (`localStorage['bauhaus-guides']`), **déplaçables** (drag sur le Canvas) et **aimantants**.
  Ajout/effacement via la barre grille (desktop) et la MobileToolbar.
- **Zoom** : Ctrl+molette (zoom à la souris), Ctrl + / Ctrl - / Ctrl 0, boutons +/−. Plage 0.1→5.
- **Menu contextuel** (clic droit Canvas) : grouper/dégrouper, z-order, copier/coller (+ style),
  dupliquer, supprimer.
- **Panneau d'aide** des raccourcis (`ShortcutsHelp`, touche `?`).
- **Canvas auto** : `autoCanvasSize` (ResizeObserver) ajuste la taille pour remplir l'espace ;
  désactivé dès qu'on choisit un format/template/import explicite (`handleSetCanvasSize`).
- **Persistance** : localStorage **debouncé à 500 ms** (plus de réécriture à chaque frame).

## Typographie — Lot 1 (ajout 2026-06-16)
Implémentation du « Lot 1 » de `TYPOGRAPHY_ROADMAP.md`. Nouvelles props sur `TextElement` :
`writingMode` (horizontal/vertical), `fontVariant` (small-caps), `textDecoration`
(underline/line-through/overline) + `textDecorationStyle` + `textDecorationColor`,
`wordSpacing`. Rendues dans les **deux** chemins de `Canvas` (`<text>` et `foreignObject`),
ajoutées à `copyStyle`, contrôlées dans la barre de style + sliders de la Sidebar. Le texte
courbé (`curve`) est désactivé quand `writingMode === 'vertical'`. Prochain : Lot 2.

## Dette restante / idées (mis à jour 2026-06-17)
- Coalescing d'historique sur les inputs number/text (1 entrée par caractère actuellement).
- Export Google Fonts dépend d'un fetch réseau (CORS) — peut retomber sur système hors-ligne.
- Pas de redimensionnement multi (resize n'agit qu'en sélection unique).
- Mobile : pinch-to-zoom, poignées plus grosses, marquee tactile, double-tap pour éditer.
- Le bundle JS approche 370 ko (Canvas.tsx ~1580 lignes) — découpage possible si ça grossit.
- ~~copier/coller inter-onglets~~ ✓ (clipboard via localStorage) ; ~~localStorage à chaque
  frame~~ ✓ (debounce 500 ms) ; ~~calques nommés~~ ✓ (renommage).

## Décisions de design à respecter
- Esthétique sobre « pro » (gris/blanc, accents bleus #3b82f6, magenta pour guides,
  ambre #f59e0b pour distribution égale).
- Tout reste local/offline. Ne pas introduire de backend sans demander.
