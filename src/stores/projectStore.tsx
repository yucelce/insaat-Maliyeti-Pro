
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UnitType, BuildingStats, UnitFloorType } from '../types';
import { CostCategory, COST_DATA as INITIAL_COSTS } from '../../cost_data';
import { calculateUnitCost } from '../utils/calculations';
import { WIX_PRICE_MAP } from '../wix_price_mapping';
import { TURKEY_HEAT_MAP } from '../constants';

interface ProjectCostDetail {
    id: string;
    title: string;
    totalCategoryCost: number;
    items: any[];
}

interface ProjectContextType {
    units: UnitType[];
    structuralUnits: UnitType[];
    costs: CostCategory[];
    buildingStats: BuildingStats;
    
    // Global Modes (Visual Toggles state for UI consistency, though logic is per unit now)
    globalWallMode: 'auto' | 'detailed';
    globalConcreteMode: 'auto' | 'detailed';
    
    // Derived Data (Calculated)
    projectCostDetails: ProjectCostDetail[];
    projectTotalCost: number;
    globalStructuralCost: number;
    interiorFitoutCost: number;
    totalConstructionArea: number;
    
    // Actions
    addUnit: () => void;
    addStructuralUnit: () => void;
    updateUnit: (updatedUnit: UnitType) => void;
    deleteUnit: (id: string, isStructural: boolean) => void;
    updateUnitCount: (id: string, count: number, isStructural: boolean) => void;
    updateUnitName: (id: string, name: string, isStructural: boolean) => void;
    updateUnitFloorType: (id: string, floorType: UnitFloorType, isStructural: boolean) => void;
    setBuildingStats: React.Dispatch<React.SetStateAction<BuildingStats>>;
    toggleWallMode: () => void;
    toggleConcreteMode: () => void;
    updateCostItem: (catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => void;
    isFetchingHeat: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- STATE ---
    const [units, setUnits] = useState<UnitType[]>([
        { 
            id: 'u1', name: 'Tip A (2+1)', count: 5, rooms: [], walls: [], columns: [], beams: [], slabs: [],
            floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(), 
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        }
    ]);

    const [structuralUnits, setStructuralUnits] = useState<UnitType[]>([
        {
            id: 's1', name: 'Normal Kat Planı', count: 5, rooms: [], walls: [], columns: [], beams: [], slabs: [],
            floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(),
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        }
    ]);

    const [costs, setCosts] = useState<CostCategory[]>(INITIAL_COSTS);
    
    const [buildingStats, setBuildingStats] = useState<BuildingStats>({
        province: 'İstanbul', district: 'Kadıköy', landArea: 500, heatZone: 2,
        normalFloorCount: 5, basementFloorCount: 1,
        normalFloorHeight: 2.9, groundFloorHeight: 3.5, basementFloorHeight: 3.0,
        normalFloorArea: 250, groundFloorArea: 250, basementFloorArea: 300
    });

    // These states track the "intended" global mode, applied when toggled
    const [globalWallMode, setGlobalWallMode] = useState<'auto' | 'detailed'>('auto');
    const [globalConcreteMode, setGlobalConcreteMode] = useState<'auto' | 'detailed'>('auto');
    
    const [isFetchingHeat, setIsFetchingHeat] = useState(false);

    // --- EFFECTS ---
    // Fetch Wix Prices
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const WIX_API_URL = 'https://celikyucel.com/_functions/fiyatListesi'; 
                const response = await fetch(WIX_API_URL);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success' && Array.isArray(result.data)) {
                        const wixPriceLookup = new Map<string, number>();
                        result.data.forEach((item: any) => {
                             if (item._id && item.fiyat) wixPriceLookup.set(item._id, Number(item.fiyat));
                        });
                        setCosts(prevCosts => prevCosts.map(cat => ({
                            ...cat,
                            items: cat.items.map(item => {
                                const targetWixId = WIX_PRICE_MAP[item.name];
                                if (targetWixId && wixPriceLookup.has(targetWixId)) {
                                    return { ...item, unit_price: wixPriceLookup.get(targetWixId)! };
                                }
                                return item;
                            })
                        })));
                    }
                }
            } catch (error) {
                console.warn("Failed to fetch prices from Wix backend", error);
            }
        };
        fetchPrices();
    }, []);

    // Update Heat Zone when location changes
    useEffect(() => {
        const fetchZone = async () => {
            setIsFetchingHeat(true);
            await new Promise(r => setTimeout(r, 300));
            let zone = 2;
            try {
                const provData = TURKEY_HEAT_MAP[buildingStats.province];
                if (provData) zone = provData.districts && provData.districts[buildingStats.district] ? provData.districts[buildingStats.district] : provData.zone;
            } catch (e) {}
            setBuildingStats(prev => ({ ...prev, heatZone: zone }));
            setIsFetchingHeat(false);
        };
        fetchZone();
    }, [buildingStats.province, buildingStats.district]);

    // --- CALCULATIONS (Automatic) ---
    const totalConstructionArea = useMemo(() => {
        return (buildingStats.normalFloorCount * buildingStats.normalFloorArea) + 
               buildingStats.groundFloorArea + 
               (buildingStats.basementFloorCount * buildingStats.basementFloorArea);
    }, [buildingStats]);

    const { projectCostDetails, projectTotalCost, globalStructuralCost, interiorFitoutCost } = useMemo(() => {
        let structuralCost = 0;
        let fitoutCost = 0;
        const details: ProjectCostDetail[] = [];
        const aggregatedQuantities = new Map<string, number>();
        
        // 1. Units
        units.forEach(unit => {
            const { quantities } = calculateUnitCost(unit, costs, buildingStats);
            Object.entries(quantities).forEach(([key, val]) => {
                aggregatedQuantities.set(key, (aggregatedQuantities.get(key) || 0) + (val * unit.count));
            });
        });

        // 2. Structural Units
        structuralUnits.forEach(sUnit => {
            const { quantities } = calculateUnitCost(sUnit, costs, buildingStats);
            Object.entries(quantities).forEach(([key, val]) => {
                aggregatedQuantities.set(key, (aggregatedQuantities.get(key) || 0) + (val * sUnit.count));
            });
        });

        // 3. Aggregate Costs
        costs.forEach(category => {
            let categoryTotal = 0;
            const processedItems = category.items.map(item => {
                let autoQty = 0;
                
                // --- AUTO MODE OVERRIDES ---
                // Decouple from unit list details if Global Auto Mode is active.
                // This prevents cost fluctuations when changing unit types in the list while in Auto Mode.
                
                const isConcreteItem = ['Betonarme Betonu (C30)', 'İnşaat Demiri', 'Kalıp İşçiliği & Malzeme', 'Temel Su Yalıtımı (Bohçalama)', 'Çatı Konstrüksiyon ve Kaplama'].includes(item.name);
                const isWallItem = ['Gazbeton Duvar (15\'lik)', 'Tuğla Duvar (13.5\'luk)', 'Briket Duvar (15\'lik)'].includes(item.name);
                const isFinishItem = ['İç Sıva (Kara Sıva)', 'Alçı Sıva (Kaba+Saten)', 'İç Cephe Boyası', 'Duvar Örme Harcı ve Yapıştırıcı'].includes(item.name);

                if (category.id === 'kaba_insaat' && globalConcreteMode === 'auto' && isConcreteItem) {
                     // Force Global Calculation based on Total Construction Area
                     autoQty = totalConstructionArea * item.multiplier;
                }
                else if (category.id === 'duvar_tavan' && globalWallMode === 'auto' && (isWallItem || isFinishItem)) {
                     // Estimate Global Wall Quantities based on Total Area
                     // Heuristic: Wall Surface Area approx 1.2x Floor Area for standard layouts
                     const wallRatio = 1.2; 
                     
                     if (isWallItem) {
                         // Default to Gazbeton if purely auto, or split if logic allowed (keeping simple: Gazbeton gets the volume)
                         if (item.name === "Gazbeton Duvar (15'lik)") {
                             autoQty = totalConstructionArea * wallRatio * item.multiplier;
                         } else {
                             autoQty = 0; // Other wall types 0 in generic auto mode
                         }
                     } else if (isFinishItem) {
                         // Finishes apply to both sides of the wall (approx 2x)
                         // Mortar applies to the wall area (1x)
                         const sideMultiplier = item.name.includes("Harcı") ? 1 : 2;
                         autoQty = totalConstructionArea * wallRatio * sideMultiplier * item.multiplier;
                     }
                }
                else if (item.auto_source !== 'manual') {
                    // Standard Aggregation
                    autoQty = aggregatedQuantities.get(item.name) || 0;
                    
                    // Global Fallback (for items not caught above)
                    if (autoQty === 0 && item.scope === 'global') {
                        if (item.auto_source === 'total_area') {
                             autoQty = totalConstructionArea * item.multiplier;
                        } else if (item.auto_source === 'land_area') {
                             autoQty = buildingStats.landArea * item.multiplier;
                        }
                    }
                }

                // Handling for 'manual_total' (Lump Sum) items
                let finalQty = item.manualQuantity !== undefined ? item.manualQuantity : autoQty;
                
                if (item.inputType === 'manual_total') {
                    finalQty = 1;
                }

                const finalPrice = item.manualPrice !== undefined ? item.manualPrice : item.unit_price;
                const totalPrice = finalQty * finalPrice;
                categoryTotal += totalPrice;

                return { ...item, calculatedAutoQty: autoQty, finalQty, finalPrice, totalPrice };
            });

            details.push({ id: category.id, title: category.title, totalCategoryCost: categoryTotal, items: processedItems });
            if (category.id === 'kaba_insaat') structuralCost += categoryTotal;
            else fitoutCost += categoryTotal;
        });

        return { projectCostDetails: details, projectTotalCost: structuralCost + fitoutCost, globalStructuralCost: structuralCost, interiorFitoutCost: fitoutCost };
    }, [costs, units, structuralUnits, totalConstructionArea, buildingStats, globalConcreteMode, globalWallMode]);


    // --- ACTIONS ---
    const addUnit = useCallback(() => {
        setUnits(prev => [...prev, {
            id: Date.now().toString(), name: `Yeni Daire Tip ${prev.length + 1}`, floorType: 'normal', count: 1,
            rooms: [], walls: [], columns: [], beams: [], slabs: [], imageData: null, scale: 0, lastEdited: Date.now(), 
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        }]);
    }, []);

    const addStructuralUnit = useCallback(() => {
        setStructuralUnits(prev => [...prev, {
            id: 's-' + Date.now().toString(), name: `Yeni Kat Planı ${prev.length + 1}`, floorType: 'normal', count: 1,
            rooms: [], walls: [], columns: [], beams: [], slabs: [], imageData: null, scale: 0, lastEdited: Date.now(), 
            structuralWallSource: globalWallMode === 'detailed' ? 'detailed_unit' : 'global_calculated',
            structuralConcreteSource: globalConcreteMode === 'detailed' ? 'detailed_unit' : 'global_calculated'
        }]);
    }, [globalWallMode, globalConcreteMode]);

    const updateUnit = useCallback((updatedUnit: UnitType) => {
        setUnits(prev => {
            if (prev.some(u => u.id === updatedUnit.id)) return prev.map(u => u.id === updatedUnit.id ? updatedUnit : u);
            return prev;
        });
        setStructuralUnits(prev => {
            if (prev.some(u => u.id === updatedUnit.id)) return prev.map(u => u.id === updatedUnit.id ? updatedUnit : u);
            return prev;
        });
    }, []);

    const deleteUnit = useCallback((id: string, isStructural: boolean) => {
        if (isStructural) setStructuralUnits(prev => prev.filter(u => u.id !== id));
        else setUnits(prev => prev.filter(u => u.id !== id));
    }, []);

    const updateUnitCount = useCallback((id: string, count: number, isStructural: boolean) => {
        if (isStructural) setStructuralUnits(prev => prev.map(u => u.id === id ? { ...u, count: Math.max(0, count) } : u));
        else setUnits(prev => prev.map(u => u.id === id ? { ...u, count: Math.max(0, count) } : u));
    }, []);

    const updateUnitName = useCallback((id: string, name: string, isStructural: boolean) => {
        if (isStructural) setStructuralUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u));
        else setUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u));
    }, []);

    const updateUnitFloorType = useCallback((id: string, floorType: UnitFloorType, isStructural: boolean) => {
        if (isStructural) setStructuralUnits(prev => prev.map(u => u.id === id ? { ...u, floorType } : u));
        else setUnits(prev => prev.map(u => u.id === id ? { ...u, floorType } : u));
    }, []);

    const toggleWallMode = useCallback(() => {
        setGlobalWallMode(prev => {
            const newMode = prev === 'auto' ? 'detailed' : 'auto';
            setStructuralUnits(curr => curr.map(u => ({ ...u, structuralWallSource: newMode === 'detailed' ? 'detailed_unit' : 'global_calculated' })));
            return newMode;
        });
    }, []);

    const toggleConcreteMode = useCallback(() => {
        setGlobalConcreteMode(prev => {
            const newMode = prev === 'auto' ? 'detailed' : 'auto';
            setStructuralUnits(curr => curr.map(u => ({ ...u, structuralConcreteSource: newMode === 'detailed' ? 'detailed_unit' : 'global_calculated' })));
            return newMode;
        });
    }, []);

    const updateCostItem = useCallback((catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => {
        setCosts(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                items: cat.items.map(item => {
                    if (item.name !== itemName) return item;
                    return { ...item, [field]: value };
                })
            };
        }));
    }, []);

    return (
        <ProjectContext.Provider value={{
            units, structuralUnits, costs, buildingStats, 
            globalWallMode, globalConcreteMode,
            projectCostDetails, projectTotalCost, globalStructuralCost, interiorFitoutCost, totalConstructionArea,
            addUnit, addStructuralUnit, updateUnit, deleteUnit, updateUnitCount, updateUnitName, updateUnitFloorType,
            setBuildingStats, toggleWallMode, toggleConcreteMode, updateCostItem, isFetchingHeat
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProjectStore = () => {
    const context = useContext(ProjectContext);
    if (!context) throw new Error("useProjectStore must be used within ProjectProvider");
    return context;
};
