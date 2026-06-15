import { useState, useCallback, useEffect } from 'react';
import type { CompositionElement, CompositionState, ElementType } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;
const STORAGE_KEY = 'bauhaus-composition-state';

export const useComposition = () => {
  const [state, setState] = useState<CompositionState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load state from localStorage', e);
      }
    }
    return {
      elements: [],
      selectedId: null,
      backgroundColor: '#ffffff',
      canvasWidth: DEFAULT_WIDTH,
      canvasHeight: DEFAULT_HEIGHT,
      customColors: [],
      customFonts: [],
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addElement = useCallback((type: ElementType) => {
    const id = uuidv4();
    const newElement: CompositionElement = type === 'text' 
      ? {
          id,
          type: 'text',
          x: state.canvasWidth / 2,
          y: state.canvasHeight / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          color: '#000000',
          opacity: 1,
          text: 'BAUHAUS',
          fontSize: 60,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
        }
      : {
          id,
          type: type as 'rect' | 'circle' | 'triangle',
          x: state.canvasWidth / 2,
          y: state.canvasHeight / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          color: '#e63946',
          opacity: 1,
          width: 100,
          height: 100,
        };

    setState((prev) => ({
      ...prev,
      elements: [...prev.elements, newElement],
      selectedId: id,
    }));
  }, [state.canvasWidth, state.canvasHeight]);

  const updateElement = useCallback((id: string, updates: Partial<CompositionElement>) => {
    setState((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updates } as CompositionElement : el)),
    }));
  }, []);

  const removeElement = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id),
      selectedId: prev.selectedId === id ? null : prev.selectedId,
    }));
  }, []);

  const selectElement = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, selectedId: id }));
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    setState((prev) => ({ ...prev, backgroundColor: color }));
  }, []);

  const saveColor = useCallback((color: string) => {
    if (!color || color === 'transparent') return;
    setState((prev) => {
      if (prev.customColors.includes(color)) return prev;
      return {
        ...prev,
        customColors: [color, ...prev.customColors].slice(0, 16),
      };
    });
  }, []);

  const addCustomFont = useCallback((fontName: string) => {
    setState((prev) => ({
      ...prev,
      customFonts: [...prev.customFonts, fontName],
    }));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setState((prev) => {
      const element = prev.elements.find((el) => el.id === id);
      if (!element) return prev;
      return {
        ...prev,
        elements: [...prev.elements.filter((el) => el.id !== id), element],
      };
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setState((prev) => {
      const element = prev.elements.find((el) => el.id === id);
      if (!element) return prev;
      return {
        ...prev,
        elements: [element, ...prev.elements.filter((el) => el.id !== id)],
      };
    });
  }, []);

  const alignElements = useCallback((direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    setState(prev => {
      if (prev.elements.length < 2) return prev;
      
      const selected = prev.elements.filter(el => prev.selectedId ? el.id === prev.selectedId : true);
      if (selected.length < 1) return prev;

      let targetVal = 0;
      if (direction === 'left') targetVal = Math.min(...selected.map(el => el.x));
      if (direction === 'right') targetVal = Math.max(...selected.map(el => el.x));
      if (direction === 'center') targetVal = selected.reduce((sum, el) => sum + el.x, 0) / selected.length;
      if (direction === 'top') targetVal = Math.min(...selected.map(el => el.y));
      if (direction === 'bottom') targetVal = Math.max(...selected.map(el => el.y));
      if (direction === 'middle') targetVal = selected.reduce((sum, el) => sum + el.y, 0) / selected.length;

      return {
        ...prev,
        elements: prev.elements.map(el => {
          if (prev.selectedId && el.id !== prev.selectedId) return el;
          if (['left', 'center', 'right'].includes(direction)) return { ...el, x: targetVal };
          return { ...el, y: targetVal };
        })
      };
    });
  }, []);

  const distributeElements = useCallback((axis: 'horizontal' | 'vertical') => {
    setState(prev => {
      const targets = prev.elements;
      if (targets.length < 3) return prev;

      const sorted = [...targets].sort((a, b) => axis === 'horizontal' ? a.x - b.x : a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalDist = axis === 'horizontal' ? (last.x - first.x) : (last.y - first.y);
      const step = totalDist / (sorted.length - 1);

      return {
        ...prev,
        elements: prev.elements.map(el => {
          const index = sorted.findIndex(s => s.id === el.id);
          if (axis === 'horizontal') return { ...el, x: first.x + (index * step) };
          return { ...el, y: first.y + (index * step) };
        })
      };
    });
  }, []);

  const clearCanvas = useCallback(() => {
    if (window.confirm('Voulez-vous vraiment vider le canvas ?')) {
      setState((prev) => ({
        ...prev,
        elements: [],
        selectedId: null,
        backgroundColor: '#ffffff',
      }));
    }
  }, []);

  return {
    ...state,
    addElement,
    updateElement,
    removeElement,
    selectElement,
    setBackgroundColor,
    saveColor,
    addCustomFont,
    bringToFront,
    sendToBack,
    clearCanvas,
    alignElements,
    distributeElements,
  };
};
