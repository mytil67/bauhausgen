import type { ShapeType } from './types';

// ── Formes disponibles ──────────────────────────────────────────────────────
export const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'rect', label: 'Rectangle' },
  { type: 'circle', label: 'Cercle' },
  { type: 'triangle', label: 'Triangle' },
  { type: 'semicircle', label: 'Demi-cercle' },
  { type: 'quarter', label: 'Quart' },
  { type: 'ring', label: 'Anneau' },
  { type: 'line', label: 'Ligne' },
  { type: 'hexagon', label: 'Hexagone' },
  { type: 'diamond', label: 'Losange' },
  { type: 'star', label: 'Étoile' },
  { type: 'cross', label: 'Croix' },
  { type: 'arrow', label: 'Flèche' },
];

/** Liste brute des types de formes (pratique pour le mobile). */
export const SHAPE_TYPES: ShapeType[] = SHAPES.map((s) => s.type);

// ── Palettes Bauhaus ────────────────────────────────────────────────────────
export const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Primaire', colors: ['#e63946', '#f4a261', '#1d3557', '#1a1a1a', '#f1faee'] },
  { name: 'Weimar',   colors: ['#d62828', '#fcbf49', '#003049', '#eae2b7', '#1a1a1a'] },
  { name: 'Dessau',   colors: ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#ffffff'] },
  { name: 'Mono',     colors: ['#1a1a1a', '#4a4a4a', '#8a8a8a', '#cfcfcf', '#ffffff'] },
];

// ── Polices Google embarquées ───────────────────────────────────────────────
export const GOOGLE_FONTS: { label: string; value: string }[] = [
  { label: 'Inter',             value: "'Inter', sans-serif" },
  { label: 'Montserrat',        value: "'Montserrat', sans-serif" },
  { label: 'Outfit',            value: "'Outfit', sans-serif" },
  { label: 'Space Grotesk',     value: "'Space Grotesk', sans-serif" },
  { label: 'Syne',              value: "'Syne', sans-serif" },
  { label: 'Archivo Black',     value: "'Archivo Black', sans-serif" },
  { label: 'Playfair Display',  value: "'Playfair Display', serif" },
  { label: 'Libre Baskerville', value: "'Libre Baskerville', serif" },
  { label: 'Roboto',            value: "'Roboto', sans-serif" },
  { label: 'Poppins',           value: "'Poppins', sans-serif" },
  { label: 'Oswald',            value: "'Oswald', sans-serif" },
  { label: 'Bebas Neue',        value: "'Bebas Neue', sans-serif" },
  { label: 'Righteous',         value: "'Righteous', display" },
  { label: 'Anton',             value: "'Anton', sans-serif" },
  { label: 'Work Sans',         value: "'Work Sans', sans-serif" },
  { label: 'Roboto Mono',       value: "'Roboto Mono', monospace" },
];

// ── Formats de canvas prédéfinis ────────────────────────────────────────────
export const CANVAS_PRESETS: { name: string; w: number; h: number }[] = [
  { name: 'Carré',    w: 1080, h: 1080 },
  { name: 'Story',    w: 1080, h: 1920 },
  { name: 'Post',     w: 1080, h: 1350 },
  { name: 'Bannière', w: 1500, h: 500 },
  { name: 'A4 ↕',    w: 1240, h: 1754 },
];

// ── Types de motifs ─────────────────────────────────────────────────────────
export type PatternType = 'none' | 'stripes' | 'dots' | 'grid' | 'checker';
export const PATTERNS: { type: PatternType; label: string }[] = [
  { type: 'none',    label: 'Aucun' },
  { type: 'stripes', label: 'Rayures' },
  { type: 'dots',    label: 'Points' },
  { type: 'grid',    label: 'Grille' },
  { type: 'checker', label: 'Damier' },
];
