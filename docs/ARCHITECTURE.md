# Architecture — Bauhaus Visual Generator

Documentation technique. Voir le `README.md` pour l'usage et `CLAUDE.md` pour les notes
de travail / la dette technique.

## 1. Vue d'ensemble

Application **SPA 100 % client**. Aucune API, aucun backend. L'état complet de la
composition vit en mémoire React et est mis en cache dans `localStorage`. Le rendu est
fait en **SVG** (et non Canvas2D), ce qui permet un export vectoriel natif et une
manipulation fine des éléments.

```
index.html
 └─ src/main.tsx
     └─ App.tsx ............... assemblage + logique d'export
         ├─ useComposition() .. état + actions (source de vérité)
         ├─ <Sidebar/> ........ panneau de contrôle (gauche)
         └─ <Canvas/> ......... scène SVG + interactions souris
```

## 2. Modèle de données (`src/types/index.ts`)

```ts
BaseElement   = { id, type, x, y, rotation, scaleX, scaleY, color, opacity }
TextElement   = BaseElement + { text, fontSize, fontFamily, fontWeight }
ShapeElement  = BaseElement + { width, height }          // rect | circle | triangle
CompositionElement = TextElement | ShapeElement

CompositionState = {
  elements: CompositionElement[]   // l'ordre = z-index (dernier = premier plan)
  selectedId: string | null
  backgroundColor: string
  canvasWidth, canvasHeight: number
  customColors: string[]           // max 16, mémorisées
  customFonts: string[]            // noms des polices importées
}
```

**Conventions géométriques**
- Chaque élément est positionné par son **centre** `(x, y)`.
- Le SVG dessine autour de l'origine locale : un rect est `x=-w/2, y=-h/2`, un cercle
  `cx=0, cy=0`, etc. La translation `translate(x, y)` place ensuite l'élément.
- Transform en deux couches : `translate + rotate` sur le `<g>` externe, `scale` sur un
  `<g>` interne. Cela permet de garder l'UI de sélection à taille constante
  (non affectée par le scale).

## 3. État & actions (`src/hooks/useComposition.ts`)

Hook unique qui détient `CompositionState` via `useState`, l'hydrate depuis
`localStorage` (clé `bauhaus-composition-state`) et le re-persiste à chaque changement
via `useEffect`.

Actions exposées :

| Action | Rôle |
|--------|------|
| `addElement(type)` | crée un élément centré, le sélectionne |
| `updateElement(id, partial)` | merge partiel sur un élément |
| `removeElement(id)` | supprime + désélectionne si besoin |
| `selectElement(id)` | sélection |
| `setBackgroundColor`, `saveColor` | fond + mémorisation de couleurs (max 16) |
| `addCustomFont(name)` | enregistre le nom d'une police importée |
| `bringToFront`, `sendToBack` | z-order (réordonne le tableau) |
| `alignElements(dir)` | aligne sur left/center/right/top/middle/bottom |
| `distributeElements(axis)` | espacement régulier horizontal/vertical |
| `clearCanvas()` | reset (avec confirmation) |

> ⚠️ **Limitation actuelle** : `alignElements`/`distributeElements` raisonnent sur
> « toute la sélection », mais il n'y a pas de multi-sélection. Voir `CLAUDE.md` §dette.

## 4. Canvas & interactions (`src/components/Canvas.tsx`)

C'est le composant le plus riche. Responsabilités :

1. **Rendu** des éléments (`<text>`, `<rect>`, `<circle>`, `<polygon>`).
2. **Sélection** : clic sur un élément ; clic sur le fond désélectionne.
3. **Déplacement** : `mousedown` → mode `move`, suivi via listeners `window`.
4. **Redimensionnement** : 8 poignées (`nw n ne e se s sw w`). Le texte change d'échelle
   (`scaleX/scaleY`), les formes changent `width/height`, le cercle garde son ratio.
5. **Coordonnées** : conversion écran → SVG via `getScreenCTM()`.
6. **Bounding boxes** : `getBBox()` de chaque élément est mis en cache dans `bboxes`
   (recalculé par effet après changement d'`elements`/sélection). Sert au snapping,
   aux poignées et aux mesures. Fallback `{-50,-25,100,50}` en attendant le 1er calcul.

### Smart guides (snapping)
Pendant un déplacement (élément seul ou groupe), on collecte des cibles de snap :
- bords et centre du canvas (`0`, `w/2`, `w` ; idem vertical) ;
- pour chaque autre élément (non sélectionné) : centre, bord gauche/droit (et haut/bas).

On retient la cible la plus proche sous `SNAP_DISTANCE = 8` px et on dessine des lignes
**magenta** sur les axes actifs.

### Cotes de mesure dynamiques
Toujours pendant le déplacement, on calcule et affiche :
- la distance au plus proche bord/voisin à gauche/droite/haut/bas (libellé bleu) ;
- la détection d'**espacement égal** entre triplets d'éléments (libellé ambre `EQUAL`),
  avec aimantation pour faciliter une distribution régulière à la main.

### Multi-sélection et Groupement
L'application supporte désormais la multi-sélection (via cadre de sélection ou Shift+Clic).
- **Cadre de sélection** : clic-glisse sur le fond du canvas.
- **Groupement** (`Ctrl+G`) : permet de manipuler plusieurs éléments comme une unité
  (déplacement, rotation, suppression). Les groupes peuvent être dégroupés (`Ctrl+Maj+G`).
- **Rotation de groupe** : une poignée de rotation est affichée au-dessus de la boîte
  englobante de la sélection multiple.

### Menu Contextuel
Un clic droit sur le canvas ouvre un menu contextuel offrant des actions rapides :
- Sur sélection : grouper/dégrouper, dupliquer, copier, changer l'ordre (Z-order), supprimer.
- Sur le fond : coller.

### Presse-papiers
Support du copier/coller/dupliquer (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) pour un ou plusieurs
éléments simultanément.

### Clavier
`Arrow*` déplace (Maj → pas de 10 px), `Delete`/`Backspace` supprime. Ignoré si le focus
est dans un `input`/`textarea`. Raccourcis standards supportés (Ctrl+Z/Y pour l'historique,
Ctrl+C/V/D pour le presse-papiers, Ctrl+G pour les groupes).

## 5. Export (`src/App.tsx`)

- **SVG** : sérialisation du `<svg id="bauhaus-svg">` → `Blob` → téléchargement.
- **PNG/JPG** : le SVG est sérialisé, chargé dans une `<img>`, dessiné sur un `<canvas>`
  (avec remplissage du fond), puis `toDataURL`.

> ⚠️ Les polices Google/importées peuvent ne pas être embarquées dans le SVG sérialisé :
> le rendu PNG/JPG peut retomber sur une police système. Voir `CLAUDE.md` §dette.

## 6. Styles

Tailwind v4 (config dans le CSS, pas de `tailwind.config.js`). Esthétique « pro » sobre :
gris/blanc, accent bleu `#3b82f6`, guides magenta, distribution ambre `#f59e0b`.
Polices Google préchargées dans `index.html`.
