import React, { useState } from 'react';
import type { CompositionElement } from '../types';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, GripVertical,
  Type, Square, Circle, Triangle, Minus, Layers,
} from 'lucide-react';

interface LayersPanelProps {
  elements: CompositionElement[];
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onReorder: (orderedIds: string[]) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

const typeIcon = (type: CompositionElement['type']) => {
  switch (type) {
    case 'text': return <Type size={13} />;
    case 'rect': return <Square size={13} />;
    case 'circle':
    case 'ring': return <Circle size={13} />;
    case 'triangle':
    case 'semicircle':
    case 'quarter': return <Triangle size={13} />;
    case 'line': return <Minus size={13} />;
    default: return <Square size={13} />;
  }
};

const labelFor = (el: CompositionElement) =>
  el.name || (el.type === 'text' ? el.text : el.type);

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onToggleVisible,
  onToggleLock,
  onRename,
  onRemove,
}) => {
  // Affichage du premier plan (dernier du tableau) vers l'arrière-plan
  const ordered = [...elements].reverse();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = ordered.map((el) => el.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    // ids est en ordre affiché (avant→arrière) : on repasse en ordre tableau (arrière→avant)
    onReorder([...ids].reverse());
    setDragId(null);
    setOverId(null);
  };

  const commitRename = (id: string) => {
    if (draft.trim()) onRename(id, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="w-64 h-full bg-white/95 backdrop-blur-xl border-l border-gray-100 flex flex-col shadow-2xl z-10">
      <h2 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 p-5 pb-3 border-b border-gray-100 flex items-center gap-2">
        <Layers size={12} /> Calques <span className="opacity-50">({elements.length})</span>
      </h2>
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {ordered.length === 0 && (
          <p className="text-gray-300 text-xs text-center px-4 py-8 italic">Aucun élément.</p>
        )}
        {ordered.map((el) => {
          const selected = selectedIds.includes(el.id);
          const hidden = el.visible === false;
          return (
            <div
              key={el.id}
              draggable
              onDragStart={() => setDragId(el.id)}
              onDragOver={(e) => { e.preventDefault(); setOverId(el.id); }}
              onDrop={() => handleDrop(el.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onClick={(e) => onSelect(el.id, e.shiftKey)}
              className={`group flex items-center gap-1 px-1.5 py-1.5 rounded text-xs cursor-pointer mb-0.5 border
                ${selected ? 'bg-blue-50 border-blue-300' : 'border-transparent hover:bg-gray-50'}
                ${overId === el.id && dragId !== el.id ? 'border-t-2 border-t-blue-500' : ''}`}
            >
              <GripVertical size={13} className="text-gray-300 shrink-0 cursor-grab" />
              <span className={`shrink-0 ${hidden ? 'text-gray-300' : 'text-gray-500'}`}>{typeIcon(el.type)}</span>

              {editingId === el.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(el.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(el.id); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 px-1 py-0.5 border border-blue-300 rounded text-xs"
                />
              ) : (
                <span
                  className={`flex-1 min-w-0 truncate ${hidden ? 'text-gray-300' : 'text-gray-700'}`}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(el.id); setDraft(labelFor(el)); }}
                  title={labelFor(el)}
                >
                  {labelFor(el)}
                </span>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); onToggleLock(el.id); }}
                className={`shrink-0 p-0.5 rounded hover:bg-gray-200 ${el.locked ? 'text-gray-700' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                title={el.locked ? 'Déverrouiller' : 'Verrouiller'}
              >
                {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisible(el.id); }}
                className={`shrink-0 p-0.5 rounded hover:bg-gray-200 ${hidden ? 'text-gray-400' : 'text-gray-600 opacity-0 group-hover:opacity-100'}`}
                title={hidden ? 'Afficher' : 'Masquer'}
              >
                {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(el.id); }}
                className="shrink-0 p-0.5 rounded text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
