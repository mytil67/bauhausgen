import { useComposition } from './hooks/useComposition';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';

function App() {
  const {
    elements,
    selectedId,
    backgroundColor,
    canvasWidth,
    canvasHeight,
    customColors,
    customFonts,
    addElement,
    updateElement,
    removeElement,
    selectElement,
    setBackgroundColor,
    saveColor,
    addCustomFont,
    bringToFront,
    sendToBack,
  } = useComposition();

  const selectedElement = elements.find((el) => el.id === selectedId) || null;

  const handleExport = (format: 'svg' | 'png' | 'jpg') => {
    const svgElement = document.getElementById('bauhaus-svg');
    if (!svgElement) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bauhaus-composition.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 1.0);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `bauhaus-composition.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      img.src = url;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden font-sans text-gray-900">
      <Sidebar
        selectedElement={selectedElement}
        backgroundColor={backgroundColor}
        customColors={customColors}
        customFonts={customFonts}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        onAddElement={addElement}
        onUpdateElement={updateElement}
        onRemoveElement={removeElement}
        onUpdateBackground={setBackgroundColor}
        onSaveColor={saveColor}
        onAddCustomFont={addCustomFont}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onExport={handleExport}
      />
      <main className="flex-1 h-full relative overflow-hidden flex items-center justify-center">
        <Canvas
          elements={elements}
          selectedId={selectedId}
          backgroundColor={backgroundColor}
          width={canvasWidth}
          height={canvasHeight}
          onSelect={selectElement}
          onUpdate={updateElement}
        />
        
        {/* Status Bar */}
        <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
           <span>{elements.length} éléments</span>
           <span>{canvasWidth}x{canvasHeight}px</span>
        </div>
      </main>
    </div>
  );
}

export default App;
