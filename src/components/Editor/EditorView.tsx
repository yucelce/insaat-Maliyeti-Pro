import React, { useEffect, useRef } from 'react';
import { UnitType, Room, Wall, Column, Beam, Point } from '../../types';
import { CostCategory } from '../../../cost_data';
import { isPointInPolygon } from '../../utils/geometry';
import { CostSummaryPanel } from '../Shared/CostSummaryPanel';

interface EditorViewProps {
    unit: UnitType | undefined;
    editorScale: number;
    editorImage: HTMLImageElement | null;
    saveAndExitEditor: () => void;
    mode: 'view' | 'calibrate' | 'draw' | 'magic' | 'select' | 'draw_wall' | 'draw_column' | 'draw_beam';
    setMode: (mode: any) => void;
    setDrawingPoints: (pts: Point[]) => void;
    setDrawingWallStart: (pt: Point | null) => void;
    setCalibrationPoints: (pts: Point[]) => void;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    editorRooms: Room[];
    editorWalls: Wall[];
    editorColumns: Column[];
    editorBeams: Beam[];
    openRoomModal: (r: Room) => void;
    openWallModal: (w: Wall) => void;
    openColumnModal: (c: Column) => void;
    openBeamModal: (b: Beam) => void;
    selectedRoomId: string | null;
    selectedWallId: string | null;
    selectedColumnId: string | null;
    selectedBeamId: string | null;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    handleMouseDown: (e: React.MouseEvent) => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    costs: CostCategory[];
    editorStats: any;
    editorQuantities: Record<string, number>;
    drawingPoints: Point[];
    drawingWallStart: Point | null;
    calibrationPoints: Point[];
    cursorPos: Point | null;
    editorScope: 'architectural' | 'structural';
    handleUpdateCostItem: (catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
    unit,
    editorScale,
    editorImage,
    saveAndExitEditor,
    mode,
    setMode,
    setDrawingPoints,
    setDrawingWallStart,
    setCalibrationPoints,
    handleImageUpload,
    editorRooms,
    editorWalls,
    editorColumns,
    editorBeams,
    openRoomModal,
    openWallModal,
    openColumnModal,
    openBeamModal,
    selectedRoomId,
    selectedWallId,
    selectedColumnId,
    selectedBeamId,
    zoom,
    setZoom,
    handleMouseDown,
    handleMouseMove,
    canvasRef,
    containerRef,
    costs,
    editorStats,
    editorQuantities,
    drawingPoints,
    drawingWallStart,
    calibrationPoints,
    cursorPos,
    editorScope,
    handleUpdateCostItem
}) => {
    
    // Canvas Drawing Logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (editorImage) ctx.drawImage(editorImage, 0, 0);

        // 1. Draw Columns
        editorColumns.forEach((col, idx) => {
            if(col.points.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(col.points[0].x, col.points[0].y);
            for(let i=1; i<col.points.length; i++) ctx.lineTo(col.points[i].x, col.points[i].y);
            ctx.closePath();
            
            // Dim if not in scope
            const isActive = editorScope === 'structural';
            ctx.fillStyle = isActive ? (col.id === selectedColumnId ? '#ef4444' : '#475569') : 'rgba(71, 85, 105, 0.3)';
            ctx.fill();
            ctx.strokeStyle = isActive ? '#1e293b' : 'rgba(30, 41, 59, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label for Column
            if (isActive) {
                const cx = col.points.reduce((acc, p) => acc + p.x, 0) / col.points.length;
                const cy = col.points.reduce((acc, p) => acc + p.y, 0) / col.points.length;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`S${idx + 1}`, cx, cy);
            }
        });

        // 2. Draw Beams
        editorBeams.forEach((beam, idx) => {
            ctx.beginPath();
            ctx.moveTo(beam.startPoint.x, beam.startPoint.y);
            ctx.lineTo(beam.endPoint.x, beam.endPoint.y);
            
            const isActive = editorScope === 'structural';
            const isSelected = beam.id === selectedBeamId;
            const visualWidth = Math.max(6, beam.properties.width / 3); 
            
            ctx.lineWidth = visualWidth;
            ctx.strokeStyle = isActive ? (isSelected ? '#ef4444' : '#0ea5e9') : 'rgba(14, 165, 233, 0.3)'; 
            ctx.lineCap = 'butt';
            ctx.stroke();
            
            if (isActive) {
                ctx.beginPath();
                ctx.moveTo(beam.startPoint.x, beam.startPoint.y);
                ctx.lineTo(beam.endPoint.x, beam.endPoint.y);
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#fff';
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label for Beam
                const cx = (beam.startPoint.x + beam.endPoint.x) / 2;
                const cy = (beam.startPoint.y + beam.endPoint.y) / 2;
                const text = `K${idx + 1}`;
                const width = ctx.measureText(text).width;
                ctx.fillStyle = '#0ea5e9'; 
                ctx.fillRect(cx - width/2 - 2, cy - 6, width + 4, 12);
                ctx.fillStyle = '#fff'; 
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, cx, cy);
            }
        });

        // 3. Draw Rooms
        editorRooms.forEach(room => {
        if (room.points.length === 0) return;
        const pts = room.points;
        if (pts.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();

        const isActive = editorScope === 'architectural';

        if (room.type) {
            ctx.fillStyle = isActive ? (room.type === 'wet' ? 'rgba(59, 130, 246, 0.4)' : 
                            room.type === 'living' ? 'rgba(249, 115, 22, 0.4)' : 
                            room.type === 'balcony' ? 'rgba(34, 197, 94, 0.4)' :
                            'rgba(148, 163, 184, 0.4)') : 'rgba(200, 200, 200, 0.1)';
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        }
        ctx.fill();

        const isSelected = room.id === selectedRoomId;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeStyle = isActive ? (isSelected ? '#ef4444' : (room.type ? '#333' : '#dc2626')) : 'rgba(0,0,0,0.1)';
        ctx.stroke();

        if (editorScale > 0 && room.type && isActive) {
            const cx = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
            const cy = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(cx - 30, cy - 12, 60, 24);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${room.name}`, cx, cy);
        }
        });

        // 4. Draw Walls
        editorWalls.forEach(wall => {
            ctx.beginPath();
            ctx.moveTo(wall.startPoint.x, wall.startPoint.y);
            ctx.lineTo(wall.endPoint.x, wall.endPoint.y);
            ctx.lineCap = 'round';
            
            const isActive = editorScope === 'structural';
            const isSelected = wall.id === selectedWallId;
            const visualThickness = Math.max(3, (wall.properties.thickness / 5)); 

            ctx.lineWidth = isSelected ? visualThickness + 4 : visualThickness;
            ctx.strokeStyle = isActive ? (isSelected ? '#ef4444' : 
                            wall.properties.material === 'gazbeton' ? '#facc15' : 
                            wall.properties.material === 'tugla' ? '#f97316' : 
                            wall.properties.material === 'briket' ? '#a8a29e' : '#cbd5e1') : 'rgba(200,200,200,0.3)';
            ctx.stroke();

            if (isSelected && isActive) {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.arc(wall.startPoint.x, wall.startPoint.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(wall.endPoint.x, wall.endPoint.y, 4, 0, Math.PI*2); ctx.fill();
            }
        });

        // Drawing Active State
        if ((mode === 'draw' || mode === 'draw_column') && drawingPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
        for (let i = 1; i < drawingPoints.length; i++) ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
        if (cursorPos) ctx.lineTo(cursorPos.x, cursorPos.y);
        ctx.strokeStyle = mode === 'draw_column' ? '#ef4444' : '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        }

        if ((mode === 'draw_wall' || mode === 'draw_beam') && drawingWallStart && cursorPos) {
            ctx.beginPath();
            ctx.moveTo(drawingWallStart.x, drawingWallStart.y);
            ctx.lineTo(cursorPos.x, cursorPos.y);
            ctx.strokeStyle = mode === 'draw_beam' ? '#0ea5e9' : '#eab308'; 
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        
        if (mode === 'calibrate') {
        calibrationPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#db2777';
            ctx.fill();
        });
        if (calibrationPoints.length > 0 && cursorPos && calibrationPoints.length < 2) {
            ctx.beginPath();
            ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
            ctx.lineTo(cursorPos.x, cursorPos.y);
            ctx.strokeStyle = '#db2777';
            ctx.stroke();
        }
        }
        
        if (mode === 'magic' && cursorPos) {
            ctx.beginPath();
            ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#8b5cf6';
            ctx.stroke();
        }

    }, [editorImage, editorRooms, editorWalls, editorColumns, editorBeams, drawingPoints, drawingWallStart, calibrationPoints, cursorPos, mode, selectedRoomId, selectedWallId, selectedColumnId, selectedBeamId, editorScale, costs, editorScope]);


    return (
    <div className="flex h-screen flex-col bg-slate-900 overflow-hidden font-sans text-slate-200">
      
      {/* Editor Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-2 shadow-md z-10 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={saveAndExitEditor} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded flex items-center gap-2 border border-slate-700 transition text-sm">
                <i className="fas fa-arrow-left"></i> Panoya Dön
            </button>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
                <h2 className="font-bold text-white text-sm">{unit?.name} <span className="text-slate-500 font-normal">{editorScope === 'architectural' ? 'Mimari Plan' : 'Statik Plan'}</span></h2>
            </div>
             <div className="bg-slate-800 px-3 py-1 rounded text-xs border border-slate-700">
                <span className="text-slate-400 mr-2">Mod:</span>
                <span className={`font-bold uppercase ${editorScope === 'architectural' ? 'text-purple-400' : 'text-orange-400'}`}>
                    {editorScope === 'architectural' ? 'Oda & Mahal' : 'Kaba Yapı'}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-3">
             {editorScale > 0 ? (
                <span className="text-green-400 text-xs font-mono bg-slate-800 px-2 py-1 rounded border border-green-900"><i className="fas fa-ruler mr-1"></i>1m = {editorScale.toFixed(2)}px</span>
            ) : (
                <span className="text-red-400 text-xs bg-slate-800 px-2 py-1 rounded border border-red-900 animate-pulse"><i className="fas fa-exclamation-circle mr-1"></i>Ölçeklenmedi</span>
            )}
             <button onClick={saveAndExitEditor} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-bold shadow-lg shadow-green-500/20">
                Kaydet & Kapat
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Toolbar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl">
             <div className="p-3 border-b border-slate-800 grid grid-cols-4 gap-1">
                <button onClick={() => setMode('view')} className={`p-2 rounded transition ${mode === 'view' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Gezinme"><i className="fas fa-arrows-alt"></i></button>
                
                {/* ARCHITECTURAL TOOLS */}
                {editorScope === 'architectural' && (
                    <>
                    <button onClick={() => { setMode('draw'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Oda Çiz"><i className="fas fa-vector-square"></i></button>
                    <button onClick={() => setMode('magic')} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'magic' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Sihirli Değnek"><i className="fas fa-wand-magic-sparkles"></i></button>
                    </>
                )}

                {/* STRUCTURAL TOOLS */}
                {editorScope === 'structural' && (
                    <>
                    <button onClick={() => { setMode('draw_wall'); setDrawingWallStart(null); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_wall' ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Duvar Çiz"><i className="fas fa-minus"></i></button>
                    <button onClick={() => { setMode('draw_column'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_column' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Kolon/Perde"><i className="fas fa-square"></i></button>
                    <button onClick={() => { setMode('draw_beam'); setDrawingWallStart(null); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_beam' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Kiriş"><i className="fas fa-grip-lines"></i></button>
                    </>
                )}

                {/* COMMON TOOLS */}
                <button onClick={() => { setMode('calibrate'); setCalibrationPoints([]); }} disabled={!editorImage} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'calibrate' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Kalibre Et"><i className="fas fa-ruler-combined"></i></button>
             </div>

             <div className="p-4 flex flex-col gap-3 border-b border-slate-800">
                <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-xs font-bold text-center cursor-pointer border border-slate-700 transition">
                    <i className="fas fa-file-image mr-2"></i>Plan Görseli Yükle
                    <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                </label>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {/* Rooms List - Only Architectural */}
                {editorScope === 'architectural' && (
                    <>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 px-2 flex justify-between items-center">
                        <span>Odalar</span>
                        <span className="text-[9px] bg-slate-800 px-1 rounded">{editorRooms.length}</span>
                    </div>
                    <div className="space-y-1 mb-4">
                        {editorRooms.map((room) => (
                            <button key={room.id} onClick={() => openRoomModal(room)} className={`w-full text-left p-2 rounded border transition flex items-center justify-between group ${selectedRoomId === room.id ? 'bg-blue-600/20 border-blue-500/50 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                <div className="flex items-center gap-2 overflow-hidden"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span className="text-xs truncate font-medium">{room.name}</span></div>
                            </button>
                        ))}
                    </div>
                    </>
                )}

                {/* Structure List - Only Structural */}
                {editorScope === 'structural' && (
                    <>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 px-2 flex justify-between items-center border-t border-slate-800 pt-2">
                        <span>Yapısal Elemanlar</span>
                        <span className="text-[9px] bg-slate-800 px-1 rounded">{editorWalls.length + editorColumns.length + editorBeams.length}</span>
                    </div>
                    <div className="space-y-1">
                         {editorWalls.map((wall, idx) => (
                            <button key={wall.id} onClick={() => openWallModal(wall)} className={`w-full text-left p-2 rounded border transition flex items-center justify-between group ${selectedWallId === wall.id ? 'bg-yellow-600/20 border-yellow-500/50 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                <div className="flex items-center gap-2 overflow-hidden"><i className="fas fa-minus text-[8px] text-yellow-500"></i><span className="text-xs truncate font-medium">Duvar {idx + 1}</span></div>
                            </button>
                        ))}
                        {editorColumns.map((col, idx) => (
                            <button key={col.id} onClick={() => openColumnModal(col)} className={`w-full text-left p-2 rounded border transition flex items-center justify-between group ${selectedColumnId === col.id ? 'bg-red-600/20 border-red-500/50 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                <div className="flex items-center gap-2 overflow-hidden"><i className="fas fa-square text-[8px] text-red-500"></i><span className="text-xs truncate font-medium">{col.properties.type === 'perde' ? 'Perde' : 'Kolon'} {idx + 1}</span></div>
                            </button>
                        ))}
                        {editorBeams.map((beam, idx) => (
                            <button key={beam.id} onClick={() => openBeamModal(beam)} className={`w-full text-left p-2 rounded border transition flex items-center justify-between group ${selectedBeamId === beam.id ? 'bg-blue-600/20 border-blue-500/50 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                <div className="flex items-center gap-2 overflow-hidden"><i className="fas fa-grip-lines text-[8px] text-blue-500"></i><span className="text-xs truncate font-medium">Kiriş {idx + 1}</span></div>
                            </button>
                        ))}
                    </div>
                    </>
                )}
             </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col">
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-slate-800/90 p-1 rounded border border-slate-700 shadow-xl backdrop-blur">
                <button onClick={() => setZoom(z => Math.min(z + 0.2, 5))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-600 rounded"><i className="fas fa-plus"></i></button>
                <span className="text-center text-xs text-slate-400 font-mono select-none">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.2))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-600 rounded"><i className="fas fa-minus"></i></button>
            </div>
            <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-center p-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                <canvas 
                    ref={canvasRef} 
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}
                    className={`shadow-2xl border border-slate-700 ${mode === 'calibrate' ? 'cursor-crosshair' : mode.startsWith('draw') ? 'cursor-cell' : mode === 'magic' ? 'cursor-crosshair' : 'cursor-default'}`}
                />
            </div>
        </div>

        {/* Right Cost Panel */}
        <CostSummaryPanel 
            unit={unit}
            costs={costs}
            quantities={editorQuantities}
            scope={editorScope}
            onUpdateCostItem={handleUpdateCostItem}
            structuralStats={editorStats}
        />
      </div>
    </div>
    );
};