
import { UnitType, BuildingStats } from '../types';
import { CostCategory } from '../../cost_data';

export const calculateUnitCost = (unit: UnitType, currentCosts: CostCategory[], buildingStats: BuildingStats) => {
    let quantities: Record<string, number> = {};
    let totalCost = 0;

    let stats = {
      total_area: 0, 
      total_perimeter: 0, 
      wet_area: 0, 
      dry_area: 0, 
      dry_perimeter: 0, 
      net_wall_area: 0, 
      cornice_length: 0,
      wall_gazbeton_area: 0, 
      wall_tugla_area: 0,
      wall_briket_area: 0,
      
      // Structure Stats
      column_concrete_volume: 0,
      column_formwork_area: 0,
      beam_concrete_volume: 0,
      beam_formwork_area: 0,
      slab_concrete_volume: 0,
      slab_formwork_area: 0
    };

    let defaultFloorHeight = buildingStats.normalFloorHeight;
    let defaultFloorArea = buildingStats.normalFloorArea;
    
    // Dynamic Height Selection based on Floor Type
    if (unit.floorType === 'ground') { 
        defaultFloorHeight = buildingStats.groundFloorHeight; 
        defaultFloorArea = buildingStats.groundFloorArea; 
    }
    if (unit.floorType === 'basement') { 
        defaultFloorHeight = buildingStats.basementFloorHeight; 
        defaultFloorArea = buildingStats.basementFloorArea; 
    }

    // 1. Rooms (Always calculated for Flooring & Base Area)
    (unit.rooms || []).forEach(room => {
      let areaM2 = 0;
      let perimeterM = 0;

      if (room.manualAreaM2 !== undefined && room.manualAreaM2 > 0) {
        areaM2 = room.manualAreaM2;
        perimeterM = room.manualPerimeterM || (Math.sqrt(areaM2) * 4);
      } else if (unit.scale > 0) {
        areaM2 = room.area_px / (unit.scale * unit.scale);
        perimeterM = room.perimeter_px / unit.scale;
      }

      stats.total_area += areaM2;
      stats.total_perimeter += perimeterM;

      if (room.properties.floorType === 'seramik') {
        stats.wet_area += areaM2;
      } else if (room.properties.floorType === 'parke') {
        stats.dry_area += areaM2;
        stats.dry_perimeter += perimeterM;
      }
      
      // Cornice is decoration, keep it room-based
      if (room.properties.hasCornice) {
        stats.cornice_length += perimeterM;
      }
    });

    // --- STRUCTURAL WALLS ---
    // Rule: If set to Detailed BUT no walls exist, fallback to Auto estimation.
    const hasWalls = unit.walls && unit.walls.length > 0;
    const useDetailedWalls = unit.structuralWallSource === 'detailed_unit' && hasWalls;
    
    if (useDetailedWalls) {
        // DETAILED WALLS CALCULATION
        unit.walls.forEach(wall => {
            let lengthM = 0;
            if (wall.manualLengthM !== undefined && wall.manualLengthM > 0) {
                lengthM = wall.manualLengthM;
            } else if (unit.scale > 0) {
                lengthM = wall.length_px / unit.scale;
            }

            // Determine Wall Height
            let wallHeight = 0;
            if (wall.properties.height && wall.properties.height > 0) {
                // Explicit manual height overrides everything
                wallHeight = wall.properties.height;
            } else {
                // Auto Calculation
                wallHeight = defaultFloorHeight;
                
                if (wall.properties.isUnderBeam && wall.properties.beamHeight > 0) {
                    // If explicitly marked as under beam with a specific height
                    wallHeight -= (wall.properties.beamHeight / 100);
                } else {
                    // Default deduction is Slab Thickness (15cm) per user request
                    wallHeight -= 0.15; 
                }
            }
            
            const wallArea = lengthM * wallHeight;

            if (wall.properties.material === 'gazbeton') {
                stats.wall_gazbeton_area += wallArea;
            } else if (wall.properties.material === 'tugla') {
                stats.wall_tugla_area += wallArea;
            } else if (wall.properties.material === 'briket') {
                stats.wall_briket_area += wallArea;
            }
        });
        
        // Paint Area Strategy for Detailed Mode
        if (unit.rooms.length > 0) {
             let totalRoomWallArea = 0;
             unit.rooms.forEach(r => {
                 const h = r.properties.ceilingHeight || defaultFloorHeight;
                 const p = r.manualPerimeterM || (r.perimeter_px / unit.scale) || 0;
                 totalRoomWallArea += (p * h);
             });
             // Deduct window/door rough estimate
             stats.net_wall_area = totalRoomWallArea * 0.85;
        } else {
             // Fallback to structural walls * 2 sides
             stats.net_wall_area = (stats.wall_gazbeton_area + stats.wall_tugla_area + stats.wall_briket_area) * 2;
        }

    } else {
        // GLOBAL AUTO WALLS (Fallback if Auto Mode OR Detailed Mode with no walls)
        const refArea = stats.total_area > 0 ? stats.total_area : defaultFloorArea;
        
        // Use default floor height for estimation
        const estimatedPerimeter = Math.sqrt(refArea) * 4 * 1.5; // Rough interior perimeter
        const estimatedWallSurface = estimatedPerimeter * (defaultFloorHeight - 0.5); // Deduct beam/slab
        
        // Default to Gazbeton (15'lik)
        stats.wall_gazbeton_area = estimatedWallSurface;
        stats.net_wall_area = estimatedWallSurface * 2; 
    }

    // --- STRUCTURAL CONCRETE (Columns, Beams, Slabs) ---
    // Rule: If set to Detailed BUT no elements exist, fallback to Auto estimation.
    const hasConcreteElements = (unit.columns && unit.columns.length > 0) || 
                                (unit.beams && unit.beams.length > 0) || 
                                (unit.slabs && unit.slabs.length > 0);
    
    const useDetailedConcrete = unit.structuralConcreteSource === 'detailed_unit' && hasConcreteElements;

    if (useDetailedConcrete) {
        // 1. Columns
        (unit.columns || []).forEach(col => {
            let areaM2 = 0;
            let perimeterM = 0;
            if (col.manualAreaM2 !== undefined && col.manualAreaM2 > 0) {
                areaM2 = col.manualAreaM2;
                perimeterM = col.manualPerimeterM || (Math.sqrt(areaM2) * 4);
            } else if (unit.scale > 0) {
                areaM2 = col.area_px / (unit.scale * unit.scale);
                perimeterM = col.perimeter_px / unit.scale;
            }
            
            // Auto Height if not specified
            const height = (col.properties.height && col.properties.height > 0) 
                           ? col.properties.height 
                           : defaultFloorHeight;

            stats.column_concrete_volume += areaM2 * height;
            stats.column_formwork_area += perimeterM * height;
        });

        // 2. Beams
        (unit.beams || []).forEach(beam => {
            let lengthM = 0;
            if (beam.manualLengthM !== undefined && beam.manualLengthM > 0) {
                lengthM = beam.manualLengthM;
            } else if (unit.scale > 0) {
                lengthM = beam.length_px / unit.scale;
            }
            const widthM = beam.properties.width / 100;
            const heightM = beam.properties.height / 100;
            const slabThickM = beam.properties.slabThickness / 100;

            stats.beam_concrete_volume += widthM * heightM * lengthM;
            const sideFormHeight = Math.max(0, heightM - slabThickM);
            stats.beam_formwork_area += (widthM + (2 * sideFormHeight)) * lengthM;
        });

        // 3. Slabs (Döşemeler)
        (unit.slabs || []).forEach(slab => {
            let area = 0;
            if (slab.manualAreaM2 > 0) {
                area = slab.manualAreaM2;
            } else if (slab.area_px && unit.scale > 0) {
                area = slab.area_px / (unit.scale * unit.scale);
            }
            
            const thick = slab.properties.thickness / 100;
            stats.slab_concrete_volume += area * thick;
            stats.slab_formwork_area += area; // Bottom formwork
        });

    } else {
        // GLOBAL AUTO CONCRETE (Fallback if Auto Mode OR Detailed Mode with no elements)
        const refArea = stats.total_area > 0 ? stats.total_area : defaultFloorArea;
        
        const kabaCat = currentCosts.find(c => c.id === 'kaba_insaat');
        if (kabaCat) {
             const betonItem = kabaCat.items.find(i => i.name === 'Betonarme Betonu (C30)');
             if (betonItem) {
                 const heightRatio = defaultFloorHeight / 3.0;
                 const totalConcrete = refArea * betonItem.multiplier * heightRatio;
                 
                 stats.slab_concrete_volume = totalConcrete * 0.65;
                 stats.column_concrete_volume = totalConcrete * 0.20;
                 stats.beam_concrete_volume = totalConcrete * 0.15;
             }
             
             const kalipItem = kabaCat.items.find(i => i.name === 'Kalıp İşçiliği & Malzeme');
             if (kalipItem) {
                 const heightRatio = defaultFloorHeight / 3.0;
                 const totalForm = refArea * kalipItem.multiplier * heightRatio;
                 
                 stats.slab_formwork_area = totalForm * 0.5;
                 stats.column_formwork_area = totalForm * 0.25;
                 stats.beam_formwork_area = totalForm * 0.25;
             }
        }
    }

    currentCosts.forEach(cat => {
      cat.items.forEach(item => {
        if (item.auto_source !== 'manual') {
            let qty = 0;
            
            const isConcrete = item.name === 'Betonarme Betonu (C30)';
            const isIron = item.name === 'İnşaat Demiri';
            const isFormwork = item.name === 'Kalıp İşçiliği & Malzeme';

            if (isConcrete || isIron || isFormwork) {
                // If we used detailed concrete logic (meaning we had elements), sum them up.
                // If we fell back to auto (because detailed was empty OR mode was auto), the stats
                // are already populated with the estimates above.
                
                // Note: Even if useDetailedConcrete is false, the stats.* variables are filled 
                // by the "GLOBAL AUTO CONCRETE" block above.
                if (useDetailedConcrete) {
                    const totalVol = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
                    const totalForm = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;
                    
                    if (isConcrete) qty = totalVol;
                    else if (isFormwork) qty = totalForm;
                    else if (isIron) qty = totalVol * 0.100; 
                } else {
                    // Fallback to purely using the calculated stats from the Auto block
                    if (isConcrete) qty = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
                    else if (isFormwork) qty = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;
                    else if (isIron) qty = (stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume) * 0.100;
                }
            } 
            else if (['Gazbeton Duvar (15\'lik)', 'Tuğla Duvar (13.5\'luk)', 'Briket Duvar (15\'lik)'].includes(item.name)) {
                 // @ts-ignore
                 const rawVal = stats[item.auto_source] || 0;
                 qty = parseFloat((rawVal * item.multiplier).toFixed(2));
            }
            else {
                 // @ts-ignore
                 const rawVal = stats[item.auto_source] || 0;
                 qty = parseFloat((rawVal * item.multiplier).toFixed(2));
            }

            quantities[item.name] = qty;
            totalCost += qty * item.unit_price;
        }
      });
    });

    return { quantities, totalCost, stats };
};
