export type ElementType = 'text' | 'rect' | 'circle' | 'triangle';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  color: string;
  opacity: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
}

export interface ShapeElement extends BaseElement {
  type: 'rect' | 'circle' | 'triangle';
  width: number;
  height: number;
}

export type CompositionElement = TextElement | ShapeElement;

export interface CompositionState {
  elements: CompositionElement[];
  selectedId: string | null;
  backgroundColor: string;
  canvasWidth: number;
  canvasHeight: number;
  customColors: string[];
  customFonts: string[];
}
