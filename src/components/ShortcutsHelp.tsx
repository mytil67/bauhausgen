import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsHelpProps {
  onClose: () => void;
}

type Row = { keys: string[]; label: string };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: 'Édition',
    rows: [
      { keys: ['Ctrl', 'Z'], label: 'Annuler' },
      { keys: ['Ctrl', 'Maj', 'Z'], label: 'Rétablir' },
      { keys: ['Ctrl', 'D'], label: 'Dupliquer' },
      { keys: ['Ctrl', 'C'], label: 'Copier' },
      { keys: ['Ctrl', 'X'], label: 'Couper' },
      { keys: ['Ctrl', 'V'], label: 'Coller' },
      { keys: ['Suppr'], label: "Supprimer l'élément" },
    ],
  },
  {
    title: 'Mise en forme',
    rows: [
      { keys: ['Ctrl', 'Alt', 'C'], label: 'Copier la mise en forme' },
      { keys: ['Ctrl', 'Alt', 'V'], label: 'Coller la mise en forme' },
      { keys: ['Double-clic'], label: 'Éditer un texte' },
    ],
  },
  {
    title: 'Sélection',
    rows: [
      { keys: ['Ctrl', 'A'], label: 'Tout sélectionner' },
      { keys: ['Échap'], label: 'Désélectionner' },
      { keys: ['Glisser sur le fond'], label: 'Cadre de sélection (marquee)' },
      { keys: ['Maj', 'clic'], label: 'Ajouter / retirer de la sélection' },
    ],
  },
  {
    title: 'Disposition',
    rows: [
      { keys: ['Ctrl', 'G'], label: 'Grouper' },
      { keys: ['Ctrl', 'Maj', 'G'], label: 'Dégrouper' },
      { keys: ['←', '↑', '→', '↓'], label: 'Déplacer de 1 px' },
      { keys: ['Maj', '+ flèches'], label: 'Déplacer de 10 px' },
    ],
  },
  {
    title: 'Souris',
    rows: [
      { keys: ['Maj', '+ redimensionner'], label: 'Conserver les proportions' },
      { keys: ['Alt', '+ redimensionner'], label: 'Depuis le centre (sinon bord opposé fixe)' },
      { keys: ['Maj', '+ pivoter'], label: 'Rotation par pas de 15°' },
    ],
  },
  {
    title: 'Vue',
    rows: [
      { keys: ['Ctrl', '+'], label: 'Zoomer' },
      { keys: ['Ctrl', '-'], label: 'Dézoomer' },
      { keys: ['Ctrl', '0'], label: 'Zoom 100 %' },
      { keys: ['Ctrl', 'molette'], label: 'Zoom à la souris' },
    ],
  },
];

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[20px] h-6 px-1.5 rounded border border-gray-300 bg-gray-50 text-[11px] font-mono font-semibold text-gray-600 shadow-sm">
    {children}
  </kbd>
);

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2">
            <Keyboard size={16} className="text-blue-500" /> Raccourcis clavier
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Fermer (Échap)">
            <X size={18} />
          </button>
        </header>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{g.title}</h3>
              <div className="space-y-1.5">
                {g.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-600">{r.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {r.keys.map((k, j) => <Key key={j}>{k}</Key>)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="px-5 py-3 border-t border-gray-100 text-[10px] text-gray-400 text-center">
          Astuce : appuie sur <Key>?</Key> à tout moment pour rouvrir ce panneau.
        </footer>
      </div>
    </div>
  );
};
