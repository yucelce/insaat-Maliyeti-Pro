
import React, { useState, useMemo } from 'react';
import { UnitType, Room, RoomType, RoomProperties, BuildingStats } from '../../types';
import { CostCategory } from '../../../cost_data';
import { calculateUnitCost } from '../../utils/calculations';
import { CostSummaryPanel } from '../Shared/CostSummaryPanel';

interface RoomManagerModalProps {
    unit: UnitType;
    onClose: () => void;
    onUpdateUnit: (updatedUnit: UnitType) => void;
    costs: CostCategory[];
    buildingStats: BuildingStats;
    onUpdateCostItem: (catId: string, itemName: string, field: 'manualPrice', value: number | undefined) => void;
}

export const RoomManagerModal: React.FC<RoomManagerModalProps> = ({ 
    unit, 
    onClose, 
    onUpdateUnit, 
    costs, 
    buildingStats, 
    onUpdateCostItem 
}) => {
    // Default form state
    const [form, setForm] = useState<{
        name: string;
        type: RoomType;
        area: number;
        perimeter: number;
        height: number | undefined; // Changed to allow undefined for Auto
        windowArea: number;
        doorCount: number;
        floor: 'parke' | 'seramik' | 'beton';
        wall: 'boya' | 'seramik';
        cornice: boolean;
    }>({
        name: '',
        type: 'living',
        area: 0,
        perimeter: 0,
        height: undefined, // Default to Auto
        windowArea: 2,
        doorCount: 1,
        floor: 'parke',
        wall: 'boya',
        cornice: true
    });

    // Calculate Costs on the fly based on current unit state
    const { quantities } = useMemo(() => {
        return calculateUnitCost(unit, costs, buildingStats);
    }, [unit, costs, buildingStats]);

    const handleTypeChange = (type: RoomType) => {
        let defaultName = '';
        let defaultFloor: any = 'parke';
        let defaultWall: any = 'boya';
        let defaultCornice = true;

        switch(type) {
            case 'living': defaultName = 'Salon/Oda'; break;
            case 'wet': defaultName = 'Banyo/Mutfak'; defaultFloor='seramik'; defaultWall='seramik'; defaultCornice=false; break;
            case 'balcony': defaultName = 'Balkon'; defaultFloor='seramik'; defaultWall='boya'; defaultCornice=false; break;
            case 'other': defaultName = 'Antre/Hol'; defaultFloor='seramik'; defaultWall='boya'; break;
        }

        setForm(prev => ({
            ...prev,
            type,
            name: defaultName,
            floor: defaultFloor,
            wall: defaultWall,
            cornice: defaultCornice
        }));
    };

    const handleAreaChange = (val: string) => {
        const newArea = parseFloat(val);
        let newPerimeter = form.perimeter;
        if (!isNaN(newArea) && newArea > 0) {
            newPerimeter = parseFloat((14 * Math.sqrt(newArea / 12)).toFixed(2));
        }
        setForm(prev => ({ ...prev, area: newArea, perimeter: newPerimeter }));
    };

    const handleAddRoom = () => {
        if (form.area <= 0) { alert("Lütfen geçerli bir alan giriniz."); return; }
        const newRoom: Room = {
            id: Date.now().toString(), name: form.name || 'Yeni Oda', points: [], area_px: 0, perimeter_px: 0,
            manualAreaM2: form.area, manualPerimeterM: form.perimeter, type: form.type,
            properties: { 
                ceilingHeight: form.height, // Will be undefined if Auto
                windowArea: form.windowArea, 
                doorCount: form.doorCount, 
                hasCornice: form.cornice, 
                floorType: form.floor as any, 
                wallFinish: form.wall as any 
            }
        };
        onUpdateUnit({ ...unit, rooms: [...unit.rooms, newRoom] });
        setForm(prev => ({ ...prev, name: '', area: 0, perimeter: 0 }));
    };

    const handleDeleteRoom = (id: string) => { onUpdateUnit({ ...unit, rooms: unit.rooms.filter(r => r.id !== id) }); };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-[95vw] flex flex-col h-[90vh] transition-colors duration-300">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{unit.name} - Oda & Mahal Listesi</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Çizim yapmadan manuel oda tanımlama paneli</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><i className="fas fa-times text-xl"></i></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT: Input Form */}
                    <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto custom-scrollbar p-4 space-y-4">
                        <h4 className="font-bold text-blue-500 dark:text-blue-400 text-sm uppercase mb-2">Yeni Oda Ekle</h4>
                        
                        {/* Type Selection */}
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                {id: 'living', icon: 'fa-couch', label: 'Salon'},
                                {id: 'wet', icon: 'fa-bath', label: 'Islak'},
                                {id: 'balcony', icon: 'fa-sun', label: 'Balkon'},
                                {id: 'other', icon: 'fa-door-open', label: 'Diğer'}
                            ].map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => handleTypeChange(t.id as RoomType)}
                                    className={`p-2 rounded border text-xs flex flex-col items-center gap-1 transition ${form.type === t.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                >
                                    <i className={`fas ${t.icon}`}></i>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Oda İsmi</label>
                            <input type="text" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-sm" placeholder="Örn: Çocuk Odası" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                <input 
                                    type="number" 
                                    value={form.area || ''} 
                                    onChange={e => handleAreaChange(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none transition" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Çevre (m)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={form.perimeter || ''} 
                                        onChange={e=>setForm({...form, perimeter: parseFloat(e.target.value)})} 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-sm focus:border-green-500 outline-none transition" 
                                        placeholder="Oto" 
                                    />
                                    <span className="absolute right-2 top-2 text-[9px] text-green-500 font-bold opacity-60">4:3</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Tavan Yük. (m)</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={form.height || ''} 
                                    onChange={e=> {
                                        const val = parseFloat(e.target.value);
                                        setForm({...form, height: isNaN(val) ? undefined : val});
                                    }} 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500" 
                                    placeholder="Oto"
                                />
                                <p className="text-[9px] text-slate-500 mt-1">Boş ise kat yüksekliği.</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Kapı Adeti</label>
                                <input type="number" value={form.doorCount} onChange={e=>setForm({...form, doorCount: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Pencere Alanı (m²)</label>
                            <input type="number" step="0.1" value={form.windowArea} onChange={e=>setForm({...form, windowArea: parseFloat(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-sm" placeholder="Duvar düşümü için" />
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                             <div className="mb-2">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Zemin</label>
                                <select value={form.floor} onChange={e=>setForm({...form, floor: e.target.value as any})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs text-slate-900 dark:text-white">
                                    <option value="parke">Laminat Parke</option>
                                    <option value="seramik">Seramik</option>
                                    <option value="beton">Brüt Beton</option>
                                </select>
                             </div>
                             <div className="mb-2">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Duvar</label>
                                <select value={form.wall} onChange={e=>setForm({...form, wall: e.target.value as any})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs text-slate-900 dark:text-white">
                                    <option value="boya">Boya</option>
                                    <option value="seramik">Seramik</option>
                                </select>
                             </div>
                             <label className="flex items-center gap-2 cursor-pointer mt-2">
                                <input type="checkbox" checked={form.cornice} onChange={e=>setForm({...form, cornice: e.target.checked})} className="accent-blue-500" />
                                <span className="text-xs text-slate-600 dark:text-slate-300">Kartonpiyer Var</span>
                             </label>
                        </div>

                        <button onClick={handleAddRoom} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded shadow-lg mt-4">
                            <i className="fas fa-plus mr-2"></i>Ekle
                        </button>
                    </div>

                    {/* CENTER: List Area */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800/20 flex flex-col">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Ekli Odalar ({unit.rooms.length})</span>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Toplam Alan: <span className="text-slate-900 dark:text-white font-bold ml-1">
                                    {unit.rooms.reduce((acc, r) => acc + (r.manualAreaM2 || (r.area_px > 0 && unit.scale > 0 ? r.area_px/(unit.scale**2) : 0)), 0).toFixed(2)} m²
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                             {unit.rooms.length === 0 ? (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-60">
                                     <i className="fas fa-vector-square text-6xl mb-4"></i>
                                     <p>Henüz oda eklenmemiş.</p>
                                     <p className="text-xs">Soldaki panelden manuel oda ekleyebilirsiniz.</p>
                                 </div>
                             ) : (
                                <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                                    <thead className="bg-slate-200 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-500 font-bold">
                                        <tr>
                                            <th className="p-3 rounded-l">Oda Adı</th>
                                            <th className="p-3">Tip</th>
                                            <th className="p-3">Alan (m²)</th>
                                            <th className="p-3">Çevre (m)</th>
                                            <th className="p-3">Yükseklik</th>
                                            <th className="p-3">Zemin/Duvar</th>
                                            <th className="p-3 rounded-r text-right">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                        {unit.rooms.map((room) => (
                                            <tr key={room.id} className="hover:bg-slate-100 dark:hover:bg-slate-700/30 transition">
                                                <td className="p-3 font-medium text-slate-900 dark:text-white">{room.name}</td>
                                                <td className="p-3">
                                                    {room.type === 'wet' && <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded">Islak</span>}
                                                    {room.type === 'living' && <span className="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-[10px] px-2 py-0.5 rounded">Yaşam</span>}
                                                    {room.type === 'balcony' && <span className="bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-[10px] px-2 py-0.5 rounded">Balkon</span>}
                                                    {room.type === 'other' && <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded">Diğer</span>}
                                                </td>
                                                <td className="p-3 font-mono text-yellow-600 dark:text-yellow-400">
                                                    {room.manualAreaM2 
                                                        ? room.manualAreaM2.toFixed(2) 
                                                        : (unit.scale > 0 ? (room.area_px / (unit.scale**2)).toFixed(2) : '0.00')
                                                    }
                                                </td>
                                                <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                                                    {room.manualPerimeterM
                                                        ? room.manualPerimeterM.toFixed(2)
                                                        : (unit.scale > 0 ? (room.perimeter_px / unit.scale).toFixed(2) : '0.00')
                                                    }
                                                </td>
                                                <td className="p-3 text-xs text-slate-500 dark:text-slate-400">
                                                    {room.properties.ceilingHeight ? `${room.properties.ceilingHeight}m` : <span className="text-blue-500 font-bold">Oto</span>}
                                                </td>
                                                <td className="p-3 text-xs text-slate-500 dark:text-slate-400">
                                                    {room.properties.floorType} / {room.properties.wallFinish}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => handleDeleteRoom(room.id)} className="text-red-500 hover:text-white p-2 rounded hover:bg-red-600 transition">
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             )}
                        </div>
                    </div>

                    {/* RIGHT: Cost Summary Panel */}
                    <CostSummaryPanel 
                        unit={unit}
                        costs={costs}
                        quantities={quantities}
                        scope="architectural"
                        onUpdateCostItem={onUpdateCostItem}
                    />
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Tamam</button>
                </div>
            </div>
        </div>
    );
};
