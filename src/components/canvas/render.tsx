import React from 'react';
import type { CompositionElement, TextElement, ShapeElement } from '../../types';

/** Boîte englobante de repli quand getBBox n'a pas encore mesuré l'élément. */
export const FALLBACK_BBOX = { x: -50, y: -25, width: 100, height: 50 } as DOMRect;

/** Géométrie nue d'une forme, réutilisée pour le rendu, les clips et les masques
 *  (afin d'émuler l'alignement du contour intérieur/extérieur). */
export const shapeGeom = (el: ShapeElement, props: React.SVGAttributes<SVGElement>): React.ReactNode => {
  const w = el.width, h = el.height;
  switch (el.type) {
    case 'rect':
    case 'line':
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} {...props} />;
    case 'circle':
      return <circle cx="0" cy="0" r={w / 2} {...props} />;
    case 'triangle':
      return <polygon points={`0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`} {...props} />;
    case 'semicircle':
      return <path d={`M ${-w / 2},${h / 2} A ${w / 2} ${h} 0 0 1 ${w / 2} ${h / 2} Z`} {...props} />;
    case 'quarter':
      return <path d={`M ${-w / 2},${h / 2} L ${w / 2},${h / 2} A ${w} ${h} 0 0 0 ${-w / 2},${-h / 2} Z`} {...props} />;
    case 'ring':
      return <path fillRule="evenodd" d={`M ${-w / 2},0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${-w / 2} 0 Z M ${-w / 4},0 A ${w / 4} ${h / 4} 0 1 1 ${w / 4} 0 A ${w / 4} ${h / 4} 0 1 1 ${-w / 4} 0 Z`} {...props} />;
    case 'hexagon': // hexagone plat-dessus
      return <polygon points={`${-w / 2},0 ${-w / 4},${-h / 2} ${w / 4},${-h / 2} ${w / 2},0 ${w / 4},${h / 2} ${-w / 4},${h / 2}`} {...props} />;
    case 'diamond': // losange
      return <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} {...props} />;
    case 'star': { // étoile à 5 branches
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 1 : 0.4;
        pts.push(`${(Math.cos(ang) * (w / 2) * r).toFixed(2)},${(Math.sin(ang) * (h / 2) * r).toFixed(2)}`);
      }
      return <polygon points={pts.join(' ')} {...props} />;
    }
    case 'cross': { // croix / plus
      const vx = w / 6, hy = h / 6, a = w / 2, b = h / 2;
      return <polygon points={`${-vx},${-b} ${vx},${-b} ${vx},${-hy} ${a},${-hy} ${a},${hy} ${vx},${hy} ${vx},${b} ${-vx},${b} ${-vx},${hy} ${-a},${hy} ${-a},${-hy} ${-vx},${-hy}`} {...props} />;
    }
    case 'arrow': // flèche vers la droite
      return <polygon points={`${-w / 2},${-h / 4} 0,${-h / 4} 0,${-h / 2} ${w / 2},0 0,${h / 2} 0,${h / 4} ${-w / 2},${h / 4}`} {...props} />;
    default:
      return null;
  }
};

