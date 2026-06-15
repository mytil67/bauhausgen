import React, { useState, useRef, useEffect } from 'react';
import type { CompositionElement } from '../types';

interface CanvasProps {
  elements: CompositionElement[];
  selectedId: string | null;
  backgroundColor: string;
  width: number;
  height: number;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<CompositionElement>) => void;
  onRemove: (id: string) => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedId,
  backgroundColor,
  width,
  height,
  onSelect,
  onUpdate,
  onRemove,
}) => {
  const [dragMode, setDragMode] = useState<'move' | ResizeHandle | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0, scaleX: 1, scaleY: 1 });
  const [activeGuides, setActiveGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [measurements, setMeasurements] = useState<{ x1: number, y1: number, x2: number, y2: number, value: number, label: string }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const elementRefs = useRef<{ [key: string]: SVGGElement | null }>({});
  const [bboxes, setBboxes] = useState<{ [key: string]: DOMRect }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;
      
      // Don't trigger if typing in a textarea/input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const el = elements.find(item => item.id === selectedId);
      if (!el) return;

      const step = e.shiftKey ? 10 : 1;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          onRemove(selectedId);
          break;
        case 'ArrowLeft':
          onUpdate(selectedId, { x: el.x - step });
          break;
        case 'ArrowRight':
          onUpdate(selectedId, { x: el.x + step });
          break;
        case 'ArrowUp':
          onUpdate(selectedId, { y: el.y - step });
          break;
        case 'ArrowDown':
          onUpdate(selectedId, { y: el.y + step });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, elements, onRemove, onUpdate]);

  const getMousePosition = (e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d,
    };
  };

  useEffect(() => {
    const newBboxes: { [key: string]: DOMRect } = {};
    elements.forEach((el) => {
      const ref = elementRefs.current[el.id];
      if (ref) {
        const content = ref.querySelector('text, rect, circle, polygon') as SVGGraphicsElement;
        if (content) {
          newBboxes[el.id] = content.getBBox();
        }
      }
    });
    setBboxes(newBboxes);
  }, [elements, selectedId]);

  const handleMouseDown = (e: React.MouseEvent, el: CompositionElement) => {
    e.stopPropagation();
    onSelect(el.id);
    setDragMode('move');
    const pos = getMousePosition(e);
    setDragOffset({
      x: pos.x - el.x,
      y: pos.y - el.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, el: CompositionElement, handle: ResizeHandle) => {
    e.stopPropagation();
    onSelect(el.id);
    setDragMode(handle);
    const pos = getMousePosition(e);
    setDragOffset({ x: pos.x, y: pos.y });
    
    // Use bbox if available, otherwise fallback to element property or 100
    const bbox = bboxes[el.id];
    const width = bbox ? bbox.width : ('width' in el ? el.width : 100);
    const height = bbox ? bbox.height : ('height' in el ? el.height : 100);
    
    setInitialSize({ 
      width, 
      height, 
      scaleX: el.scaleX, 
      scaleY: el.scaleY 
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragMode || !selectedId) return;
      const el = elements.find(item => item.id === selectedId);
      if (!el) return;

      const pos = getMousePosition(e);
      const SNAP_DISTANCE = 8;

      if (dragMode === 'move') {
        const mouseX = pos.x - dragOffset.x;
        const mouseY = pos.y - dragOffset.y;
        
        let newX = mouseX;
        let newY = mouseY;
        
        const currentBbox = bboxes[selectedId] || { x: -50, y: -25, width: 100, height: 50 };
        const halfW = (currentBbox.width / 2) * el.scaleX;
        const halfH = (currentBbox.height / 2) * el.scaleY;

        const snapX: number[] = [];
        const snapY: number[] = [];

        // Collect all possible snap points (Edges + Centers)
        const targetsX = new Set<number>([0, width / 2, width]);
        const targetsY = new Set<number>([0, height / 2, height]);

        elements.forEach(other => {
          if (other.id === selectedId) return;
          const otherBbox = bboxes[other.id] || { x: -50, y: -25, width: 100, height: 50 };
          const oHalfW = (otherBbox.width / 2) * other.scaleX;
          const oHalfH = (otherBbox.height / 2) * other.scaleY;

          targetsX.add(other.x); // Center
          targetsX.add(other.x - oHalfW); // Left
          targetsX.add(other.x + oHalfW); // Right

          targetsY.add(other.y); // Center
          targetsY.add(other.y - oHalfH); // Top
          targetsY.add(other.y + oHalfH); // Bottom
        });

        // Check horizontal snaps
        let bestDiffX = SNAP_DISTANCE;
        targetsX.forEach(tx => {
          // Check dragged center
          if (Math.abs(mouseX - tx) < bestDiffX) {
            newX = tx;
            bestDiffX = Math.abs(mouseX - tx);
            snapX.push(tx);
          }
          // Check dragged left
          if (Math.abs((mouseX - halfW) - tx) < bestDiffX) {
            newX = tx + halfW;
            bestDiffX = Math.abs((mouseX - halfW) - tx);
            snapX.push(tx);
          }
          // Check dragged right
          if (Math.abs((mouseX + halfW) - tx) < bestDiffX) {
            newX = tx - halfW;
            bestDiffX = Math.abs((mouseX + halfW) - tx);
            snapX.push(tx);
          }
        });

        // Check vertical snaps
        let bestDiffY = SNAP_DISTANCE;
        targetsY.forEach(ty => {
          if (Math.abs(mouseY - ty) < bestDiffY) {
            newY = ty;
            bestDiffY = Math.abs(mouseY - ty);
            snapY.push(ty);
          }
          if (Math.abs((mouseY - halfH) - ty) < bestDiffY) {
            newY = ty + halfH;
            bestDiffY = Math.abs((mouseY - halfH) - ty);
            snapY.push(ty);
          }
          if (Math.abs((mouseY + halfH) - ty) < bestDiffY) {
            newY = ty - halfH;
            bestDiffY = Math.abs((mouseY + halfH) - ty);
            snapY.push(ty);
          }
        });

        // Keep only the current active snap lines
        setActiveGuides({ 
          x: snapX.filter(val => Math.abs(val - (newX - halfW)) < 1 || Math.abs(val - newX) < 1 || Math.abs(val - (newX + halfW)) < 1), 
          y: snapY.filter(val => Math.abs(val - (newY - halfH)) < 1 || Math.abs(val - newY) < 1 || Math.abs(val - (newY + halfH)) < 1) 
        });

        // Dynamic Measurements (Minimalist Pro UI)
        const newMeasurements: typeof measurements = [];
        
        // Helper to find closest targets
        const findClosest = (val: number, targets: number[]) => {
          return targets.reduce((prev, curr) => Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev, targets[0]);
        };

        const canvasX = [0, width];
        const canvasY = [0, height];
        const otherX: number[] = [];
        const otherY: number[] = [];

        elements.forEach(other => {
          if (other.id === selectedId) return;
          const otherBbox = bboxes[other.id] || { x: -50, y: -25, width: 100, height: 50 };
          const oHalfW = (otherBbox.width / 2) * other.scaleX;
          const oHalfH = (otherBbox.height / 2) * other.scaleY;
          otherX.push(other.x - oHalfW, other.x + oHalfW);
          otherY.push(other.y - oHalfH, other.y + oHalfH);
        });

        // 1. Measure Horizontal (Closest)
        const leftTarget = findClosest(newX - halfW, [...canvasX, ...otherX].filter(t => t <= newX - halfW));
        const rightTarget = findClosest(newX + halfW, [...canvasX, ...otherX].filter(t => t >= newX + halfW));
        
        if (leftTarget !== undefined) newMeasurements.push({ x1: leftTarget, y1: newY, x2: newX - halfW, y2: newY, value: Math.round(newX - halfW - leftTarget), label: 'H' });
        if (rightTarget !== undefined) newMeasurements.push({ x1: newX + halfW, y1: newY, x2: rightTarget, y2: newY, value: Math.round(rightTarget - (newX + halfW)), label: 'H' });

        // 2. Measure Vertical (Closest)
        const topTarget = findClosest(newY - halfH, [...canvasY, ...otherY].filter(t => t <= newY - halfH));
        const bottomTarget = findClosest(newY + halfH, [...canvasY, ...otherY].filter(t => t >= newY + halfH));

        if (topTarget !== undefined) newMeasurements.push({ x1: newX, y1: topTarget, x2: newX, y2: newY - halfH, value: Math.round(newY - halfH - topTarget), label: 'V' });
        if (bottomTarget !== undefined) newMeasurements.push({ x1: newX, y1: newY + halfH, x2: newX, y2: bottomTarget, value: Math.round(bottomTarget - (newY + halfH)), label: 'V' });

        // 3. EQUAL Spacing Check (Simplified visualization)
        elements.forEach(other => {
          if (other.id === selectedId) return;
          const otherBbox = bboxes[other.id] || { x: -50, y: -25, width: 100, height: 50 };
          const oHalfW = (otherBbox.width / 2) * other.scaleX;
          const oHalfH = (otherBbox.height / 2) * other.scaleY;

          const gapX = Math.round(Math.abs(newX - other.x) - (halfW + oHalfW));
          const gapY = Math.round(Math.abs(newY - other.y) - (halfH + oHalfH));

          elements.forEach(third => {
            if (third.id === selectedId || third.id === other.id) return;
            const thirdBbox = bboxes[third.id] || { x: -50, y: -25, width: 100, height: 50 };
            const tHalfW = (thirdBbox.width / 2) * third.scaleX;
            const tHalfH = (thirdBbox.height / 2) * third.scaleY;
            const tGapX = Math.round(Math.abs(other.x - third.x) - (oHalfW + tHalfW));
            const tGapY = Math.round(Math.abs(other.y - third.y) - (oHalfH + tHalfH));

            if (gapX > 0 && Math.abs(gapX - tGapX) < 4 && Math.abs(newY - other.y) < 20) {
               newX = other.x + (newX > other.x ? (oHalfW + halfW + tGapX) : -(oHalfW + halfW + tGapX));
               newMeasurements.push({ x1: other.x + (newX > other.x ? oHalfW : -oHalfW), y1: other.y, x2: third.x + (other.x > third.x ? -tHalfW : tHalfW), y2: other.y, value: tGapX, label: 'EQUAL' });
            }
            if (gapY > 0 && Math.abs(gapY - tGapY) < 4 && Math.abs(newX - other.x) < 20) {
               newY = other.y + (newY > other.y ? (oHalfH + halfH + tGapY) : -(oHalfH + halfH + tGapY));
               newMeasurements.push({ x1: other.x, y1: other.y + (newY > other.y ? oHalfH : -oHalfH), x2: other.x, y2: third.y + (other.y > third.y ? -tHalfH : tHalfH), value: tGapY, label: 'EQUAL' });
            }
          });
        });

        setMeasurements(newMeasurements.filter(m => m.value > 1));
        onUpdate(selectedId, { x: Math.round(newX), y: Math.round(newY) });
      } else {
        let mouseX = pos.x;
        let mouseY = pos.y;
        
        const snapX: number[] = [];
        const snapY: number[] = [];

        // Collect all possible snap points
        const targetsX = new Set<number>([0, width / 2, width]);
        const targetsY = new Set<number>([0, height / 2, height]);

        elements.forEach(other => {
          if (other.id === selectedId) return;
          const otherBbox = bboxes[other.id] || { x: -50, y: -25, width: 100, height: 50 };
          const oHalfW = (otherBbox.width / 2) * other.scaleX;
          const oHalfH = (otherBbox.height / 2) * other.scaleY;
          targetsX.add(other.x);
          targetsX.add(other.x - oHalfW);
          targetsX.add(other.x + oHalfW);
          targetsY.add(other.y);
          targetsY.add(other.y - oHalfH);
          targetsY.add(other.y + oHalfH);
        });

        // Snap the mouse position (the handle)
        targetsX.forEach(tx => {
          if (Math.abs(mouseX - tx) < SNAP_DISTANCE) {
            mouseX = tx;
            snapX.push(tx);
          }
        });
        targetsY.forEach(ty => {
          if (Math.abs(mouseY - ty) < SNAP_DISTANCE) {
            mouseY = ty;
            snapY.push(ty);
          }
        });

        const dx = mouseX - dragOffset.x;
        const dy = mouseY - dragOffset.y;

        setActiveGuides({ x: snapX, y: snapY });
        setMeasurements([]); // Hide measurements during resize for clarity

        // Determine multiplier based on handle position
        let multX = 0;
        let multY = 0;

        if (dragMode.includes('e')) multX = 1;
        if (dragMode.includes('w')) multX = -1;
        if (dragMode.includes('s')) multY = 1;
        if (dragMode.includes('n')) multY = -1;

        if (el.type === 'text') {
          const ratioX = 1 + (dx * multX * 2) / Math.max(1, initialSize.width);
          const ratioY = 1 + (dy * multY * 2) / Math.max(1, initialSize.height);

          const updates: Partial<CompositionElement> = {};
          if (multX !== 0) updates.scaleX = Math.max(0.1, initialSize.scaleX * ratioX);
          if (multY !== 0) updates.scaleY = Math.max(0.1, initialSize.scaleY * ratioY);
          onUpdate(selectedId, updates);
        } else if (el.type === 'circle') {
          // Circles always maintain aspect ratio
          const delta = Math.max(dx * multX, dy * multY);
          if (multX !== 0 || multY !== 0) {
            onUpdate(selectedId, { 
              width: Math.max(10, initialSize.width + delta * 2),
              height: Math.max(10, initialSize.width + delta * 2)
            });
          }
        } else {
          const updates: Partial<CompositionElement> = {};
          if (multX !== 0) updates.width = Math.max(10, initialSize.width + dx * multX * 2);
          if (multY !== 0) updates.height = Math.max(10, initialSize.height + dy * multY * 2);
          onUpdate(selectedId, updates);
        }
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
      setActiveGuides({ x: [], y: [] });
      setMeasurements([]);
    };

    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, selectedId, dragOffset, onUpdate, elements, initialSize, width, height, bboxes]);

  return (
    <div className="flex items-center justify-center bg-gray-200 p-8 w-full h-full overflow-auto">
      <svg
        ref={svgRef}
        id="bauhaus-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ backgroundColor }}
        className="shadow-2xl cursor-default"
        onClick={(e) => {
          if (e.target === svgRef.current) onSelect(null);
        }}
      >
        {elements.map((el) => {
          const isSelected = el.id === selectedId;
          // Split transform: outer for position/rotation, inner for scale
          const outerTransform = `translate(${el.x}, ${el.y}) rotate(${el.rotation})`;
          const innerTransform = `scale(${el.scaleX}, ${el.scaleY})`;
          const bbox = bboxes[el.id] || { x: -50, y: -25, width: 100, height: 50 };
          
          // Scaled dimensions for the selection UI
          const sw = bbox.width * el.scaleX;
          const sh = bbox.height * el.scaleY;
          const sx = bbox.x * el.scaleX;
          const sy = bbox.y * el.scaleY;

          return (
            <g
              key={el.id}
              ref={(ref) => { elementRefs.current[el.id] = ref; }}
              transform={outerTransform}
              onMouseDown={(e) => handleMouseDown(e, el)}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: dragMode === 'move' && isSelected ? 'grabbing' : 'grab', opacity: el.opacity }}
            >
              {/* Scaled Content Layer */}
              <g transform={innerTransform}>
                {el.type === 'text' && (
                  <text x="0" y="0" fontSize={el.fontSize} fontFamily={el.fontFamily} fontWeight={el.fontWeight} fill={el.color} textAnchor="middle" dominantBaseline="middle" className="select-none">
                    {el.text}
                  </text>
                )}
                {el.type === 'rect' && <rect x={-el.width / 2} y={-el.height / 2} width={el.width} height={el.height} fill={el.color} />}
                {el.type === 'circle' && <circle cx="0" cy="0" r={el.width / 2} fill={el.color} />}
                {el.type === 'triangle' && <polygon points={`0,${-el.height / 2} ${el.width / 2},${el.height / 2} ${-el.width / 2},${el.height / 2}`} fill={el.color} />}
              </g>
              
              {/* Constant-size Selection UI Layer (not affected by innerTransform scale) */}
              {isSelected && (
                <>
                  <rect x={sx - 5} y={sy - 5} width={sw + 10} height={sh + 10} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4" className="pointer-events-none" />
                  
                  {/* Corners */}
                  <rect x={sx - 10} y={sy - 10} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')} />
                  <rect x={sx + sw} y={sy - 10} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-nesw-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')} />
                  <rect x={sx - 10} y={sy + sh} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-nesw-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')} />
                  <rect x={sx + sw} y={sy + sh} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')} />
                  
                  {/* Mid-points */}
                  <rect x={sx + sw / 2 - 5} y={sy - 10} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'n')} />
                  <rect x={sx + sw / 2 - 5} y={sy + sh} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 's')} />
                  <rect x={sx - 10} y={sy + sh / 2 - 5} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'w')} />
                  <rect x={sx + sw} y={sy + sh / 2 - 5} width="10" height="10" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'e')} />
                </>
              )}
            </g>
          );
        })}

        {/* Overlay Layer (Guides & Measurements) */}
        <g className="pointer-events-none">
          {/* Alignment Guides */}
          {activeGuides.x.map((x, i) => <line key={`gx-${i}`} x1={x} y1="0" x2={x} y2={height} stroke="#ff00ff" strokeWidth="1" strokeDasharray="4" />)}
          {activeGuides.y.map((y, i) => <line key={`gy-${i}`} x1="0" y1={y} x2={width} y2={y} stroke="#ff00ff" strokeWidth="1" strokeDasharray="4" />)}

          {/* Measurements */}
          {measurements.map((m, i) => {
            const labelStr = m.value.toString();
            const labelW = Math.max(20, labelStr.length * 8 + 8);
            const isVertical = m.x1 === m.x2;
            const isDistribution = m.label === 'EQUAL';
            const color = isDistribution ? "#f59e0b" : "#3b82f6";
            
            // Calculate arrow points
            const arrowSize = 4;
            const renderArrows = m.value > 15; // Only show arrows if space allows

            return (
              <g key={`m-${i}`}>
                {/* Segment Line */}
                <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={color} strokeWidth="1" />
                
                {/* Arrows */}
                {renderArrows && (
                  isVertical ? (
                    <>
                      <path d={`M${m.x1-arrowSize},${m.y1+arrowSize} L${m.x1},${m.y1} L${m.x1+arrowSize},${m.y1+arrowSize}`} fill="none" stroke={color} strokeWidth="1" />
                      <path d={`M${m.x1-arrowSize},${m.y2-arrowSize} L${m.x1},${m.y2} L${m.x1+arrowSize},${m.y2-arrowSize}`} fill="none" stroke={color} strokeWidth="1" />
                    </>
                  ) : (
                    <>
                      <path d={`M${m.x1+arrowSize},${m.y1-arrowSize} L${m.x1},${m.y1} L${m.x1+arrowSize},${m.y1+arrowSize}`} fill="none" stroke={color} strokeWidth="1" />
                      <path d={`M${m.x2-arrowSize},${m.y1-arrowSize} L${m.x2},${m.y1} L${m.x2-arrowSize},${m.y1+arrowSize}`} fill="none" stroke={color} strokeWidth="1" />
                    </>
                  )
                )}

                {/* Compact Label */}
                <rect 
                  x={(m.x1 + m.x2) / 2 - labelW / 2} 
                  y={(m.y1 + m.y2) / 2 - 7} 
                  width={labelW} 
                  height="14" 
                  fill={color} 
                  rx="2" 
                />
                <text 
                  x={(m.x1 + m.x2) / 2} 
                  y={(m.y1 + m.y2) / 2} 
                  fontSize="8" 
                  fontWeight="bold" 
                  fill="white" 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                  className="select-none font-mono"
                >
                  {m.value}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
