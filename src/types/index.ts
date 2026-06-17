export type ShapeType = 'rect' | 'circle' | 'triangle' | 'semicircle' | 'quarter' | 'ring' | 'line' | 'hexagon' | 'diamond' | 'star' | 'cross' | 'arrow';
export type ElementType = 'text' | ShapeType | 'image';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX?: number;
  skewY?: number;
  color: string;
  opacity: number;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
  /** Métadonnées de calque (optionnelles, défauts appliqués au rendu). */
  name?: string;
  visible?: boolean;
  locked?: boolean;
  /** Identifiant de groupe : les éléments partageant la même valeur se sélectionnent ensemble. */
  groupId?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeAlign?: 'center' | 'inside' | 'outside'; // Alignement du contour (formes)
  noFill?: boolean; // Remplissage transparent (forme/texte évidé, contour seul)
  gradient?: {
    type: 'linear' | 'radial';
    colors: { offset: number; color: string; opacity: number }[];
    rotation: number; // Pour le linéaire
  };
  /** Remplissage à motif (rayures, points, grille, damier). Prioritaire sur gradient/couleur. */
  pattern?: {
    type: 'stripes' | 'dots' | 'grid' | 'checker';
    color: string;       // couleur du motif (premier plan)
    background: string;  // couleur de fond du motif ('transparent' possible)
    scale: number;       // échelle de la tuile (0.25 → 3)
    angle: number;       // rotation du motif (0 → 360)
  };
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontWidth?: number; // Pour les polices variables (stretch)
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'start' | 'middle' | 'end';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  italic?: boolean;
  maxWidth?: number; // Pour le wrapping
  curve?: number; // Courbure du texte (-100 à 100)
  curveType?: 'arc' | 'circle'; // Lot 2: arc ou cercle complet
  curveInvert?: boolean; // Lot 2: inversion du sens
  bgEnabled?: boolean; // Lot 2: fond de texte (badge)
  bgColor?: string;
  bgPadding?: number;
  bgRadius?: number;
  knockout?: boolean; // Lot 3: texte découpé (les lettres laissent voir le fond)
  textShadows?: { x: number; y: number; blur: number; color: string; opacity?: number }[]; // Lot 2: ombres multiples
  // --- Lot 1 typographie ---
  writingMode?: 'horizontal' | 'vertical'; // Sens d'écriture
  fontVariant?: 'normal' | 'small-caps'; // Petites capitales
  textDecoration?: 'none' | 'underline' | 'line-through' | 'overline'; // Décoration
  textDecorationStyle?: 'solid' | 'dashed' | 'dotted' | 'wavy'; // Style de la décoration
  textDecorationColor?: string; // Couleur de la décoration (défaut = couleur du texte)
  wordSpacing?: number; // Espacement des mots (px)
}

export interface ShapeElement extends BaseElement {
  type: ShapeType;
  width: number;
  height: number;
}

/** Image importée (PNG/JPG/SVG) — `href` est un data URL embarqué. */
export interface ImageElement extends BaseElement {
  type: 'image';
  href: string;
  width: number;
  height: number;
}

export type CompositionElement = TextElement | ShapeElement | ImageElement;

/** Police importée par l'utilisateur. `data` est un data URL base64 (persistable). */
export interface CustomFont {
  name: string;
  data: string;
}

/** Partie « document » de l'état : c'est elle qui est historisée (undo/redo). */
export interface DocState {
  name: string; // Nom du projet (sert de nom de fichier à l'export)
  elements: CompositionElement[];
  backgroundColor: string;
  /** Dégradé de fond (prioritaire sur backgroundColor s'il est défini). */
  backgroundGradient?: {
    type: 'linear' | 'radial';
    colors: { offset: number; color: string; opacity: number }[];
    rotation: number;
  };
  canvasWidth: number;
  canvasHeight: number;
  customColors: string[];
  customFonts: CustomFont[];
}

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/** Boîtes englobantes locales (pré-scale) mesurées via getBBox, indexées par id. */
export type ElementBounds = Record<string, { x: number; y: number; width: number; height: number }>;
