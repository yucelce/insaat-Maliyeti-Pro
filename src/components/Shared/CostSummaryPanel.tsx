import React from 'react';
import { CostCategory } from '../../../cost_data';
import { UnitType } from '../../types';

interface CostSummaryPanelProps {
    unit: UnitType | undefined;
    costs: CostCategory[];
    quantities: Record<string, number>;
    scope: 'architectural' | 'structural';
    onUpdateCostItem: (catId: string, itemName: string, field: 'manualPrice', value: number | undefined) => void;
    structuralStats?: any; // Optional stats specific to structural editor view
}

export const CostSummaryPanel: React.FC<CostSummaryPanelProps> = ({ 
    unit, 
    costs, 
    quantities, 
    scope, 
    onUpdateCostItem,
    structuralStats 
}) => {
    
    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-20 w-80 min-w-[20rem] transition-colors duration-300">
            <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg z-10 transition-colors duration-300">
                <h2 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2"><i className="fas fa-calculator text-blue-500"></i> Daire Maliyet Özeti</h2>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Bu dairede yapılan değişikliklerin proje geneline etkisi</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                
                {/* Structural Stats Box (Only shows if structuralStats is provided and scope is structural) */}
                {scope === 'structural' && structuralStats && (
                <div className="border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800/30">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Kaba Yapı Metrajı</div>
                    <div className="p-2 space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400"><span>Kolon Hacim (C30)</span><span className="text-slate-900 dark:text-white font-mono">{structuralStats?.column_concrete_volume?.toFixed(2)} m3</span></div>
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400"><span>Kolon Kalıp</span><span className="text-slate-900 dark:text-white font-mono">{structuralStats?.column_formwork_area?.toFixed(2)} m2</span></div>
                        <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-1"></div>
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400"><span>Kiriş Hacim (C30)</span><span className="text-slate-900 dark:text-white font-mono">{structuralStats?.beam_concrete_volume?.toFixed(2)} m3</span></div>
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400"><span>Kiriş Kalıp</span><span className="text-slate-900 dark:text-white font-mono">{structuralStats?.beam_formwork_area?.toFixed(2)} m2</span></div>
                    </div>
                </div>
                )}

                {costs.map((category) => {
                    // Filter Logic based on Scope
                    if (scope === 'architectural') {
                        // In Architectural mode, hide non-unit specific scopes AND specific structural/mechanical categories
                        if (['ince_isler', 'mekanik_tesisat', 'elektrik_tesisat', 'resmi_idari', 'santiye_hafriyat', 'kaba_insaat', 'dis_cephe'].includes(category.id)) return null;
                        
                        // Check if category has any unit-scoped items
                        const hasUnitItems = category.items.some(i => i.scope === 'unit');
                        if (!hasUnitItems) return null;
                    } 
                    
                    if (scope === 'structural' && category.id !== 'kaba_insaat' && category.id !== 'duvar_tavan') return null;

                    // Filter individual items inside the category
                    const visibleItems = category.items.filter(item => {
                        if (scope === 'architectural') {
                            // Explicitly hide Structural Wall Materials in Architectural View
                            // Only show finishes like Paint, Plaster(Gypsum), Cornice, Flooring
                            if (category.id === 'duvar_tavan') {
                                const structuralWalls = [
                                    "Gazbeton Duvar (13.5'luk)", 
                                    "Tuğla Duvar (13.5'luk)", 
                                    "Briket Duvar (15'lik)",
                                    "İç Sıva (Kara Sıva)" // Usually considered rough construction
                                ];
                                if (structuralWalls.includes(item.name)) return false;
                            }
                            return item.scope === 'unit';
                        }
                        if (scope === 'structural') return true;
                        return true;
                    });

                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={category.id} className="border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800/30 transition-colors duration-300">
                            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">{category.title}</div>
                            <div className="p-2 space-y-2">
                                {visibleItems.map((item) => {
                                    const unitQty = quantities[item.name] || 0;
                                    const unitCount = unit?.count || 1;
                                    const totalQty = unitQty * unitCount;
                                    
                                    // Price Logic
                                    const isManualPrice = item.manualPrice !== undefined;
                                    const finalPrice = isManualPrice ? item.manualPrice! : item.unit_price;
                                    const totalCost = totalQty * finalPrice;

                                    if (unitQty === 0) return null;

                                    return (
                                        <div key={item.name} className="flex flex-col text-[10px] border-b border-slate-200 dark:border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-slate-900 dark:text-white font-medium">{item.name}</span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/50 p-1 rounded border border-slate-200 dark:border-slate-700/30 mb-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-500 dark:text-blue-400 font-mono">{unitQty.toLocaleString(undefined, {maximumFractionDigits:1})}</span>
                                                    <span>x</span>
                                                    <span className="text-slate-600 dark:text-slate-500">{unitCount} Adet</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                     <span>=</span>
                                                     <span className="text-yellow-600 dark:text-yellow-500 font-bold font-mono">{totalQty.toLocaleString(undefined, {maximumFractionDigits:0})} {item.unit}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/30 p-1 rounded">
                                                <div className="flex items-center gap-1 relative group">
                                                    <span className="text-[9px] text-slate-500 whitespace-nowrap">B.Fiyat:</span>
                                                    <div className="relative flex items-center">
                                                        <input 
                                                            type="number" 
                                                            className={`bg-transparent w-14 text-right outline-none border-b border-slate-300 dark:border-slate-700 focus:border-blue-500 text-[9px] ${isManualPrice ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}
                                                            value={finalPrice}
                                                            onChange={(e) => onUpdateCostItem(category.id, item.name, 'manualPrice', parseFloat(e.target.value))}
                                                        />
                                                        <span className="ml-0.5 text-slate-500 text-[9px]">₺</span>
                                                    </div>
                                                    
                                                    {isManualPrice && (
                                                        <button 
                                                            onClick={() => onUpdateCostItem(category.id, item.name, 'manualPrice', undefined)}
                                                            className="ml-1 text-[8px] text-red-500 dark:text-red-400 hover:text-red-400 bg-slate-200 dark:bg-slate-800 px-1 rounded opacity-50 group-hover:opacity-100 transition"
                                                            title="Sistem fiyatına dön"
                                                        >
                                                            <i className="fas fa-undo"></i>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-bold text-green-600 dark:text-green-400">{totalCost.toLocaleString('tr-TR', {maximumFractionDigits: 0})} ₺</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};