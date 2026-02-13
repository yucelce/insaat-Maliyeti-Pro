import React from 'react';
import { BuildingStats, UnitType } from '../../types';
import { CostCategory } from '../../../cost_data';
import { TURKEY_HEAT_MAP } from '../../constants';

interface StructureModalProps {
    onClose: () => void;
    totalConstructionArea: number;
    costs: CostCategory[];
    handleMultiplierChange: (catId: string, itemName: string, val: number) => void;
    handlePriceChange: (catId: string, itemName: string, val: number) => void;
}

export const StructureModal: React.FC<StructureModalProps> = ({ onClose, totalConstructionArea, costs, handleMultiplierChange, handlePriceChange }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-hammer mr-2 text-yellow-500"></i>Kaba Yapı Parametreleri</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-yellow-900/10 border border-yellow-700/50 p-4 rounded-lg mb-6">
                        <p className="text-yellow-200 text-sm">
                            <i className="fas fa-info-circle mr-2"></i>
                            Bu alanda toplam inşaat alanına (<b>{totalConstructionArea.toLocaleString()} m²</b>) bağlı olarak hesaplanan kaba yapı malzemelerinin katsayılarını düzenleyebilirsiniz.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {costs.find(c => c.id === 'kaba_insaat')?.items.map((item, index) => (
                            <div key={index} className="bg-slate-800 p-4 rounded border border-slate-700">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-white font-bold">{item.name}</h4>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-yellow-400">
                                            {(totalConstructionArea * item.multiplier).toLocaleString(undefined, {maximumFractionDigits: 1})} <span className="text-sm text-slate-400">{item.unit}</span>
                                        </div>
                                        <div className="text-xs text-slate-500">Hesaplanan Toplam</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold uppercase mb-1">Hesap Katsayısı</label>
                                        <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2">
                                            <input 
                                                type="number" 
                                                step="0.001" 
                                                value={item.multiplier} 
                                                onChange={(e) => handleMultiplierChange('kaba_insaat', item.name, parseFloat(e.target.value) || 0)}
                                                className="w-full bg-transparent text-white p-2 text-right font-mono focus:outline-none"
                                            />
                                            <span className="text-slate-500 text-xs ml-2 whitespace-nowrap">{item.unit} / m²</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">Her 1 m² inşaat alanı için harcanan miktar.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold uppercase mb-1">Birim Fiyat</label>
                                        <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2">
                                            <input 
                                                type="number" 
                                                value={item.unit_price} 
                                                onChange={(e) => handlePriceChange('kaba_insaat', item.name, parseFloat(e.target.value) || 0)}
                                                className="w-full bg-transparent text-white p-2 text-right font-mono focus:outline-none"
                                            />
                                            <span className="text-slate-500 text-xs ml-2">TL</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Kaydet</button>
                </div>
            </div>
        </div>
    );
};

interface BuildingModalProps {
    onClose: () => void;
    buildingStats: BuildingStats;
    setBuildingStats: React.Dispatch<React.SetStateAction<BuildingStats>>;
    handleProvinceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    handleDistrictChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    isFetchingHeat: boolean;
}

export const BuildingModal: React.FC<BuildingModalProps> = ({ onClose, buildingStats, setBuildingStats, handleProvinceChange, handleDistrictChange, isFetchingHeat }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-building mr-2 text-blue-500"></i>Yapı Parametreleri</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* LEFT COLUMN: Location & Land */}
                        <div className="space-y-6">
                            <div className="space-y-4 bg-slate-800/30 p-4 rounded border border-slate-700/50 h-full">
                                <h4 className="font-bold text-indigo-400 border-b border-indigo-900 pb-2 mb-2">Konum & Arsa Bilgileri</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold block mb-1">İl</label>
                                        <select value={buildingStats.province} onChange={handleProvinceChange} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500">
                                            {Object.keys(TURKEY_HEAT_MAP).map(prov => (
                                                <option key={prov} value={prov}>{prov}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold block mb-1">İlçe</label>
                                        <select value={buildingStats.district} onChange={handleDistrictChange} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500">
                                            {TURKEY_HEAT_MAP[buildingStats.province]?.districts ? 
                                                Object.keys(TURKEY_HEAT_MAP[buildingStats.province].districts).map(dist => (
                                                    <option key={dist} value={dist}>{dist}</option>
                                                )) : <option value="Merkez">Merkez</option>
                                            }
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-xs text-slate-400 font-bold block mb-1">Arsa Alanı (m²)</label>
                                    <input type="number" value={buildingStats.landArea} onChange={(e) => setBuildingStats({...buildingStats, landArea: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white font-mono text-lg" />
                                </div>

                                <div className="bg-slate-900 p-3 rounded border border-slate-700 flex justify-between items-center">
                                    <span className="text-sm text-slate-400 font-bold">Isı Bölge Katsayısı</span>
                                    {isFetchingHeat ? 
                                        <span className="text-yellow-500 text-xs animate-pulse">Hesaplanıyor...</span> : 
                                        <span className="text-xl font-bold text-orange-400">{buildingStats.heatZone}. Bölge</span>
                                    }
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Floor Stats */}
                        <div className="space-y-4">
                            {/* Normal Katlar */}
                            <div className="space-y-4 bg-slate-800/30 p-4 rounded border border-slate-700/50">
                                <h4 className="font-bold text-blue-400 border-b border-blue-900 pb-2 mb-2">Normal Katlar</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                        <input type="number" min="1" value={buildingStats.normalFloorCount} onChange={(e) => setBuildingStats({...buildingStats, normalFloorCount: parseInt(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Yük. (m)</label>
                                        <input type="number" step="0.1" value={buildingStats.normalFloorHeight} onChange={(e) => setBuildingStats({...buildingStats, normalFloorHeight: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                        <input type="number" value={buildingStats.normalFloorArea} onChange={(e) => setBuildingStats({...buildingStats, normalFloorArea: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Zemin Kat */}
                            <div className="space-y-4 bg-slate-800/30 p-4 rounded border border-slate-700/50">
                                <h4 className="font-bold text-green-400 border-b border-green-900 pb-2 mb-2">Zemin Kat</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                        <input type="number" value="1" disabled className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-slate-500 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Yük. (m)</label>
                                        <input type="number" step="0.1" value={buildingStats.groundFloorHeight} onChange={(e) => setBuildingStats({...buildingStats, groundFloorHeight: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                        <input type="number" value={buildingStats.groundFloorArea} onChange={(e) => setBuildingStats({...buildingStats, groundFloorArea: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Bodrum Katlar */}
                            <div className="space-y-4 bg-slate-800/30 p-4 rounded border border-slate-700/50">
                                <h4 className="font-bold text-orange-400 border-b border-orange-900 pb-2 mb-2">Bodrum Katlar</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                        <input type="number" min="0" value={buildingStats.basementFloorCount} onChange={(e) => setBuildingStats({...buildingStats, basementFloorCount: parseInt(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Yük. (m)</label>
                                        <input type="number" step="0.1" value={buildingStats.basementFloorHeight} onChange={(e) => setBuildingStats({...buildingStats, basementFloorHeight: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                        <input type="number" value={buildingStats.basementFloorArea} onChange={(e) => setBuildingStats({...buildingStats, basementFloorArea: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Tamam</button>
                </div>
            </div>
        </div>
    );
};