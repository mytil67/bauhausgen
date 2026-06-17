import React from 'react';
import { Trash2, Copy, LayoutTemplate, ArrowUp, ArrowDown, Download, ChevronUp, ChevronDown } from 'lucide-react';
import type { CompositionElement } from '../../types';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  selectionCount: number;
  selectedIds: string[];
  elements: CompositionElement[];
  hasCopiedStyle: boolean;
  onClose: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onCopyStyle: (id: string) => void;
  onPasteStyle: (ids: string[]) => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  onRemoveSelection: (ids: string[]) => void;
  onPaste: () => void;
}

const itemCls = 'flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors';

/** Menu contextuel (clic droit sur le canvas) : actions sur la sélection ou « coller ». */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  x, y, selectionCount, selectedIds, elements, hasCopiedStyle, onClose,
  onGroup, onUngroup, onDuplicate, onCopy, onCopyStyle, onPasteStyle,
  onBringToFront, onBringForward, onSendBackward, onSendToBack, onRemoveSelection, onPaste,
}) => {
  const run = (fn: () => void) => () => { fn(); onClose(); };
  return (
    <div
      className="fixed z-[9999] bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden py-1.5 w-52 flex flex-col font-sans"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {selectionCount > 0 ? (
        <>
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 mb-1">Sélection ({selectionCount})</div>
          {selectionCount >= 2 && (
            <button onClick={run(onGroup)} className={itemCls}>
              <Copy size={14} className="opacity-60" /> Grouper <span className="ml-auto text-[10px] opacity-40">Ctrl+G</span>
            </button>
          )}
          {selectedIds.some((id) => elements.find((e) => e.id === id)?.groupId) && (
            <button onClick={run(onUngroup)} className={itemCls}>
              <LayoutTemplate size={14} className="opacity-60" /> Dégrouper <span className="ml-auto text-[10px] opacity-40">Ctrl+Maj+G</span>
            </button>
          )}
          <div className="h-px bg-gray-100 my-1 mx-2" />
          <button onClick={run(onDuplicate)} className={itemCls}>
            <Copy size={14} className="opacity-60" /> Dupliquer <span className="ml-auto text-[10px] opacity-40">Ctrl+D</span>
          </button>
          <button onClick={run(onCopy)} className={itemCls}>
            <Copy size={14} className="opacity-60" /> Copier <span className="ml-auto text-[10px] opacity-40">Ctrl+C</span>
          </button>
          {selectionCount === 1 && (
            <button onClick={run(() => onCopyStyle(selectedIds[0]))} className={itemCls}>
              <Copy size={14} className="opacity-60" /> Copier la mise en forme <span className="ml-auto text-[10px] opacity-40">Ctrl+Alt+C</span>
            </button>
          )}
          {hasCopiedStyle && (
            <button onClick={run(() => onPasteStyle(selectedIds))} className={itemCls}>
              <Download size={14} className="opacity-60" /> Coller la mise en forme <span className="ml-auto text-[10px] opacity-40">Ctrl+Alt+V</span>
            </button>
          )}
          <div className="h-px bg-gray-100 my-1 mx-2" />
          <button onClick={run(onBringToFront)} className={itemCls}>
            <ArrowUp size={14} className="opacity-60" /> Tout devant
          </button>
          <button onClick={run(onBringForward)} className={itemCls}>
            <ChevronUp size={14} className="opacity-60" /> Avancer
          </button>
          <button onClick={run(onSendBackward)} className={itemCls}>
            <ChevronDown size={14} className="opacity-60" /> Reculer
          </button>
          <button onClick={run(onSendToBack)} className={itemCls}>
            <ArrowDown size={14} className="opacity-60" /> Tout derrière
          </button>
          <div className="h-px bg-gray-100 my-1 mx-2" />
          <button onClick={run(() => onRemoveSelection(selectedIds))} className="flex items-center gap-3 px-3 py-1.5 hover:bg-red-50 hover:text-red-700 text-xs text-red-600 font-medium transition-colors">
            <Trash2 size={14} className="opacity-60" /> Supprimer <span className="ml-auto text-[10px] opacity-40">Suppr</span>
          </button>
        </>
      ) : (
        <button onClick={run(onPaste)} className={itemCls}>
          <Download size={14} className="opacity-60" /> Coller ici <span className="ml-auto text-[10px] opacity-40">Ctrl+V</span>
        </button>
      )}
    </div>
  );
};
