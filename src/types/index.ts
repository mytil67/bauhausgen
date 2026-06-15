export type ShapeType = 'rect' | 'circle' | 'triangle' | 'semicircle' | 'quarter' | 'ring' | 'line';
export type ElementType = 'text' | ShapeType;

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  color: string;
  opacity: number;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
  /** Métadonnées de calque (optionnelles, défauts appliqués au rendu). */
  name?: string;
  visible?: boolean;
  locked?: boolean;
  /** Identifiant de groupe : les éléments partageant la même valeur se sélectionnent ensemble. */
  groupId?: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'start' | 'middle' | 'end';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  italic?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  maxWidth?: number; // Pour le wrapping
}

export interface ShapeElement extends BaseElement {
  type: ShapeType;
  width: number;
  height: number;
}

export type CompositionElement = TextElement | ShapeElement;

/** Police importée par l'utilisateur. `data` est un data URL base64 (persistable). */
export interface CustomFont {
  name: string;
  data: string;
}

/** Partie « document » de l'état : c'est elle qui est historisée (undo/redo). */
export interface DocState {
  elements: CompositionElement[];
  backgroundColor: string;
  canvasWidth: number;
  canvasHeight: number;
  customColors: string[];
  customFonts: CustomFont[];
}

export type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/** Boîtes englobantes locales (pré-scale) mesurées via getBBox, indexées par id. */
export type ElementBounds = Record<string, { x: number; y: number; width: number; height: number }>;