/** Convertit un hex (#rgb ou #rrggbb) en rgba() avec l'alpha donné. */
export const hexToRgba = (hex: string, a: number): string => {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * Rayon du cercle support pour un texte courbé.
 * - mode « arc » : rayon dérivé de la courbure (10000/curve) — courbe douce → grand rayon.
 * - mode « circle » (360°) : rayon calculé d'après la LONGUEUR du texte pour qu'il fasse
 *   exactement le tour sans étirement ni débordement (la circonférence ≈ largeur du mot).
 */
export const curveRadius = (el: CompositionElement): number => {
  if (el.type !== 'text' || !el.curve) return 10;
  if (el.curveType === 'circle') {
    const est =
      Math.max(el.text.length, 1) * el.fontSize * 0.6 * ((el.fontWidth ?? 100) / 100) +
      el.text.length * (el.letterSpacing ?? 0);
    return Math.max(est / (2 * Math.PI), el.fontSize * 0.7);
  }
  return Math.max(Math.abs(10000 / el.curve), 10);
};

/**
 * Construit les `<defs>` SVG propres à un élément (filtre d'ombre, dégradé, motif,
 * masques/clips de contour, masque de découpe knockout, path de texte courbé).
 * Fonction PURE : ne dépend que de l'élément et du cache de boîtes englobantes.
 */
export const buildElementDefs = (
  el: CompositionElement,
  bboxes: { [key: string]: DOMRect },
): React.ReactNode[] => {
  const defs: React.ReactNode[] = [];

  // Filtre d'ombre
  if (el.shadowBlur !== 0 || el.shadowOpacity !== 0) {
    defs.push(
      <filter key={`shadow-${el.id}`} id={`filter-shadow-${el.id}`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceAlpha" stdDeviation={el.shadowBlur ?? 0} />
        <feOffset dx={el.shadowOffsetX ?? 0} dy={el.shadowOffsetY ?? 0} result="offsetblur" />
        <feFlood floodColor={el.shadowColor ?? '#000000'} floodOpacity={el.shadowOpacity ?? 0.5} />
        <feComposite in2="offsetblur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    );
  }

  // Dégradé
  if (el.gradient) {
    const { type, colors, rotation } = el.gradient;
    const id = `gradient-${el.id}`;
    if (type === 'linear') {
      const rad = (rotation * Math.PI) / 180;
      const x1 = 50 - Math.cos(rad) * 50;
      const y1 = 50 - Math.sin(rad) * 50;
      const x2 = 50 + Math.cos(rad) * 50;
      const y2 = 50 + Math.sin(rad) * 50;
      defs.push(
        <linearGradient key={id} id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
          {colors.map((c, i) => <stop key={i} offset={`${c.offset * 100}%`} stopColor={c.color} stopOpacity={c.opacity} />)}
        </linearGradient>
      );
    } else {
      defs.push(
        <radialGradient key={id} id={id}>
          {colors.map((c, i) => <stop key={i} offset={`${c.offset * 100}%`} stopColor={c.color} stopOpacity={c.opacity} />)}
        </radialGradient>
      );
    }
  }

  // Motif (rayures / points / grille / damier)
  if (el.pattern) {
    const { type, color, background, scale, angle } = el.pattern;
    const s = Math.max(4, 24 * (scale || 1));
    const t = s / 6; // épaisseur des traits
    const id = `pattern-${el.id}`;
    const bg = background && background !== 'transparent'
      ? <rect width={s} height={s} fill={background} />
      : null;
    let motif: React.ReactNode;
    if (type === 'stripes') {
      motif = <rect width={s} height={s / 2} fill={color} />;
    } else if (type === 'dots') {
      motif = <circle cx={s / 2} cy={s / 2} r={s / 4} fill={color} />;
    } else if (type === 'grid') {
      motif = <><rect width={s} height={t} fill={color} /><rect width={t} height={s} fill={color} /></>;
    } else { // checker
      motif = <><rect width={s / 2} height={s / 2} fill={color} /><rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} fill={color} /></>;
    }
    defs.push(
      <pattern key={id} id={id} patternUnits="userSpaceOnUse" width={s} height={s} patternTransform={`rotate(${angle || 0})`}>
        {bg}
        {motif}
      </pattern>
    );
  }

  // Alignement du contour (formes) : clip pour l'intérieur, masque pour l'extérieur
  if (el.type !== 'text' && el.type !== 'image' && (el.strokeWidth ?? 0) > 0 && el.strokeAlign && el.strokeAlign !== 'center') {
    if (el.strokeAlign === 'inside') {
      defs.push(
        <clipPath key={`sc-${el.id}`} id={`shapeclip-${el.id}`}>
          {shapeGeom(el, {})}
        </clipPath>
      );
    } else {
      const m = Math.max(el.width, el.height) + (el.strokeWidth ?? 0) * 4 + 20;
      defs.push(
        <mask key={`sm-${el.id}`} id={`shapemask-${el.id}`} maskUnits="userSpaceOnUse" x={-m} y={-m} width={2 * m} height={2 * m}>
          <rect x={-m} y={-m} width={2 * m} height={2 * m} fill="white" />
          {shapeGeom(el, { fill: 'black' })}
        </mask>
      );
    }
  }

  // Masque de découpe (knockout) : plaque pleine, lettres en trou
  if (el.type === 'text' && el.knockout && !el.curve) {
    const b = bboxes[el.id] || FALLBACK_BBOX;
    const pad = el.bgPadding ?? 16;
    defs.push(
      <mask
        key={`ko-${el.id}`}
        id={`knockout-${el.id}`}
        maskUnits="userSpaceOnUse"
        x={b.x - pad - 8}
        y={b.y - pad - 8}
        width={b.width + pad * 2 + 16}
        height={b.height + pad * 2 + 16}
      >
        <rect x={b.x - pad} y={b.y - pad} width={b.width + pad * 2} height={b.height + pad * 2} rx={el.bgRadius ?? 0} fill="white" />
        {glyphText(el, 'black')}
      </mask>
    );
  }

  // Path pour texte courbé (arc de cercle ou cercle complet)
  if (el.type === 'text' && el.curve && el.curve !== 0) {
    const curve = el.curve;
    const r = curveRadius(el);
    const sweep = (curve > 0) !== !!el.curveInvert ? 1 : 0;

    // On crée systématiquement un cercle complet dont l'apex (le sommet ou le creux) est exactement à (0,0).
    // Cela évite de devoir calculer la largeur du texte (w) et empêche tout rognage (clipping) !
    // startOffset="50%" de <textPath> placera toujours le centre du texte à (0,0).
    const pathData = sweep
      // Sourire (curve > 0) : Centre à (0, r). Apex haut à (0,0). Départ en bas à (0, 2r).
      ? `M 0,${2 * r} A ${r},${r} 0 0,1 0,0 A ${r},${r} 0 0,1 0,${2 * r}`
      // Triste (curve < 0) : Centre à (0, -r). Apex bas à (0,0). Départ en haut à (0, -2r).
      : `M 0,${-2 * r} A ${r},${r} 0 0,0 0,0 A ${r},${r} 0 0,0 0,${-2 * r}`;
    defs.push(<path key={`path-${el.id}`} id={`path-${el.id}`} d={pathData} />);
  }

  return defs;
};

/** Rend un `<text>` aux glyphes nus (sans décor/contour), réutilisé pour le masque de
 *  découpe (knockout) et la cible de mesure invisible. */
export const glyphText = (el: TextElement, fill: string, extra: React.SVGProps<SVGTextElement> = {}) => (
  <text
    x="0"
    y="0"
    fontSize={el.fontSize}
    fontFamily={el.fontFamily}
    fontWeight={el.fontWeight}
    fontStyle={el.italic ? 'italic' : 'normal'}
    letterSpacing={el.letterSpacing ?? 0}
    wordSpacing={el.wordSpacing ?? 0}
    textAnchor={el.textAlign ?? 'middle'}
    dominantBaseline="middle"
    fill={fill}
    style={{
      textTransform: el.textTransform ?? 'none',
      fontVariant: el.fontVariant ?? 'normal',
      fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`,
    }}
    {...extra}
  >
    {el.text}
  </text>
);
