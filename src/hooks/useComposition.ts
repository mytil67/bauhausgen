import { useState, useCallback } from 'react';
import type { CompositionElement, CompositionState, ElementType } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;

export const useComposition = () => {
  const [state, setState] = useState<CompositionState>({
    elements: [],
    selectedId: null,
    backgroundColor: '#ffffff',
    canvasWidth: DEFAULT_WIDTH,
    canvasHeight: DEFAULT_HEIGHT,
    customColors: [],
    customFonts: [],
  });

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
  };
};
