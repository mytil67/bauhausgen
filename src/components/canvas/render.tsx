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

/** Lot 2 — espacement optique des polices variables (défaut auto, désactivable). */
export const opticalSizingValue = (el: TextElement): React.CSSProperties['fontOpticalSizing'] =>
  el.opticalSizing === false ? 'none' : 'auto';

/** Lot 2 — `font-feature-settings` depuis la map de features OpenType (undefined si vide). */
export const featureSettingsValue = (el: TextElement): string | undefined => {
  const f = el.opentypeFeatures;
  if (!f) return undefined;
  const parts = Object.entries(f).map(([k, v]) => `"${k}" ${v ? 1 : 0}`);
  return parts.length ? parts.join(', ') : undefined;
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
      fontOpticalSizing: opticalSizingValue(el),
      fontFeatureSettings: featureSettingsValue(el),
      fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`,
    }}
    {...extra}
  >
    {el.text}
  </text>
);

export interface ElementVisuals {
  /** Boîte de sélection (coords locales, pré-scale appliqué). */
  sx: number; sy: number; sw: number; sh: number;
  /** `url(#filter-shadow-…)` si l'élément a une ombre portée, sinon undefined. */
  filterUrl?: string;
  /** Remplissage résolu : 'none' / url(#pattern) / url(#gradient) / couleur. */
  fill: string;
  /** CSS text-shadow agrégé (ombres de texte multiples), ou undefined. */
  textShadowCss?: string;
}

/**
 * Calcule les grandeurs visuelles dérivées d'un élément + sa boîte englobante mesurée :
 * la boîte de SÉLECTION (qui englobe plaque badge/découpe ET débord du contour, que
 * getBBox ignore), le remplissage résolu, l'URL du filtre d'ombre et le text-shadow CSS.
 * PURE : aucune dépendance à l'état React. Isolée ici car la math de la boîte de sélection
 * est subtile (padding badge vs marge de contour selon `strokeAlign`).
 */
export const computeElementVisuals = (el: CompositionElement, bbox: DOMRect): ElementVisuals => {
  // La boîte de sélection englobe la plaque (badge/découpe) ET la partie du contour
  // qui dépasse de la géométrie (getBBox ignore le stroke), pour que les poignées
  // entourent toujours le rendu complet — sans manip manuelle.
  const plateActive = el.type === 'text' && !el.curve && (el.bgEnabled || el.knockout);
  const bgPad = plateActive ? (el.bgPadding ?? (el.type === 'text' && el.knockout ? 16 : 10)) : 0;
  const strokeW = el.strokeWidth ?? 0;
  const strokeMargin = strokeW > 0
    ? (el.strokeAlign === 'outside' ? strokeW : el.strokeAlign === 'inside' ? 0 : strokeW / 2)
    : 0;
  const selPad = Math.max(bgPad, strokeMargin);
  const sw = (bbox.width + selPad * 2) * el.scaleX;
  const sh = (bbox.height + selPad * 2) * el.scaleY;
  const sx = (bbox.x - selPad) * el.scaleX;
  const sy = (bbox.y - selPad) * el.scaleY;

  const filterUrl = (el.shadowBlur && el.shadowBlur > 0) || (el.shadowOpacity && el.shadowOpacity > 0)
    ? `url(#filter-shadow-${el.id})`
    : undefined;

  const fill = el.noFill
    ? 'none'
    : el.pattern
    ? `url(#pattern-${el.id})`
    : el.gradient ? `url(#gradient-${el.id})` : el.color;

  // Ombres de texte multiples (CSS text-shadow), distinct du filtre drop-shadow
  const textShadowCss = el.type === 'text' && el.textShadows && el.textShadows.length
    ? el.textShadows.map((s) => `${s.x}px ${s.y}px ${s.blur}px ${hexToRgba(s.color, s.opacity ?? 1)}`).join(', ')
    : undefined;

  return { sx, sy, sw, sh, filterUrl, fill, textShadowCss };
};

export interface ElementContentProps {
  el: CompositionElement;
  /** Remplissage résolu (couleur / url(#gradient) / url(#pattern) / 'none'). */
  fill: string;
  /** CSS text-shadow agrégé (ombres multiples), ou undefined. */
  textShadowCss?: string;
  bboxes: { [key: string]: DOMRect };
  editingId: string | null;
  onUpdateLive: (id: string, updates: Partial<CompositionElement>) => void;
  setEditingId: (id: string | null) => void;
  editInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Rendu du CONTENU d'un élément (ce qui va dans le `<g>` scalé interne) : texte
 * (knockout / enveloppé via foreignObject / normal & courbé), champ d'édition inline,
 * image, ou forme (avec contour intérieur/extérieur). Ne gère ni le `<g>` externe
 * (transform/rotation), ni les poignées de sélection — ceux-ci restent dans Canvas.
 */
export const renderElementContent = ({
  el, fill, textShadowCss, bboxes, editingId, onUpdateLive, setEditingId, editInputRef,
}: ElementContentProps): React.ReactNode => (
  <>
    {el.type === 'text' && editingId !== el.id && (
      el.knockout && !el.curve ? (
        <>
          {/* Texte invisible pour la mesure (le bbox sert à dimensionner la plaque) */}
          {glyphText(el, 'none', { className: 'measure-target', 'aria-hidden': true })}
          {/* Plaque pleine, lettres découpées via le masque */}
          <rect
            x={(bboxes[el.id]?.x ?? 0) - (el.bgPadding ?? 16)}
            y={(bboxes[el.id]?.y ?? 0) - (el.bgPadding ?? 16)}
            width={(bboxes[el.id]?.width ?? 0) + (el.bgPadding ?? 16) * 2}
            height={(bboxes[el.id]?.height ?? 0) + (el.bgPadding ?? 16) * 2}
            rx={el.bgRadius ?? 0}
            ry={el.bgRadius ?? 0}
            fill={fill}
            mask={`url(#knockout-${el.id})`}
          />
        </>
      ) : el.maxWidth && el.maxWidth > 0 && (!el.curve || el.curve === 0) ? (
        <foreignObject
          x={-el.maxWidth / 2}
          y={-(el.fontSize * (el.lineHeight ?? 1.2) * 2) / 2}
          width={el.maxWidth}
          height={1000}
          className="select-none pointer-events-none"
        >
          <div style={{
            color: el.color,
            background: el.gradient ? (
              el.gradient.type === 'linear'
                ? `linear-gradient(${el.gradient.rotation}deg, ${el.gradient.colors.map(c => `${c.color} ${c.offset * 100}%`).join(', ')})`
                : `radial-gradient(circle, ${el.gradient.colors.map(c => `${c.color} ${c.offset * 100}%`).join(', ')})`
            ) : 'none',
            WebkitBackgroundClip: el.gradient ? 'text' : 'none',
            WebkitTextFillColor: el.gradient ? 'transparent' : 'initial',
            fontSize: el.fontSize,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight as React.CSSProperties['fontWeight'],
            fontStyle: el.italic ? 'italic' : 'normal',
            lineHeight: el.lineHeight ?? 1.2,
            letterSpacing: (el.letterSpacing ?? 0) + 'px',
            textAlign: (el.textAlign === 'middle' ? 'center' : el.textAlign === 'end' ? 'right' : 'left') as React.CSSProperties['textAlign'],
            textTransform: el.textTransform ?? 'none',
            fontVariant: el.fontVariant ?? 'normal',
            wordSpacing: (el.wordSpacing ?? 0) + 'px',
            writingMode: el.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
            textDecoration: el.textDecoration && el.textDecoration !== 'none'
              ? `${el.textDecoration} ${el.textDecorationStyle ?? 'solid'} ${el.textDecorationColor ?? el.color}`
              : 'none',
            WebkitTextStroke: el.strokeWidth && el.strokeWidth > 0 ? `${el.strokeWidth}px ${el.strokeColor}` : 'none',
            textShadow: textShadowCss,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            fontOpticalSizing: opticalSizingValue(el),
            fontFeatureSettings: featureSettingsValue(el),
            fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`
          }}>
            {el.text}
          </div>
        </foreignObject>
      ) : (
        <>
          {el.bgEnabled && !el.curve && (
            <rect
              x={(bboxes[el.id]?.x ?? 0) - (el.bgPadding ?? 10)}
              y={(bboxes[el.id]?.y ?? 0) - (el.bgPadding ?? 10)}
              width={(bboxes[el.id]?.width ?? 0) + (el.bgPadding ?? 10) * 2}
              height={(bboxes[el.id]?.height ?? 0) + (el.bgPadding ?? 10) * 2}
              fill={el.bgColor ?? '#000000'}
              rx={el.bgRadius ?? 0}
              ry={el.bgRadius ?? 0}
            />
          )}
          <text
            x="0"
            y="0"
            fontSize={el.fontSize}
            fontFamily={el.fontFamily}
            fontWeight={el.fontWeight}
            fontStyle={el.italic ? 'italic' : 'normal'}
            letterSpacing={el.letterSpacing ?? 0}
            wordSpacing={el.wordSpacing ?? 0}
            fill={fill}
            stroke={el.strokeWidth && el.strokeWidth > 0 ? el.strokeColor : 'none'}
            strokeWidth={el.strokeWidth && el.strokeWidth > 0 ? (el.strokeAlign === 'outside' ? el.strokeWidth * 2 : el.strokeWidth) : 0}
            strokeLinejoin="round"
            textAnchor={el.textAlign ?? 'middle'}
            dominantBaseline="middle"
            className="select-none measure-target"
            style={{
              paintOrder: el.strokeAlign === 'outside' ? 'stroke' : undefined,
              textTransform: el.textTransform ?? 'none',
              fontVariant: el.fontVariant ?? 'normal',
              writingMode: el.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
              textDecoration: el.textDecoration && el.textDecoration !== 'none'
                ? `${el.textDecoration} ${el.textDecorationStyle ?? 'solid'} ${el.textDecorationColor ?? el.color}`
                : 'none',
              textShadow: textShadowCss,
              fontOpticalSizing: opticalSizingValue(el),
              fontFeatureSettings: featureSettingsValue(el),
              fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`
            }}
          >
            {el.curve && el.curve !== 0 && el.writingMode !== 'vertical' ? (
              <textPath
                href={`#path-${el.id}`}
                startOffset="50%"
                textAnchor="middle"
                {...(el.curveType === 'circle' ? {
                  textLength: Math.PI * 2 * curveRadius(el),
                  lengthAdjust: "spacing"
                } : {})}
              >
                {el.text}
              </textPath>
            ) : el.text}
          </text>
        </>
      )
    )}
    {el.type === 'text' && editingId === el.id && (() => {
      const w = Math.max((bboxes[el.id]?.width ?? 200) + 40, 120);
      const lines = (el.text.match(/\n/g)?.length ?? 0) + 1;
      const lineH = el.fontSize * (el.lineHeight ?? 1.4);
      const h = Math.max(lineH * lines + 16, lineH + 8);
      return (
        <foreignObject x={-w / 2} y={-h / 2} width={w} height={h} style={{ overflow: 'visible' }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <textarea
              ref={editInputRef}
              value={el.text}
              rows={lines}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateLive(el.id, { text: e.target.value })}
              onBlur={() => setEditingId(null)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingId(null); }
              }}
              style={{
                width: '100%', height: '100%', resize: 'none',
                textAlign: (el.textAlign === 'start' ? 'left' : el.textAlign === 'end' ? 'right' : 'center') as React.CSSProperties['textAlign'],
                padding: '2px 4px', margin: 0,
                border: 'none', outline: '1px dashed #3b82f6',
                background: 'rgba(255,255,255,0.5)',
                fontSize: el.fontSize,
                fontFamily: el.fontFamily,
                fontWeight: el.fontWeight as React.CSSProperties['fontWeight'],
                fontStyle: el.italic ? 'italic' : 'normal',
                letterSpacing: el.letterSpacing ?? 0,
                textTransform: el.textTransform ?? 'none',
                color: el.color,
                lineHeight: el.lineHeight ?? 1.2,
              }}
            />
          </div>
        </foreignObject>
      );
    })()}
    {el.type === 'image' && (
      <image
        href={el.href}
        x={-el.width / 2}
        y={-el.height / 2}
        width={el.width}
        height={el.height}
        preserveAspectRatio="none"
      />
    )}
    {el.type !== 'text' && el.type !== 'image' && (() => {
      const w = el.strokeWidth ?? 0;
      const align = el.strokeAlign ?? 'center';
      const strokeProps = w > 0
        ? { stroke: el.strokeColor ?? '#000000', strokeWidth: align === 'center' ? w : w * 2, strokeLinejoin: 'round' as const }
        : null;
      // Pas de contour, ou contour centré : un seul tracé suffit
      if (!strokeProps || align === 'center') {
        return shapeGeom(el, { fill, ...(strokeProps ?? {}) });
      }
      // Intérieur / extérieur : fond + contour double largeur clippé/masqué
      const clipMask = align === 'inside'
        ? { clipPath: `url(#shapeclip-${el.id})` }
        : { mask: `url(#shapemask-${el.id})` };
      return (
        <>
          {shapeGeom(el, { fill })}
          {shapeGeom(el, { fill: 'none', ...strokeProps, ...clipMask })}
        </>
      );
    })()}
  </>
);
