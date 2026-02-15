
import React, { useState } from 'react';
import { UnitType, Wall, Column, Beam, Slab, WallMaterial } from '../../types';

interface StructuralManagerModalProps {
    unit: UnitType;
    onClose: () => void;
    onUpdateUnit: (updatedUnit: UnitType) => void;
}

export const StructuralManagerModal: React.FC<StructuralManagerModalProps> = ({ unit, onClose, onUpdateUnit }) => {
    const [activeTab, setActiveTab] = useState<'wall' | 'column' | 'beam' | 'slab'>('wall');

    // --- FORM STATES ---
    // Default thickness updated to 15 to match Gazbeton 15'lik cost item
    const [wallForm, setWallForm] = useState<{len: number, mat: WallMaterial, thick: number, height: number}>({ len: 5, mat: 'gazbeton', thick: 15, height: 0 });
    const [colForm, setColForm] = useState<{w: number, d: number, h: number, count: number}>({ w: 30, d: 60, h: 0, count: 1 });
    const [beamForm, setBeamForm] = useState<{w: number, h: number, len: number, count: number}>({ w: 25, h: 50, len: 4, count: 1 });
    const [slabForm, setSlabForm] = useState<{area: number, thick: number, type: 'plak'|'asmolen'|'mantar', count: number}>({ area: 20, thick: 15, type: 'plak', count: 1 });

    const isWallAuto = unit.structuralWallSource === 'global_calculated';
    const isConcreteAuto = unit.structuralConcreteSource === 'global_calculated';

    const handleAddWall = () => {
        const newWall: Wall = {
            id: Date.now().toString(),
            startPoint: {x:0, y:0}, endPoint: {x:0, y:0}, // Dummy points
            length_px: 0,
            manualLengthM: wallForm.len,
            properties: { 
                material: wallForm.mat, 
                thickness: wallForm.thick, 
                height: wallForm.height > 0 ? wallForm.height : undefined,
                isUnderBeam: false, 
                beamHeight: 0 
            }
        };
        onUpdateUnit({ ...unit, walls: [...unit.walls, newWall] });
    };

    const handleAddColumn = () => {
        const newCols: Column[] = [];
        for(let i=0; i<colForm.count; i++) {
            const areaM2 = (colForm.w / 100) * (colForm.d / 100);
            const perimM = 2 * ((colForm.w / 100) + (colForm.d / 100));
            newCols.push({
                id: Date.now().toString() + i,
                points: [],
                area_px: 0, perimeter_px: 0,
                manualAreaM2: areaM2,
                manualPerimeterM: perimM,
                properties: { 
                    type: 'kolon', 
                    height: colForm.h > 0 ? colForm.h : undefined, // Auto if 0
                    connectingBeamHeight: 50 
                }
            });
        }
        onUpdateUnit({ ...unit, columns: [...unit.columns, ...newCols] });
    };

    const handleAddBeam = () => {
        const newBeams: Beam[] = [];
        for(let i=0; i<beamForm.count; i++) {
            newBeams.push({
                id: Date.now().toString() + i,
                startPoint: {x:0, y:0}, endPoint: {x:0, y:0},
                length_px: 0,
                manualLengthM: beamForm.len,
                properties: { width: beamForm.w, height: beamForm.h, slabThickness: 15 }
            });
        }
        onUpdateUnit({ ...unit, beams: [...unit.beams, ...newBeams] });
    };

    const handleAddSlab = () => {
        const newSlabs: Slab[] = [];
        for(let i=0; i<slabForm.count; i++) {
            newSlabs.push({
                id: Date.now().toString() + i,
                manualAreaM2: slabForm.area,
                properties: { type: slabForm.type, thickness: slabForm.thick }
            });
        }
        onUpdateUnit({ ...unit, slabs: [...(unit.slabs || []), ...newSlabs] });
    };

    const handleDelete = (type: 'wall'|'column'|'beam'|'slab', id: string) => {
        if(type === 'wall') onUpdateUnit({ ...unit, walls: unit.walls.filter(w => w.id !== id) });
        if(type === 'column') onUpdateUnit({ ...unit, columns: unit.columns.filter(c => c.id !== id) });
        if(type === 'beam') onUpdateUnit({ ...unit, beams: unit.beams.filter(b => b.id !== id) });
        if(type === 'slab') onUpdateUnit({ ...unit, slabs: (unit.slabs || []).filter(s => s.id !== id) });
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[80vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h3 className="text-white font-bold text-lg">{unit.name} - Yapısal Detaylar</h3>
                        <p className="text-xs text-slate-400">Çizimden bağımsız manuel eleman ekleme ve düzenleme paneli</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
                </div>

                {/* WARNING BANNER FOR AUTO MODE */}
                {(isWallAuto || isConcreteAuto) && (
                    <div className="bg-yellow-900/40 border-b border-yellow-600/30 p-3 px-6 flex items-start gap-3 animate-fadeIn">
                        <i className="fas fa-exclamation-triangle text-yellow-500 mt-0.5 text-lg"></i>
                        <div className="text-xs text-yellow-200/90">
                            <strong className="block text-yellow-100 mb-1">DİKKAT: Otomatik Hesaplama Modu Aktif</strong>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {isWallAuto && <li>Duvar metrajı şu an <b>Otomatik (m² bazlı)</b> hesaplanıyor. Buraya eklediğiniz duvarlar maliyete yansımaz.</li>}
                                {isConcreteAuto && <li>Betonarme metrajı şu an <b>Otomatik (m² bazlı)</b> hesaplanıyor. Buraya eklediğiniz elemanlar maliyete yansımaz.</li>}
                            </ul>
                            <div className="mt-1 text-yellow-400/80 italic">Maliyete yansıması için ana ekrandan ilgili modu "Detaylı" olarak değiştiriniz.</div>
                        </div>
                    </div>
                )}

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col">
                        <button onClick={() => setActiveTab('wall')} className={`p-4 text-left font-bold text-sm border-l-4 transition ${activeTab==='wall' ? 'bg-slate-800 border-yellow-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-th-large w-6"></i> Duvarlar
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{unit.walls.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('column')} className={`p-4 text-left font-bold text-sm border-l-4 transition ${activeTab==='column' ? 'bg-slate-800 border-red-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-square w-6"></i> Kolonlar
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{unit.columns.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('beam')} className={`p-4 text-left font-bold text-sm border-l-4 transition ${activeTab==='beam' ? 'bg-slate-800 border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-grip-lines w-6"></i> Kirişler
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{unit.beams.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('slab')} className={`p-4 text-left font-bold text-sm border-l-4 transition ${activeTab==='slab' ? 'bg-slate-800 border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-layer-group w-6"></i> Döşemeler
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{(unit.slabs || []).length}</span>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col bg-slate-800/20">
                        {/* Input Area */}
                        <div className="p-4 bg-slate-800 border-b border-slate-700">
                            {activeTab === 'wall' && (
                                <div className="flex gap-4 items-end">
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Malzeme</label>
                                    <select value={wallForm.mat} onChange={e=>setWallForm({...wallForm, mat: e.target.value as any})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-32"><option value="gazbeton">Gazbeton</option><option value="tugla">Tuğla</option><option value="briket">Briket</option><option value="alcipan">Alçıpan</option></select></div>
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Kalınlık (cm)</label>
                                    <select value={wallForm.thick} onChange={e=>setWallForm({...wallForm, thick: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-24">
                                        <option value={10}>10</option>
                                        <option value={13.5}>13.5</option>
                                        <option value={15}>15</option>
                                        <option value={20}>20</option>
                                        <option value={25}>25</option>
                                    </select></div>
                                    
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Yükseklik (m)</label>
                                    <input type="number" step="0.01" value={wallForm.height || ''} onChange={e=>setWallForm({...wallForm, height: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" placeholder="Oto" /></div>

                                    <div className="flex-1"><label className="text-[10px] text-slate-400 font-bold block mb-1">Uzunluk (m)</label>
                                    <input type="number" value={wallForm.len} onChange={e=>setWallForm({...wallForm, len: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full" /></div>
                                    <button onClick={handleAddWall} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                            {activeTab === 'column' && (
                                <div className="flex gap-4 items-end">
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">En (cm)</label>
                                    <input type="number" value={colForm.w} onChange={e=>setColForm({...colForm, w: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" /></div>
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Boy (cm)</label>
                                    <input type="number" value={colForm.d} onChange={e=>setColForm({...colForm, d: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" /></div>
                                    
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Yükseklik (m)</label>
                                    <input type="number" value={colForm.h || ''} onChange={e=>setColForm({...colForm, h: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" placeholder="Oto" /></div>
                                    
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                    <input type="number" value={colForm.count} onChange={e=>setColForm({...colForm, count: Math.max(1, parseInt(e.target.value))})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-16" /></div>
                                    <button onClick={handleAddColumn} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                             {activeTab === 'beam' && (
                                <div className="flex gap-4 items-end">
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">En (cm)</label>
                                    <input type="number" value={beamForm.w} onChange={e=>setBeamForm({...beamForm, w: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" /></div>
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Yükseklik (cm)</label>
                                    <input type="number" value={beamForm.h} onChange={e=>setBeamForm({...beamForm, h: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" /></div>
                                    <div className="flex-1"><label className="text-[10px] text-slate-400 font-bold block mb-1">Uzunluk (m)</label>
                                    <input type="number" value={beamForm.len} onChange={e=>setBeamForm({...beamForm, len: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full" /></div>
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                    <input type="number" value={beamForm.count} onChange={e=>setBeamForm({...beamForm, count: Math.max(1, parseInt(e.target.value))})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-16" /></div>
                                    <button onClick={handleAddBeam} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                            {activeTab === 'slab' && (
                                <div className="flex gap-4 items-end">
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Tip</label>
                                    <select value={slabForm.type} onChange={e=>setSlabForm({...slabForm, type: e.target.value as any})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-28"><option value="plak">Plak</option><option value="asmolen">Asmolen</option><option value="mantar">Mantar</option></select></div>
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Kalınlık (cm)</label>
                                    <input type="number" value={slabForm.thick} onChange={e=>setSlabForm({...slabForm, thick: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-20" /></div>
                                    <div className="flex-1"><label className="text-[10px] text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                    <input type="number" value={slabForm.area} onChange={e=>setSlabForm({...slabForm, area: parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full" /></div>
                                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                    <input type="number" value={slabForm.count} onChange={e=>setSlabForm({...slabForm, count: Math.max(1, parseInt(e.target.value))})} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-16" /></div>
                                    <button onClick={handleAddSlab} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-bold">
                                    <tr>
                                        <th className="p-2 rounded-l">Tip / Özellik</th>
                                        <th className="p-2">Boyutlar</th>
                                        <th className="p-2">Metraj</th>
                                        <th className="p-2">Kaynak</th>
                                        <th className="p-2 rounded-r text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {activeTab === 'wall' && unit.walls.map((w, i) => (
                                        <tr key={w.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-2 font-medium text-white">{w.properties.material} ({w.properties.thickness}cm)</td>
                                            <td className="p-2">
                                                H: {w.properties.height ? `${w.properties.height}m` : 'Oto'}
                                            </td>
                                            <td className="p-2 font-mono text-yellow-400">
                                                {w.manualLengthM ? w.manualLengthM.toFixed(2) : (unit.scale > 0 ? (w.length_px/unit.scale).toFixed(2) : 0)} m
                                            </td>
                                            <td className="p-2 text-xs">{w.manualLengthM ? <span className="text-green-500">Manuel</span> : <span className="text-blue-500">Çizim</span>}</td>
                                            <td className="p-2 text-right"><button onClick={()=>handleDelete('wall', w.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                        </tr>
                                    ))}
                                    {activeTab === 'column' && unit.columns.map((c, i) => (
                                        <tr key={c.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-2 font-medium text-white">{c.properties.type}</td>
                                            <td className="p-2">H: {c.properties.height || 'Oto'}m</td>
                                            <td className="p-2 font-mono text-red-400">
                                                {c.manualAreaM2 ? c.manualAreaM2.toFixed(2) : (unit.scale > 0 ? (c.area_px/(unit.scale**2)).toFixed(2) : 0)} m²
                                            </td>
                                            <td className="p-2 text-xs">{c.manualAreaM2 ? <span className="text-green-500">Manuel</span> : <span className="text-blue-500">Çizim</span>}</td>
                                            <td className="p-2 text-right"><button onClick={()=>handleDelete('column', c.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                        </tr>
                                    ))}
                                    {activeTab === 'beam' && unit.beams.map((b, i) => (
                                        <tr key={b.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-2 font-medium text-white">Kiriş</td>
                                            <td className="p-2">{b.properties.width}x{b.properties.height} cm</td>
                                            <td className="p-2 font-mono text-blue-400">
                                                {b.manualLengthM ? b.manualLengthM.toFixed(2) : (unit.scale > 0 ? (b.length_px/unit.scale).toFixed(2) : 0)} m
                                            </td>
                                            <td className="p-2 text-xs">{b.manualLengthM ? <span className="text-green-500">Manuel</span> : <span className="text-blue-500">Çizim</span>}</td>
                                            <td className="p-2 text-right"><button onClick={()=>handleDelete('beam', b.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                        </tr>
                                    ))}
                                    {activeTab === 'slab' && (unit.slabs || []).map((s, i) => (
                                        <tr key={s.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-2 font-medium text-white capitalize">{s.properties.type} Döşeme</td>
                                            <td className="p-2">d: {s.properties.thickness} cm</td>
                                            <td className="p-2 font-mono text-purple-400">
                                                {s.manualAreaM2.toFixed(2)} m²
                                            </td>
                                            <td className="p-2 text-xs"><span className="text-green-500">Manuel</span></td>
                                            <td className="p-2 text-right"><button onClick={()=>handleDelete('slab', s.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {(activeTab === 'wall' && unit.walls.length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı duvar yok.</div>}
                             {(activeTab === 'column' && unit.columns.length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı kolon yok.</div>}
                             {(activeTab === 'beam' && unit.beams.length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı kiriş yok.</div>}
                             {(activeTab === 'slab' && (unit.slabs || []).length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı döşeme yok.</div>}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Kapat</button>
                </div>
            </div>
        </div>
    );
};
