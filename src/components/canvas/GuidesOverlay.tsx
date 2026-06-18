import React from 'react';
import type { Measurement } from './smartGuides';

interface GuidesOverlayProps {
  /** Positions des lignes d'alignement actives (rouge), en coords canvas. */
  activeGuides: { x: number[]; y: number[] };
  /** Mesures d'espacement (flèches + badge rose) calculées pendant le drag. */
  measurements: Measurement[];
  width: number;
  height: number;
  /** Épaisseur de trait compensée du zoom (1 / zoom). */
  strokeGuide: number;
  zoom: number;
}

/**
 * Overlay présentationnel dessiné pendant un déplacement en sélection unique :
 * lignes d'alignement (rouge) + doubles flèches d'espacement avec badge de valeur (rose).
 * Aucune logique — il ne fait qu'afficher ce que `computeMoveSnap` a produit.
 */
export const GuidesOverlay: React.FC<GuidesOverlayProps> = ({
  activeGuides, measurements, width, height, strokeGuide, zoom,
}) => (
  <g className="pointer-events-none export-ignore">
    {/* Lignes d'alignement (rouge, nettes) */}
    {activeGuides.x.map((x, i) => <line key={`gx-${i}`} x1={x} y1="0" x2={x} y2={height} stroke="#f43f5e" strokeWidth={strokeGuide} />)}
    {activeGuides.y.map((y, i) => <line key={`gy-${i}`} x1="0" y1={y} x2={width} y2={y} stroke="#f43f5e" strokeWidth={strokeGuide} />)}

    {/* Badges d'espacement (bleu) / espacement égal (rose) */}
    {measurements.map((m, i) => {
      const isVertical = m.x1 === m.x2;
      const color = m.kind === 'equal' ? '#ec4899' : '#ec4899'; // On utilise le rose partout pour un look Canva/Figma cohérent
      const labelW = Math.max(20, String(m.value).length * 6 + 10) / zoom;
      const labelH = 14 / zoom;
      const mx = (m.x1 + m.x2) / 2;
      const my = (m.y1 + m.y2) / 2;
      const a = 4 / zoom; // taille des têtes de flèche

      // On centre le label sur la ligne
      const labelCx = mx;
      const labelCy = my;

      return (
        <g key={`m-${i}`}>
          {/* Zone d'espacement (très subtile) */}
          {m.kind === 'equal' && (
            <rect
              x={isVertical ? m.x1 - 10 / zoom : Math.min(m.x1, m.x2)}
              y={isVertical ? Math.min(m.y1, m.y2) : m.y1 - 10 / zoom}
              width={isVertical ? 20 / zoom : Math.abs(m.x2 - m.x1)}
              height={isVertical ? Math.abs(m.y2 - m.y1) : 20 / zoom}
              fill={color}
              opacity="0.05"
            />
          )}

          {/* Ligne principale */}
          <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={color} strokeWidth={strokeGuide} />

          {/* Têtes de flèches (double flèche) */}
          {isVertical ? (
            <>
              <path d={`M${m.x1 - a},${m.y1 + a} L${m.x1},${m.y1} L${m.x1 + a},${m.y1 + a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
              <path d={`M${m.x2 - a},${m.y2 - a} L${m.x2},${m.y2} L${m.x2 + a},${m.y2 - a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
            </>
          ) : (
            <>
              <path d={`M${m.x1 + a},${m.y1 - a} L${m.x1},${m.y1} L${m.x1 + a},${m.y1 + a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
              <path d={`M${m.x2 - a},${m.y2 - a} L${m.x2},${m.y2} L${m.x2 - a},${m.y2 + a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
            </>
          )}

          {/* Petit carré (badge) avec la valeur */}
          <rect
            x={labelCx - labelW / 2}
            y={labelCy - labelH / 2}
            width={labelW}
            height={labelH}
            fill={color}
            rx={2 / zoom}
          />
          <text
            x={labelCx}
            y={labelCy}
            fontSize={8 / zoom}
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none font-sans"
          >
            {m.value}
          </text>
        </g>
      );
    })}
  </g>
);
