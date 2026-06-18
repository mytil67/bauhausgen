# Roadmap typographie — Bauhaus Visual Generator

## Fonctionnalités existantes

| Propriété | Détails |
|---|---|
| Police | 16 Google Fonts + import custom (TTF/OTF/WOFF/WOFF2) |
| Taille, poids, largeur | fontSize, fontWeight (100–900), fontWidth (variable fonts 50–200%) |
| Espacement | letterSpacing (-10→50px), lineHeight (0.5→3) |
| Alignement | start / middle / end |
| Casse | uppercase / lowercase / none |
| Italique | toggle |
| Contour texte | strokeColor + strokeWidth (0–20px) |
| Texte courbé | curve (-100→100), rendu via `<textPath>` arc |
| Retour à la ligne | maxWidth (foreignObject, word-break) |
| Dégradé | linéaire/radial sur le fill du texte |
| Ombre portée | blur, offset, couleur, opacité |
| Blend modes | multiply, screen, overlay, etc. |

---

## Lot 1 — Facile & fort impact — ✅ RÉALISÉ (2026-06-16)

Items 1 à 4 implémentés. Propriétés ajoutées au `TextElement`, rendues dans les deux
chemins de `Canvas` (`<text>` simple ET `foreignObject` wrapping), incluses dans le
copier-coller de style, contrôlées depuis la Sidebar (section texte).

### 1. Texte vertical — ✅
- Propriété : `writingMode?: 'horizontal' | 'vertical'`
- Implémentation : `writing-mode: vertical-rl` (style sur `<text>` et sur le div du
  foreignObject). Le texte courbé (`curve`) est ignoré quand le mode est vertical.
- UI : toggle « A » vertical dans la barre de style du texte.

### 2. Petites capitales (small-caps) — ✅
- Propriété : `fontVariant?: 'normal' | 'small-caps'`
- Implémentation : `font-variant: small-caps`
- UI : toggle « Sᴄ » dans la barre de style.

### 3. Soulignement / barré / surlignement — ✅
- Propriété : `textDecoration?: 'none' | 'underline' | 'line-through' | 'overline'`
- Optionnelles : `textDecorationColor?`, `textDecorationStyle?: 'solid' | 'dashed' | 'dotted' | 'wavy'`
- UI : 3 toggles (U / S / O) ; quand actif → select de style + sélecteur de couleur.

### 4. Espacement des mots (word-spacing) — ✅
- Propriété : `wordSpacing?: number` (range -10 → 50px)
- Implémentation : `word-spacing` CSS (`<text>` via attribut + style, foreignObject via style)
- UI : slider + input sous l'interlettrage.

### 5. Majuscules de titrage (OpenType titling) — reporté au panel OpenType (Lot 2, item 10)
- Propriété : inclus dans un futur panel OpenType features
- Implémentation : `font-feature-settings: "titl"`
- Pertinent surtout pour Playfair Display et les polices avec alternates

---

## Lot 2 — Moyen & fort impact — ✅ RÉALISÉ

Items 6, 7, 8 livrés plus tôt (curveType/curveInvert ; textShadows[] + préréglages ;
bgEnabled/bgColor/bgPadding/bgRadius). Items 9 et 10 ajoutés le 2026-06-18 :
`opticalSizing?` (`font-optical-sizing`, défaut auto, toggle pour désactiver) et
`opentypeFeatures?: Record<string, boolean>` (`font-feature-settings`, panel de toggles
liga/dlig/tnum/onum/frac/swsh/ss01/ss02). Rendus dans les 3 chemins texte
(`<text>`, foreignObject, glyphText), inclus au copier-coller de style.

### 6. Texte sur cercle complet — ✅
- Extension du `curve` actuel : permettre un chemin circulaire 360°
- Propriétés : `curveType?: 'arc' | 'circle'`, `curveRadius?: number`, `curveStartOffset?: number`
- Le rayon et l'offset de départ permettent de positionner le texte autour d'un cercle
- Intérêt : sceaux, logos, badges circulaires Bauhaus

### 7. Ombre de texte multiple (text-shadow stack) — ✅
- Propriété : `textShadows?: Array<{ offsetX, offsetY, blur, color }>`
- Distinct du drop shadow SVG actuel (qui est un filtre sur tout l'élément)
- Permet d'empiler plusieurs ombres pour des effets rétro / 3D / longue ombre
- UI : liste éditable d'ombres avec bouton « + »
- Intérêt : effet poster vintage très tendance

### 8. Texte avec fond (highlight / badge) — ✅
- Propriété : `textBackground?: { color, paddingX, paddingY, borderRadius }`
- Implémentation : rectangle SVG auto-dimensionné derrière le texte (lié au bbox)
- UI : toggle + couleur de fond + sliders padding/radius
- Intérêt : étiquettes, mise en exergue, style éditorial

### 9. Espacement optique (optical sizing) — ✅
- Propriété : `opticalSizing?: boolean`
- Implémentation : `font-optical-sizing: auto` pour les polices variables (Inter, etc.)
- UI : toggle simple
- Note : subtil mais améliore la lisibilité à petites/grandes tailles

### 10. Ligatures & features OpenType — ✅
- Propriété : `opentypeFeatures?: Record<string, boolean>`
- Features utiles :
  - `liga` / `dlig` — ligatures standard / discrétionnaires
  - `tnum` / `onum` — chiffres tabulaires / old-style
  - `frac` — fractions
  - `swsh` — swash (fioritures)
  - `ss01`–`ss20` — sets stylistiques
- UI : panel « OpenType » avec toggles par feature détectée
- Note : dépend de ce que supporte chaque police

---

## Lot 3 — Ambitieux mais différenciant

### 11. Texte multi-style (rich text)
- Remplacer le champ `text: string` par un modèle riche : `spans: Array<{ text, fontSize?, fontWeight?, color?, ... }>`
- Mini éditeur inline avec sélection de texte et application de styles par range
- Permettrait titre + sous-titre dans un même bloc
- Complexité : élevée (modèle de données, rendu SVG multi-tspan, édition inline)

### 12. Texte dans une forme (text-in-shape)
- Couler le texte dans un rectangle, cercle ou triangle
- Implémentation : `shape-outside` CSS ou clip-path SVG + foreignObject
- Propriété : `textShape?: 'none' | 'rect' | 'circle' | 'triangle'`
- Effet très graphique, typique du design Bauhaus

### 13. Effet de découpe (knockout text)
- Le texte « découpe » la forme derrière lui = le fond est visible à travers les lettres
- Implémentation : masque SVG (`<mask>`) avec le texte en blanc sur fond noir
- Propriété : `knockout?: boolean` sur le TextElement
- Classique du design Bauhaus et moderniste

### 14. Déformation enveloppe (warp / distort)
- Au-delà de la courbure simple : arc, flag, wave, bulge, inflate
- Chaque lettre positionnée individuellement sur un chemin complexe (comme Illustrator)
- Propriétés : `warpType?: 'none' | 'arc' | 'flag' | 'wave' | 'bulge'`, `warpIntensity?: number`
- Complexité : élevée (calcul de position par glyphe)

### 15. Colonnes de texte
- Propriétés : `columns?: number` (1–4), `columnGap?: number`
- Implémentation : CSS `column-count` + `column-gap` dans le foreignObject
- Utile pour les blocs de texte longs sur posters
- Relativement simple si on utilise le mode foreignObject existant
