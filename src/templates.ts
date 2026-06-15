import type { CompositionElement, ShapeElement, TextElement, ShapeType, BaseElement } from './types';

export interface Template {
  name: string;
  backgroundColor: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: CompositionElement[];
}

type Extra = Partial<Omit<BaseElement, 'id' | 'type'>>;

let _id = 0;
const nid = () => `tpl-${_id++}`;

const sh = (
  type: ShapeType,
  x: number, y: number, width: number, height: number,
  color: string, extra: Extra = {},
): ShapeElement => ({
  id: nid(), type, x, y, width, height, color,
  rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1, visible: true, locked: false, name: type,
  ...extra,
});

const tx = (
  x: number, y: number, text: string, fontSize: number, color: string,
  extra: Extra & {
    fontWeight?: string;
    fontFamily?: string;
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: 'start' | 'middle' | 'end';
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    italic?: boolean;
    strokeColor?: string;
    strokeWidth?: number;
  } = {},
): TextElement => ({
  id: nid(), type: 'text', x, y, text, fontSize,
  fontFamily: extra.fontFamily || "'Syne', sans-serif",
  fontWeight: extra.fontWeight || '800',
  color,
  rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1, visible: true, locked: false, name: 'Texte',
  ...extra,
});

// Couleurs Bauhaus
const RED = '#e63946';
const BLUE = '#1d3557';
const YELLOW = '#f4a261';
const BLACK = '#1a1a1a';
const CREAM = '#f1faee';

export const TEMPLATES: Template[] = [
  {
    name: 'Composition primaire',
    backgroundColor: CREAM,
    canvasWidth: 800,
    canvasHeight: 800,
    elements: [
      sh('circle', 270, 270, 320, 320, RED),
      sh('rect', 560, 560, 260, 260, BLUE),
      sh('triangle', 580, 220, 240, 240, YELLOW),
      sh('line', 400, 700, 700, 10, BLACK),
    ],
  },
  {
    name: 'Affiche typographique',
    backgroundColor: RED,
    canvasWidth: 800,
    canvasHeight: 1000,
    elements: [
      sh('circle', 400, 300, 360, 360, YELLOW),
      tx(400, 700, 'BAUHAUS', 120, BLACK),
      tx(400, 800, '1919 — 1933', 40, CREAM, { fontWeight: '400' }),
      sh('line', 400, 870, 600, 8, BLACK),
    ],
  },
  {
    name: 'Géométrie en anneaux',
    backgroundColor: '#ffffff',
    canvasWidth: 800,
    canvasHeight: 800,
    elements: [
      sh('ring', 300, 300, 360, 360, BLUE),
      sh('semicircle', 560, 280, 280, 140, RED),
      sh('quarter', 240, 600, 240, 240, YELLOW),
      sh('rect', 620, 620, 180, 180, BLACK),
    ],
  },
  {
    name: 'Modernisme Suisse',
    backgroundColor: '#ffffff',
    canvasWidth: 800,
    canvasHeight: 1100,
    elements: [
      sh('rect', 0, 0, 1600, 240, RED, { x: 400, y: 120 }),
      tx(40, 100, 'AKZIDENZ', 110, '#ffffff', { fontFamily: "'Inter', sans-serif", fontWeight: '900', textAlign: 'start', letterSpacing: -5 }),
      tx(40, 200, 'GROTESK', 110, '#ffffff', { fontFamily: "'Inter', sans-serif", fontWeight: '900', textAlign: 'start', letterSpacing: -5 }),
      tx(40, 300, 'Typography is the art of arranging type to make written language legible, readable and appealing when displayed.', 16, BLACK, { fontFamily: "'Inter', sans-serif", fontWeight: '400', textAlign: 'start', lineHeight: 1.5, x: 400, y: 400, scaleX: 1, scaleY: 1 }),
      sh('line', 400, 350, 720, 2, BLACK),
      tx(400, 600, 'SWISS', 280, BLACK, { fontFamily: "'Archivo Black', sans-serif", letterSpacing: -15, opacity: 0.1 }),
      tx(760, 1050, 'ZURICH, 1957', 12, BLACK, { fontFamily: "'Space Grotesk', sans-serif", fontWeight: '700', textAlign: 'end' }),
    ],
  },
];
