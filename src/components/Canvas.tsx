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
}

type ResizeHandle = 'se' | 's' | 'e';

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedId,
  backgroundColor,
  width,
  height,
  onSelect,
  onUpdate,
}) => {
  const [dragMode, setDragMode] = useState<'move' | ResizeHandle | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0, scaleX: 1, scaleY: 1 });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const svgRef = useRef<SVGSVGElement>(null);
  const elementRefs = useRef<{ [key: string]: SVGGElement | null }>({});
  const [bboxes, setBboxes] = useState<{ [key: string]: DOMRect }>({});

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
    setInitialSize({ 
      width: (el as any).width || 100, 
      height: (el as any).height || 100, 
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
      const SNAP_DISTANCE = 5;

      if (dragMode === 'move') {
        let newX = pos.x - dragOffset.x;
        let newY = pos.y - dragOffset.y;
        
        let guideX: number | null = null;
        let guideY: number | null = null;

        // Smart Guides & Snapping
        const targets = [
          { x: width / 2, y: height / 2 }, // Canvas Center
          ...elements.filter(other => other.id !== selectedId).map(other => ({ x: other.x, y: other.y }))
        ];

        targets.forEach(target => {
          if (Math.abs(newX - target.x) < SNAP_DISTANCE) {
            newX = target.x;
            guideX = target.x;
          }
          if (Math.abs(newY - target.y) < SNAP_DISTANCE) {
            newY = target.y;
            guideY = target.y;
          }
        });

        setGuides({ x: guideX, y: guideY });
        onUpdate(selectedId, { x: Math.round(newX), y: Math.round(newY) });
      } else {
        const dx = pos.x - dragOffset.x;
        const dy = pos.y - dragOffset.y;

        if (el.type === 'text') {
          if (dragMode === 'se') {
            onUpdate(selectedId, { 
              scaleX: Math.max(0.1, initialSize.scaleX + dx / 100), 
              scaleY: Math.max(0.1, initialSize.scaleY + dy / 100) 
            });
          } else if (dragMode === 'e') {
            onUpdate(selectedId, { scaleX: Math.max(0.1, initialSize.scaleX + dx / 100) });
          } else if (dragMode === 's') {
            onUpdate(selectedId, { scaleY: Math.max(0.1, initialSize.scaleY + dy / 100) });
          }
        } else {
          if (dragMode === 'se') {
            onUpdate(selectedId, { 
              width: Math.max(10, initialSize.width + dx * 2), 
              height: Math.max(10, initialSize.height + dy * 2) 
            });
          } else if (dragMode === 'e') {
            onUpdate(selectedId, { width: Math.max(10, initialSize.width + dx * 2) });
          } else if (dragMode === 's') {
            onUpdate(selectedId, { height: Math.max(10, initialSize.height + dy * 2) });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
      setGuides({ x: null, y: null });
    };

    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, selectedId, dragOffset, onUpdate, elements, initialSize, width, height]);

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
        {/* Alignment Guides */}
        {guides.x !== null && <line x1={guides.x} y1="0" x2={guides.x} y2={height} stroke="#ff00ff" strokeWidth="1" strokeDasharray="4" />}
        {guides.y !== null && <line x1="0" y1={guides.y} x2={width} y2={guides.y} stroke="#ff00ff" strokeWidth="1" strokeDasharray="4" />}

        {elements.map((el) => {
          const isSelected = el.id === selectedId;
          const transform = `translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scaleX}, ${el.scaleY})`;
          const bbox = bboxes[el.id] || { x: -50, y: -25, width: 100, height: 50 };

          return (
            <g
              key={el.id}
              ref={(ref) => { elementRefs.current[el.id] = ref; }}
              transform={transform}
              onMouseDown={(e) => handleMouseDown(e, el)}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: dragMode === 'move' && isSelected ? 'grabbing' : 'grab', opacity: el.opacity }}
            >
              {el.type === 'text' && (
                <text x="0" y="0" fontSize={el.fontSize} fontFamily={el.fontFamily} fontWeight={el.fontWeight} fill={el.color} textAnchor="middle" dominantBaseline="middle" className="select-none">
                  {el.text}
                </text>
              )}
              {el.type === 'rect' && <rect x={-el.width / 2} y={-el.height / 2} width={el.width} height={el.height} fill={el.color} />}
              {el.type === 'circle' && <circle cx="0" cy="0" r={el.width / 2} fill={el.color} />}
              {el.type === 'triangle' && <polygon points={`0,${-el.height / 2} ${el.width / 2},${el.height / 2} ${-el.width / 2},${el.height / 2}`} fill={el.color} />}
              
              {isSelected && (
                <>
                  <rect x={bbox.x - 5} y={bbox.y - 5} width={bbox.width + 10} height={bbox.height + 10} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" className="pointer-events-none" />
                  
                  {/* South-East Handle (Corners) */}
                  <rect x={bbox.x + bbox.width} y={bbox.y + bbox.height} width="10" height="10" fill="#3b82f6" className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')} />
                  
                  {/* East Handle (Horizontal Only) */}
                  <rect x={bbox.x + bbox.width} y={bbox.y + bbox.height / 2 - 5} width="10" height="10" fill="#3b82f6" className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 'e')} />
                  
                  {/* South Handle (Vertical Only) */}
                  <rect x={bbox.x + bbox.width / 2 - 5} y={bbox.y + bbox.height} width="10" height="10" fill="#3b82f6" className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, el, 's')} />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
