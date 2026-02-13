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
      beam_formwork_area: 0
    };

    let defaultFloorHeight = buildingStats.normalFloorHeight;
    if (unit.floorType === 'ground') defaultFloorHeight = buildingStats.groundFloorHeight;
    if (unit.floorType === 'basement') defaultFloorHeight = buildingStats.basementFloorHeight;

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

    // --- STRUCTURAL CALCULATIONS BRANCHING ---

    if (unit.structuralSource === 'detailed_unit') {
        // A) DETAILED MODE: Use Drawn/Manual Elements

        // Rooms (for Wall Area Calculation based on Perimeter - Windows - Doors)
        (unit.rooms || []).forEach(room => {
             // Only calculate net wall paint area here if detailed.
             // If we rely on detailed walls (below), we might double count or miss paint.
             // Usually, paint area is derived from Room Perimeter in Architectural Mode.
             // We'll keep Paint Area calculation attached to Rooms.
             let perimeterM = 0;
             let areaM2 = 0;
             if (room.manualAreaM2) {
                 areaM2 = room.manualAreaM2;
                 perimeterM = room.manualPerimeterM || (Math.sqrt(areaM2) * 4);
             } else if(unit.scale > 0) {
                 perimeterM = room.perimeter_px / unit.scale;
             }
             
             const doorAreaDedudction = room.properties.doorCount * 2.1;
             const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - 0.15); 
             const grossWallArea = perimeterM * roomHeight;
             const netWall = Math.max(0, grossWallArea - room.properties.windowArea - doorAreaDedudction);
             
             if (room.properties.wallFinish === 'boya') {
                stats.net_wall_area += netWall;
             }
        });

        // Walls (Structural Material)
        (unit.walls || []).forEach(wall => {
            let lengthM = 0;
            if (wall.manualLengthM !== undefined && wall.manualLengthM > 0) {
                lengthM = wall.manualLengthM;
            } else if (unit.scale > 0) {
                lengthM = wall.length_px / unit.scale;
            }

            let wallHeight = defaultFloorHeight; 
            if (wall.properties.isUnderBeam) {
                wallHeight -= (wall.properties.beamHeight / 100); 
            } else {
                wallHeight -= 0.15; 
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

        // Columns
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
            const height = col.properties.height || defaultFloorHeight;
            stats.column_concrete_volume += areaM2 * height;
            stats.column_formwork_area += perimeterM * height;
        });

        // Beams
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
        
        // Fallback: If "detailed" is selected but no walls drawn, default to room perimeter approximation
        if ((unit.walls || []).length === 0 && (unit.rooms || []).length > 0) {
            // Treat like global approximation logic for walls only
             const estimatedWallArea = stats.total_area * 1.2; // Fallback coefficient
             stats.wall_gazbeton_area += estimatedWallArea; 
             stats.net_wall_area += estimatedWallArea * 2; // Paint both sides approx
        }

    } else {
        // B) GLOBAL CALCULATED MODE: Use Heuristics based on Area
        
        // Estimate Wall Area: Rule of thumb ~ 1.0 to 1.5 m² wall per 1 m² floor area depending on partitions.
        // We use 1.2 as a safe estimator for generic residential.
        const estimatedWallSurface = stats.total_area * 1.2;
        
        // Assign to default material (Gazbeton)
        stats.wall_gazbeton_area = estimatedWallSurface;
        
        // Estimate Paint Area (Wall Surface * 2 sides - openings + Ceiling)
        // Simply: Floor Area * 3.2 is a common painter's heuristic for total paintable area (Walls+Ceiling).
        // Since we have specific items for Ceiling Paint (total_area), we just estimate Wall Paint.
        stats.net_wall_area = estimatedWallSurface * 2; // Rough paint area
        
        // Concrete & Iron:
        // These are handled by 'auto_source: total_area' in cost_data.ts which uses the building total.
        // But for per-unit breakdown in the editor, we might want to populate stats.
        // However, the CostData logic multiplies (Unit Count * Unit Area * Multiplier) if we use total_area source.
        
        // Note: The specific column/beam stats (column_concrete_volume) will remain 0.
        // The cost engine will rely on the "Structure (Kaba İnşaat)" items which use 'total_area' source.
    }

    currentCosts.forEach(cat => {
      cat.items.forEach(item => {
        if (item.auto_source !== 'manual') {
          // @ts-ignore
          const rawVal = stats[item.auto_source] || 0;
          const qty = parseFloat((rawVal * item.multiplier).toFixed(2));
          quantities[item.name] = qty;
          totalCost += qty * item.unit_price;
        }
      });
    });

    return { quantities, totalCost, stats };
};