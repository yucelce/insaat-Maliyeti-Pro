import React from 'react';
import { UnitType, BuildingStats } from '../../types';
import { getCategoryIcon } from '../../utils/icons';

interface DashboardViewProps {
    projectTotalCost: number;
    buildingStats: BuildingStats;
    totalConstructionArea: number;
    globalStructuralCost: number;
    interiorFitoutCost: number;
    projectCostDetails: { id: string, title: string, totalCategoryCost: number, items: any[] }[];
    units: UnitType[];
    structuralUnits: UnitType[]; 
    expandedCategories: Record<string, boolean>;
    toggleCategory: (id: string) => void;
    handleAddUnit: () => void;
    handleAddStructuralUnit: () => void;
    handleEditUnit: (id: string) => void;
    handleEditUnitStructural: (id: string) => void;
    handleDeleteUnit: (id: string, isStructural: boolean) => void; 
    setShowBuildingModal: (show: boolean) => void;
    onOpenStructuralManager: (unitId: string) => void;
    onOpenRoomManager: (unitId: string) => void;
    handleUpdateUnitCount: (unitId: string, count: number, isStructural: boolean) => void; 
    handleUpdateUnitName: (unitId: string, name: string, isStructural: boolean) => void; // New Prop
    structuralGlobalMode: 'auto' | 'detailed'; // New Prop
    handleToggleGlobalStructuralMode: () => void; // New Prop
    handleUpdateCostItem: (catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
    projectTotalCost,
    buildingStats,
    totalConstructionArea,
    globalStructuralCost,
    interiorFitoutCost,
    projectCostDetails,
    units,
    structuralUnits,
    expandedCategories,
    toggleCategory,
    handleAddUnit,
    handleAddStructuralUnit,
    handleEditUnit,
    handleEditUnitStructural,
    handleDeleteUnit,
    setShowBuildingModal,
    onOpenStructuralManager,
    onOpenRoomManager,
    handleUpdateUnitCount,
    handleUpdateUnitName,
    structuralGlobalMode,
    handleToggleGlobalStructuralMode,
    handleUpdateCostItem
}) => {
    
    return (
        <div className="flex h-screen flex-col bg-slate-900 font-sans text-slate-200 overflow-y-auto">
            {/* --- Dashboard Header --- */}
            <header className="bg-slate-950 border-b border-slate-800 p-6 shadow-md z-10 sticky top-0">
               <div className="flex justify-between items-center max-w-6xl mx-auto">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                            <i className="fas fa-city"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white leading-tight">CY Pro Metraj Maliyet <span className="text-blue-400">Manager</span></h1>
                            <p className="text-sm text-slate-400">Yapı Maliyet ve Metraj Platformu</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-400 uppercase font-bold tracking-wider">Tahmini Toplam Maliyet</div>
                        <div className="text-3xl font-bold text-green-500">{projectTotalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8 pb-20">
                
                {/* 1. SECTION: YAPI GENEL BİLGİLERİ */}
                 <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-bl-full -mr-10 -mt-10"></div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-building text-blue-500"></i> Yapı Genel Bilgileri
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Arsa, Konum ve Kat Bilgileri</p>
                        </div>
                        <button onClick={() => setShowBuildingModal(true)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition border border-blue-600/30">
                            <i className="fas fa-pen mr-2"></i>Düzenle
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Konum</div>
                            <div className="text-lg font-bold text-white truncate">{buildingStats.province}, {buildingStats.district}</div>
                             <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-slate-500">{buildingStats.landArea} m² Arsa</span>
                                <span className="text-[10px] text-orange-400 font-bold">{buildingStats.heatZone}. Isı Bölgesi</span>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Toplam İnşaat Alanı</div>
                            <div className="text-2xl font-bold text-white">{totalConstructionArea.toLocaleString()} m²</div>
                            <div className="text-[10px] text-slate-500 mt-1">Emsal Dahil Brüt</div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Kat Bilgisi</div>
                            <div className="text-lg font-bold text-white">
                                {buildingStats.basementFloorCount} Bodrum + Zemin + {buildingStats.normalFloorCount} Normal
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Toplam Yükseklik: {(
                                    (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + 
                                    buildingStats.groundFloorHeight + 
                                    (buildingStats.basementFloorCount * buildingStats.basementFloorHeight)
                                ).toFixed(1)} m
                            </div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex flex-col justify-center">
                            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 mb-2">
                                <span className="text-xs text-slate-400">Kaba Yapı</span>
                                <span className="text-sm font-bold text-yellow-500">{globalStructuralCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400">İnce İşler</span>
                                <span className="text-sm font-bold text-purple-400">{interiorFitoutCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                            </div>
                        </div>
                    </div>
                 </section>

                 {/* 2. SECTION: BAĞIMSIZ BÖLÜM TİPLERİ (Apartment Units) */}
                 <section>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2"><i className="fas fa-layer-group text-purple-500"></i> Bağımsız Bölüm Tipleri</h2>
                            <p className="text-sm text-slate-400 mt-1">Daire planları, oda metrajları ve adetleri (Duvar ve yapısal elemanlar hariç)</p>
                        </div>
                        <button onClick={handleAddUnit} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm"><i className="fas fa-plus"></i> Yeni Tip Ekle</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {units.length === 0 && <div className="col-span-full text-center text-slate-500 py-8 bg-slate-800/30 rounded-lg">Henüz daire tipi eklenmemiş.</div>}
                        {units.map(unit => (
                            <div key={unit.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-600 transition group relative">
                                <div className="h-40 bg-slate-900 relative flex items-center justify-center border-b border-slate-700">
                                    {unit.imageData ? <img src={unit.imageData} className="w-full h-full object-cover opacity-60"/> : <i className="fas fa-drafting-compass text-4xl text-slate-600"></i>}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                                        <button onClick={() => handleEditUnit(unit.id)} className="bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-sm">Planı Düzenle</button>
                                         <button onClick={() => onOpenRoomManager(unit.id)} className="bg-purple-600 text-white px-4 py-2 rounded-full font-bold text-sm">Manuel Liste</button>
                                        <button onClick={() => handleDeleteUnit(unit.id, false)} className="bg-red-600 text-white w-10 h-10 rounded-full"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 mr-4">
                                            {/* Renamable Name Input */}
                                            <input 
                                                type="text" 
                                                value={unit.name} 
                                                onChange={(e) => handleUpdateUnitName(unit.id, e.target.value, false)}
                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 text-white font-bold mb-1 outline-none transition px-0"
                                            />
                                            <div className="text-xs text-slate-400 uppercase bg-slate-900 px-2 py-1 rounded inline-block">
                                                {unit.floorType === 'ground' ? 'Zemin Kat' : unit.floorType === 'basement' ? 'Bodrum' : 'Normal Kat'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={unit.count} 
                                                    onChange={(e) => handleUpdateUnitCount(unit.id, parseInt(e.target.value), false)}
                                                    className="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-center text-white font-bold text-lg focus:border-blue-500 outline-none"
                                                />
                                                <span className="text-sm font-normal text-slate-500">Adet</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between text-xs text-slate-400">
                                        <span><i className="fas fa-vector-square mr-1"></i>{unit.rooms.length} Oda</span>
                                        <span><i className="fas fa-expand mr-1"></i>{unit.scale > 0 ? "Ölçekli" : "Ölçeksiz"}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </section>

                 {/* 3. SECTION: YAPISAL ELEMANLAR DETAY PANELİ (Structural Floors) */}
                 <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
                    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-hard-hat text-orange-500"></i> Yapısal Elemanlar Detay Paneli
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Kat planları bazında duvar, kolon ve kirişlerin görsel/manuel metraj yönetimi</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* Global Toggle Switch */}
                            <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                                <button 
                                    onClick={handleToggleGlobalStructuralMode} 
                                    className={`px-4 py-2 text-sm font-bold rounded transition flex items-center gap-2 ${structuralGlobalMode === 'auto' ? 'bg-yellow-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <i className="fas fa-calculator"></i> Otomatik
                                </button>
                                <button 
                                    onClick={handleToggleGlobalStructuralMode} 
                                    className={`px-4 py-2 text-sm font-bold rounded transition flex items-center gap-2 ${structuralGlobalMode === 'detailed' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    <i className="fas fa-ruler-combined"></i> Detaylı
                                </button>
                            </div>

                            <button onClick={handleAddStructuralUnit} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm h-10"><i className="fas fa-plus"></i> Yeni Kat Planı</button>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {structuralUnits.length === 0 && <div className="text-slate-500 text-sm text-center py-4">Henüz bir kat planı eklenmemiş.</div>}
                        {structuralUnits.map(unit => (
                            <div key={unit.id} className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 flex flex-col justify-between gap-4 hover:bg-slate-900/60 transition group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold border border-slate-600 group-hover:border-orange-500 group-hover:text-orange-500 transition">{unit.name.substring(0,2)}</div>
                                        <div className="flex-1">
                                            {/* Renamable Name Input */}
                                            <input 
                                                type="text" 
                                                value={unit.name} 
                                                onChange={(e) => handleUpdateUnitName(unit.id, e.target.value, true)}
                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-orange-500 text-white font-bold text-sm outline-none transition px-0 max-w-md"
                                            />
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                {structuralGlobalMode === 'auto' ? (
                                                     <span className="bg-yellow-900/50 text-yellow-500 px-2 py-0.5 rounded border border-yellow-800">
                                                        <i className="fas fa-info-circle mr-1"></i>Kaba Yapı Genel Oranlardan Hesaplanıyor
                                                     </span>
                                                ) : (
                                                    <span className="bg-green-900/50 text-green-500 px-2 py-0.5 rounded border border-green-800">
                                                        <i className="fas fa-check-circle mr-1"></i>Çizim Metrajı Dahil Ediliyor
                                                     </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        {/* Count Input for Floors */}
                                        <div className="flex items-center justify-end gap-2">
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={unit.count} 
                                                onChange={(e) => handleUpdateUnitCount(unit.id, parseInt(e.target.value), true)}
                                                className="w-14 bg-slate-950 border border-slate-600 rounded p-1 text-center text-white font-bold text-sm focus:border-orange-500 outline-none"
                                            />
                                            <span className="text-xs font-normal text-slate-500">Adet</span>
                                        </div>
                                        
                                        <button onClick={() => handleDeleteUnit(unit.id, true)} className="text-red-500 hover:text-red-400 px-2"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 border-t border-slate-700/50 pt-3">
                                    <div className="text-xs text-slate-500 flex gap-3 flex-1">
                                        <span><i className="fas fa-th-large mr-1 text-yellow-600"></i>{unit.walls.length} Duvar</span>
                                        <span><i className="fas fa-square mr-1 text-red-600"></i>{unit.columns.length} Kolon</span>
                                        <span><i className="fas fa-grip-lines mr-1 text-blue-600"></i>{unit.beams.length} Kiriş</span>
                                    </div>

                                    <div className="flex gap-2 transition-opacity duration-300">
                                        <button onClick={() => handleEditUnitStructural(unit.id)} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold border border-orange-600 transition shadow-sm flex-1 md:flex-initial">
                                            <i className="fas fa-drafting-compass mr-2"></i>Plan Üzerinde Çalış
                                        </button>
                                        <button onClick={() => onOpenStructuralManager(unit.id)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold border border-slate-600 transition shadow-sm flex-1 md:flex-initial">
                                            <i className="fas fa-list-ul mr-2"></i>Manuel Liste
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </section>

                 {/* 4. SECTION: PROJECT COST DETAILS */}
                 <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-file-invoice-dollar text-green-500"></i> Proje Maliyet Detayları
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Tüm bağımsız bölümler ve genel yapı maliyetlerinin toplam dökümü. Metraj ve birim fiyatları buradan düzenleyebilirsiniz.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {projectCostDetails.map((category) => (
                            <div key={category.id} className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden transition-all duration-300">
                                <button onClick={() => toggleCategory(category.id)} className="w-full bg-slate-700/50 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center hover:bg-slate-700 transition">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-600 shadow-sm">{getCategoryIcon(category.id)}</div>
                                        <div className="text-left"><h3 className="font-bold text-white text-sm uppercase">{category.title}</h3></div>
                                    </div>
                                    <span className="text-green-400 font-bold text-sm">{category.totalCategoryCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</span>
                                </button>
                                {expandedCategories[category.id] && (
                                    <div className="p-4 space-y-4 bg-slate-900/30 animate-fadeIn">
                                        {category.items.map((item) => (
                                            <div key={item.name} className="flex flex-col gap-2 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-300 text-sm font-medium">{item.name}</span>
                                                    <div className="font-bold text-green-400 text-sm">{item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {/* Quantity Input */}
                                                    <div className="flex-1">
                                                        <div className="flex items-center bg-slate-800 border border-slate-700 rounded relative">
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-transparent text-white text-xs p-1.5 outline-none focus:bg-slate-700 transition font-mono text-right pr-8"
                                                                value={item.manualQuantity !== undefined ? item.manualQuantity : Math.round(item.calculatedAutoQty * 100)/100}
                                                                onChange={(e) => handleUpdateCostItem(category.id, item.name, 'manualQuantity', parseFloat(e.target.value))}
                                                                placeholder="Miktar"
                                                            />
                                                            <span className="absolute right-2 text-[9px] text-slate-500">{item.unit}</span>
                                                        </div>
                                                        <div className="flex justify-between mt-1 px-1">
                                                            <span className="text-[9px] text-slate-500 uppercase">Metraj</span>
                                                            {item.manualQuantity !== undefined ? (
                                                                <button 
                                                                    onClick={() => handleUpdateCostItem(category.id, item.name, 'manualQuantity', undefined)}
                                                                    className="text-[9px] text-yellow-500 hover:text-yellow-400 uppercase font-bold"
                                                                >
                                                                    Otomatik Yap
                                                                </button>
                                                            ) : (
                                                                <span className="text-[9px] text-blue-500 uppercase font-bold">Otomatik</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <span className="text-slate-500 text-xs">x</span>

                                                    {/* Price Input */}
                                                    <div className="flex-1">
                                                        <div className="flex items-center bg-slate-800 border border-slate-700 rounded relative">
                                                             <input 
                                                                type="number" 
                                                                className="w-full bg-transparent text-white text-xs p-1.5 outline-none focus:bg-slate-700 transition font-mono text-right pr-6"
                                                                value={item.manualPrice !== undefined ? item.manualPrice : item.unit_price}
                                                                onChange={(e) => handleUpdateCostItem(category.id, item.name, 'manualPrice', parseFloat(e.target.value))}
                                                                placeholder="Fiyat"
                                                            />
                                                            <span className="absolute right-2 text-[9px] text-slate-500">₺</span>
                                                        </div>
                                                        <div className="flex justify-between mt-1 px-1">
                                                            <span className="text-[9px] text-slate-500 uppercase">Birim Fiyat</span>
                                                             {item.manualPrice !== undefined && (
                                                                <button 
                                                                    onClick={() => handleUpdateCostItem(category.id, item.name, 'manualPrice', undefined)}
                                                                    className="text-[9px] text-yellow-500 hover:text-yellow-400 uppercase font-bold"
                                                                >
                                                                    Sıfırla
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                 </section>
            </main>
        </div>
    );
};