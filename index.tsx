import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { COST_DATA, CostCategory } from './cost_data';

// --- Types ---
type Point = { x: number; y: number };
type RoomType = 'living' | 'wet' | 'balcony' | 'other' | null;
type WallMaterial = 'gazbeton' | 'tugla' | 'briket' | 'alcipan';
type UnitFloorType = 'normal' | 'ground' | 'basement';

interface RoomProperties {
  ceilingHeight: number; // For volume/finish calc
  windowArea: number; 
  doorCount: number; 
  hasCornice: boolean;
  floorType: 'parke' | 'seramik' | 'beton' | 'unknown';
  wallFinish: 'boya' | 'seramik' | 'unknown'; 
}

interface WallProperties {
  material: WallMaterial;
  thickness: number; // cm
  isUnderBeam: boolean;
  beamHeight: number; // cm (deduction from floor height)
}

// Structural Element Properties
interface ColumnProperties {
    type: 'kolon' | 'perde';
    height: number; // Element height (usually floor height)
    connectingBeamHeight: number; // cm (Asked during save)
}

interface BeamProperties {
    width: number; // cm
    height: number; // cm
    slabThickness: number; // cm (Asked during save for formwork calc)
}

type Room = {
  id: string;
  name: string;
  points: Point[];
  area_px: number;
  perimeter_px: number;
  manualAreaM2?: number; 
  manualPerimeterM?: number;
  type: RoomType;
  properties: RoomProperties;
};

type Wall = {
  id: string;
  startPoint: Point;
  endPoint: Point;
  length_px: number;
  properties: WallProperties;
};

type Column = {
    id: string;
    points: Point[]; // Polygon
    area_px: number;
    perimeter_px: number;
    properties: ColumnProperties;
};

type Beam = {
    id: string;
    startPoint: Point;
    endPoint: Point;
    length_px: number;
    properties: BeamProperties;
};

interface UnitType {
    id: string;
    name: string;
    floorType: UnitFloorType; 
    count: number; 
    rooms: Room[];
    walls: Wall[]; 
    columns: Column[];
    beams: Beam[];
    imageData: string | null; 
    scale: number; 
    lastEdited: number;
}

// General Building Information with Location
interface BuildingStats {
    province: string;
    district: string;
    landArea: number;
    heatZone: number; 

    normalFloorCount: number;
    basementFloorCount: number;
    
    normalFloorHeight: number;
    groundFloorHeight: number;
    basementFloorHeight: number;

    normalFloorArea: number;
    groundFloorArea: number;
    basementFloorArea: number;
}

// --- Mock Data for Turkey Heat Zones ---
const TURKEY_HEAT_MAP: Record<string, { zone: number, districts: Record<string, number> }> = {
    "İstanbul": { 
        zone: 2, 
        districts: { "Kadıköy": 2, "Beşiktaş": 2, "Şile": 3, "Çatalca": 3, "Ümraniye": 2, "Esenyurt": 2 } 
    },
    "Ankara": { 
        zone: 3, 
        districts: { "Çankaya": 3, "Keçiören": 3, "Yenimahalle": 3, "Gölbaşı": 4, "Mamak": 3 } 
    },
    "İzmir": { 
        zone: 1, 
        districts: { "Konak": 1, "Bornova": 1, "Çeşme": 1, "Karşıyaka": 1, "Ödemiş": 2 } 
    },
    "Antalya": { 
        zone: 1, 
        districts: { "Muratpaşa": 1, "Alanya": 1, "Kaş": 1, "Elmalı": 2 } 
    },
    "Erzurum": { 
        zone: 4, 
        districts: { "Yakutiye": 4, "Palandöken": 4, "Horasan": 4 } 
    },
    "Bursa": { 
        zone: 2, 
        districts: { "Osmangazi": 2, "Nilüfer": 2, "İnegöl": 3, "Uludağ": 4 } 
    },
    "Adana": {
        zone: 1,
        districts: { "Seyhan": 1, "Çukurova": 1, "Kozan": 1 }
    }
};

// --- Helper Functions ---
function getPolygonAreaAndPerimeter(points: Point[]) {
  let area = 0;
  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
    perimeter += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
  }
  area = Math.abs(area) / 2;
  return { area, perimeter };
}

function isPointInPolygon(point: Point, vs: Point[]) {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point to line segment
function distanceToSegment(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

const floodFillRoom = (ctx: CanvasRenderingContext2D, startX: number, startY: number, width: number, height: number): Point[] | null => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixelStack = [[Math.round(startX), Math.round(startY)]];
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx+1], data[idx+2]];
  };
  const startColor = getPixel(startX, startY);
  const isWall = (r: number, g: number, b: number) => (r + g + b) / 3 < 120; 
  if (isWall(startColor[0], startColor[1], startColor[2])) return null;

  const visited = new Int8Array(width * height);
  let minX = width, maxX = 0, minY = height, maxY = 0;

  while (pixelStack.length) {
    const newPos = pixelStack.pop()!;
    const x = newPos[0], y = newPos[1];
    const idx = y * width + x;
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) continue;
    const [r, g, b] = getPixel(x, y);
    if (!isWall(r, g, b)) {
      visited[idx] = 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      pixelStack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  const points: Point[] = [];
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const rayCount = 36;
  for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let cx = centerX, cy = centerY;
      while (true) {
          const nx = Math.round(cx + dx * 2);
          const ny = Math.round(cy + dy * 2);
          const idx = ny * width + nx;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY || !visited[idx]) {
              points.push({x: cx, y: cy});
              break;
          }
          cx = nx; cy = ny;
      }
  }
  return points;
};

// --- SVG Icons Helper ---
const getCategoryIcon = (id: string) => {
    switch (id) {
        case 'kaba_insaat': 
            return <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
        case 'duvar_tavan': 
            return <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>;
        case 'zemin_kaplama': 
            return <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
        case 'tesisat_diger': 
            return <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
        default:
            return <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
    }
};

// --- Cost Calculator Function ---
const calculateUnitCost = (unit: UnitType, currentCosts: CostCategory[], buildingStats: BuildingStats) => {
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

    // 1. Rooms - Safety Check
    (unit.rooms || []).forEach(room => {
      let areaM2 = 0;
      let perimeterM = 0;

      if (room.manualAreaM2 !== undefined) {
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

      const doorAreaDedudction = room.properties.doorCount * 2.1;
      const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - 0.15); 
      const grossWallArea = perimeterM * roomHeight;
      const netWall = Math.max(0, grossWallArea - room.properties.windowArea - doorAreaDedudction);
      
      if (room.properties.wallFinish === 'boya') {
         stats.net_wall_area += netWall;
      }
      if (room.properties.hasCornice) {
        stats.cornice_length += perimeterM;
      }
    });

    // 2. Walls - Safety Check
    (unit.walls || []).forEach(wall => {
        let lengthM = 0;
        if (unit.scale > 0) {
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

    // 3. Columns - Safety Check
    (unit.columns || []).forEach(col => {
        if(unit.scale > 0) {
            const areaM2 = col.area_px / (unit.scale * unit.scale);
            const perimeterM = col.perimeter_px / unit.scale;
            const height = col.properties.height || defaultFloorHeight;
            
            stats.column_concrete_volume += areaM2 * height;
            stats.column_formwork_area += perimeterM * height;
        }
    });

    // 4. Beams - Safety Check
    (unit.beams || []).forEach(beam => {
        if(unit.scale > 0) {
            const lengthM = beam.length_px / unit.scale;
            const widthM = beam.properties.width / 100;
            const heightM = beam.properties.height / 100;
            const slabThickM = beam.properties.slabThickness / 100;

            stats.beam_concrete_volume += widthM * heightM * lengthM;
            // Formwork: Bottom (Width) + 2 * Sides (Height - SlabThickness)
            const sideFormHeight = Math.max(0, heightM - slabThickM);
            stats.beam_formwork_area += (widthM + (2 * sideFormHeight)) * lengthM;
        }
    });

    // Fallback for Rooms if no walls
    if ((unit.walls || []).length === 0 && (unit.rooms || []).length > 0) {
         (unit.rooms || []).forEach(room => {
             let areaM2 = room.manualAreaM2 || 0;
             let perimeterM = 0;
             if (unit.scale > 0 && !room.manualAreaM2) {
                 perimeterM = room.perimeter_px / unit.scale;
             } else {
                 perimeterM = room.manualPerimeterM || (Math.sqrt(areaM2) * 4);
             }
             
             const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - 0.15);
             const grossWallArea = perimeterM * roomHeight;
             const netWall = Math.max(0, grossWallArea - room.properties.windowArea - (room.properties.doorCount * 2.1));

             stats.wall_gazbeton_area += netWall; 
         });
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

// --- Main Component ---
const App = () => {
  // --- Global State ---
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  
  const [costs, setCosts] = useState<CostCategory[]>(COST_DATA);
  const [originalWixPrices, setOriginalWixPrices] = useState<Map<string, number>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [units, setUnits] = useState<UnitType[]>([
      { id: '1', name: 'Tip A (2+1)', count: 5, rooms: [], walls: [], columns: [], beams: [], floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now() }
  ]);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

  const [buildingStats, setBuildingStats] = useState<BuildingStats>({
      province: 'İstanbul',
      district: 'Kadıköy',
      landArea: 500,
      heatZone: 2,
      normalFloorCount: 5,
      basementFloorCount: 1,
      normalFloorHeight: 2.9,
      groundFloorHeight: 3.5,
      basementFloorHeight: 3.0,
      normalFloorArea: 250, 
      groundFloorArea: 250,
      basementFloorArea: 300
  });

  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false); 
  const [isFetchingHeat, setIsFetchingHeat] = useState(false);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  // --- Editor State ---
  const [editorImage, setEditorImage] = useState<HTMLImageElement | null>(null);
  const [editorRooms, setEditorRooms] = useState<Room[]>([]);
  const [editorWalls, setEditorWalls] = useState<Wall[]>([]); 
  const [editorColumns, setEditorColumns] = useState<Column[]>([]);
  const [editorBeams, setEditorBeams] = useState<Beam[]>([]);
  const [editorScale, setEditorScale] = useState<number>(0);
  
  const [zoom, setZoom] = useState<number>(1);
  const [mode, setMode] = useState<'view' | 'calibrate' | 'draw' | 'magic' | 'select' | 'draw_wall' | 'draw_column' | 'draw_beam'>('view');
  
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]); 
  const [drawingWallStart, setDrawingWallStart] = useState<Point | null>(null); 
  
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null); 
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedBeamId, setSelectedBeamId] = useState<string | null>(null);
  
  const [tempRoomData, setTempRoomData] = useState<Room | null>(null);
  const [tempWallData, setTempWallData] = useState<Wall | null>(null);
  const [tempColumnData, setTempColumnData] = useState<Column | null>(null);
  const [tempBeamData, setTempBeamData] = useState<Beam | null>(null);

  const [editorQuantities, setEditorQuantities] = useState<Record<string, number>>({});
  const [editorStats, setEditorStats] = useState<any>({}); 
  
  const [modalType, setModalType] = useState<'roomParams' | 'wallParams' | 'columnParams' | 'beamParams' | 'calibrationInput' | null>(null);
  const [tempCalibrationDist, setTempCalibrationDist] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Calculations for Dashboard ---
  const totalConstructionArea = useMemo(() => {
    return (buildingStats.normalFloorCount * buildingStats.normalFloorArea) + 
           buildingStats.groundFloorArea + 
           (buildingStats.basementFloorCount * buildingStats.basementFloorArea);
  }, [buildingStats]);

  const { projectCostDetails, projectTotalCost, globalStructuralCost, interiorFitoutCost } = useMemo(() => {
    let structuralCost = 0;
    let fitoutCost = 0;
    const details: { id: string, title: string, totalCategoryCost: number, items: any[] }[] = [];

    // 1. Calculate Global Structural Cost
    const structCat = costs.find(c => c.id === 'kaba_insaat');
    if (structCat) {
        const items = structCat.items.map(item => {
            let qty = 0;
            if (item.auto_source === 'total_area') {
                qty = totalConstructionArea * item.multiplier;
            } else {
                 qty = 0; 
            }
            const val = qty * item.unit_price;
            structuralCost += val;
            return { ...item, totalPrice: val, totalQty: qty };
        });
        details.push({
            id: structCat.id,
            title: structCat.title,
            totalCategoryCost: structuralCost,
            items: items
        });
    }

    // 2. Calculate Interior Fitout Costs
    const fitoutCats = costs.filter(c => c.id !== 'kaba_insaat');
    const aggMap = new Map<string, { title: string, cost: number, items: Map<string, {item: any, qty: number, price: number}> }>();
    fitoutCats.forEach(c => {
        aggMap.set(c.id, { title: c.title, cost: 0, items: new Map() });
        c.items.forEach(i => {
            aggMap.get(c.id)!.items.set(i.name, { item: i, qty: 0, price: 0 });
        });
    });

    units.forEach(unit => {
        const { quantities, totalCost } = calculateUnitCost(unit, fitoutCats, buildingStats);
        fitoutCost += totalCost * unit.count;

        fitoutCats.forEach(c => {
            const catData = aggMap.get(c.id)!;
            let unitCatCost = 0;
            c.items.forEach(i => {
                const q = quantities[i.name] || 0;
                const p = q * i.unit_price;
                unitCatCost += p;
                
                const itemData = catData.items.get(i.name)!;
                itemData.qty += q * unit.count;
                itemData.price += p * unit.count;
            });
            catData.cost += unitCatCost * unit.count;
        });
    });

    fitoutCats.forEach(c => {
        const d = aggMap.get(c.id)!;
        const itemsArr = Array.from(d.items.values()).map(v => ({
            ...v.item,
            totalPrice: v.price,
            totalQty: v.qty
        }));
        details.push({
            id: c.id,
            title: d.title,
            totalCategoryCost: d.cost,
            items: itemsArr
        });
    });

    return {
        projectCostDetails: details,
        projectTotalCost: structuralCost + fitoutCost,
        globalStructuralCost: structuralCost,
        interiorFitoutCost: fitoutCost
    };
  }, [costs, units, totalConstructionArea, buildingStats]);

  // --- Fetch Prices ---
  useEffect(() => {
    const fetchPrices = async () => {
        setIsFetchingPrices(true);
        try {
            const WIX_API_URL = 'https://your-wix-site-url.com/_functions/fiyatListesi'; 
            const response = await fetch(WIX_API_URL);
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success' && Array.isArray(result.data)) {
                    const priceMap = new Map<string, number>();
                    result.data.forEach((item: any) => {
                         if (item._id && item.fiyat) {
                             priceMap.set(item._id, Number(item.fiyat));
                         }
                    });
                    setOriginalWixPrices(priceMap);
                    setCosts(prevCosts => prevCosts.map(cat => ({
                        ...cat,
                        items: cat.items.map(item => {
                            if (item.wixId && priceMap.has(item.wixId)) {
                                return { ...item, unit_price: priceMap.get(item.wixId)! };
                            }
                            return item;
                        })
                    })));
                }
            }
        } catch (error) {
            console.warn("Failed to fetch prices from Wix backend (Check URL)", error);
        } finally {
            setIsFetchingPrices(false);
        }
    };
    fetchPrices();
  }, []);

  // --- Handlers ---
  const handlePriceChange = (catId: string, itemName: string, newPrice: number) => {
      setCosts(prevCosts => prevCosts.map(cat => {
          if (cat.id !== catId) return cat;
          return {
              ...cat,
              items: cat.items.map(item => {
                  if (item.name !== itemName) return item;
                  return { ...item, unit_price: newPrice };
              })
          };
      }));
  };

  const handleQuantityChange = (catId: string, itemName: string, newQuantity: number) => {
      setCosts(prevCosts => prevCosts.map(cat => {
          if (cat.id !== catId) return cat;
          return {
              ...cat,
              items: cat.items.map(item => {
                  if (item.name !== itemName) return item;
                  return { ...item, manualQuantity: newQuantity };
              })
          };
      }));
  };

  const handleMultiplierChange = (catId: string, itemName: string, newMultiplier: number) => {
      setCosts(prevCosts => prevCosts.map(cat => {
          if (cat.id !== catId) return cat;
          return {
              ...cat,
              items: cat.items.map(item => {
                  if (item.name !== itemName) return item;
                  return { ...item, multiplier: newMultiplier };
              })
          };
      }));
  };

  const handleRevertPrice = (catId: string, itemName: string) => {
      setCosts(prevCosts => prevCosts.map(cat => {
          if (cat.id !== catId) return cat;
          return {
              ...cat,
              items: cat.items.map(item => {
                  if (item.name !== itemName) return item;
                  const originalItem = COST_DATA.find(c => c.id === catId)?.items.find(i => i.name === itemName);
                  let revertPrice = originalItem?.unit_price || 0;
                  if (item.wixId && originalWixPrices.has(item.wixId)) {
                      revertPrice = originalWixPrices.get(item.wixId)!;
                  }
                  return { ...item, unit_price: revertPrice };
              })
          };
      }));
  };

  const handleRevertQuantity = (catId: string, itemName: string) => {
      setCosts(prevCosts => prevCosts.map(cat => {
          if (cat.id !== catId) return cat;
          return {
              ...cat,
              items: cat.items.map(item => {
                  if (item.name !== itemName) return item;
                  return { ...item, manualQuantity: undefined };
              })
          };
      }));
  };

  const handleAddUnit = () => {
      const newUnit: UnitType = {
          id: Date.now().toString(),
          name: `Yeni Tip ${units.length + 1}`,
          floorType: 'normal',
          count: 1,
          rooms: [],
          walls: [],
          columns: [],
          beams: [],
          imageData: null,
          scale: 0,
          lastEdited: Date.now()
      };
      setUnits([...units, newUnit]);
  };

  const handleEditUnit = (id: string) => {
      const unit = units.find(u => u.id === id);
      if (!unit) return;

      setActiveUnitId(id);
      setEditorRooms(unit.rooms || []);
      setEditorWalls(unit.walls || []);
      setEditorColumns(unit.columns || []);
      setEditorBeams(unit.beams || []);
      setEditorScale(unit.scale);
      
      if (unit.imageData) {
          const img = new Image();
          img.onload = () => {
              setEditorImage(img);
              if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
              }
              setMode('view');
              setZoom(1);
          };
          img.src = unit.imageData;
      } else {
          setEditorImage(null);
      }
      setView('editor');
  };

  const handleDeleteUnit = (id: string) => {
      if (confirm('Silmek istediğinize emin misiniz?')) {
          setUnits(units.filter(u => u.id !== id));
      }
  };

  const handleUpdateUnitCount = (id: string, newCount: number) => {
      setUnits(units.map(u => u.id === id ? { ...u, count: Math.max(1, newCount) } : u));
  };

  const handleUpdateUnitName = (id: string, newName: string) => {
      setUnits(units.map(u => u.id === id ? { ...u, name: newName } : u));
  };
  
  const handleUpdateUnitFloorType = (id: string, newFloorType: UnitFloorType) => {
      setUnits(units.map(u => u.id === id ? { ...u, floorType: newFloorType } : u));
  };

  const saveAndExitEditor = () => {
      if (activeUnitId) {
          setUnits(units.map(u => u.id === activeUnitId ? {
              ...u,
              rooms: editorRooms,
              walls: editorWalls,
              columns: editorColumns,
              beams: editorBeams,
              scale: editorScale,
              imageData: editorImage ? editorImage.src : null,
              lastEdited: Date.now()
          } : u));
      }
      setView('dashboard');
      setActiveUnitId(null);
  };

  // --- Heat Zone Logic ---
  const fetchHeatZoneCoefficient = async (province: string, district: string) => {
    setIsFetchingHeat(true);
    await new Promise(resolve => setTimeout(resolve, 600));

    let zone = 2; 
    try {
        const provData = TURKEY_HEAT_MAP[province];
        if (provData) {
            if (provData.districts && provData.districts[district]) {
                zone = provData.districts[district];
            } else {
                zone = provData.zone;
            }
        }
    } catch (e) {
        console.warn("Could not fetch heat zone", e);
    }
    setBuildingStats(prev => ({ ...prev, heatZone: zone }));
    setIsFetchingHeat(false);
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProv = e.target.value;
      const defaultDist = TURKEY_HEAT_MAP[newProv] ? Object.keys(TURKEY_HEAT_MAP[newProv].districts)[0] || 'Merkez' : 'Merkez';
      setBuildingStats(prev => ({ ...prev, province: newProv, district: defaultDist }));
      fetchHeatZoneCoefficient(newProv, defaultDist);
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newDist = e.target.value;
      setBuildingStats(prev => ({ ...prev, district: newDist }));
      fetchHeatZoneCoefficient(buildingStats.province, newDist);
  };

  // --- Editor Logic ---
  useEffect(() => {
    if (view !== 'editor') return;
    const tempUnit: UnitType = {
        id: 'temp', name: 'temp', count: 1, 
        rooms: editorRooms, walls: editorWalls, columns: editorColumns, beams: editorBeams,
        floorType: units.find(u=>u.id===activeUnitId)?.floorType || 'normal',
        imageData: null, scale: editorScale, lastEdited: 0
    };
    const { quantities, stats } = calculateUnitCost(tempUnit, costs, buildingStats);
    setEditorQuantities(quantities);
    setEditorStats(stats);
  }, [editorRooms, editorWalls, editorColumns, editorBeams, editorScale, view, costs, buildingStats, activeUnitId]);

  useEffect(() => {
    if (view !== 'editor') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (editorImage) ctx.drawImage(editorImage, 0, 0);

    // 1. Draw Columns (Lowest layer usually)
    editorColumns.forEach((col, idx) => {
        if(col.points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(col.points[0].x, col.points[0].y);
        for(let i=1; i<col.points.length; i++) ctx.lineTo(col.points[i].x, col.points[i].y);
        ctx.closePath();
        
        ctx.fillStyle = col.id === selectedColumnId ? '#ef4444' : '#475569'; // Selected: Red, Default: Slate
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label for Column
        const cx = col.points.reduce((acc, p) => acc + p.x, 0) / col.points.length;
        const cy = col.points.reduce((acc, p) => acc + p.y, 0) / col.points.length;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`S${idx + 1}`, cx, cy);
    });

    // 2. Draw Beams
    editorBeams.forEach((beam, idx) => {
        ctx.beginPath();
        ctx.moveTo(beam.startPoint.x, beam.startPoint.y);
        ctx.lineTo(beam.endPoint.x, beam.endPoint.y);
        
        const isSelected = beam.id === selectedBeamId;
        // Visualize width approx 30cm = 10px scaled (just a visual representation)
        const visualWidth = Math.max(6, beam.properties.width / 3); 
        
        ctx.lineWidth = visualWidth;
        ctx.strokeStyle = isSelected ? '#ef4444' : '#0ea5e9'; // Blue for beams
        ctx.lineCap = 'butt';
        ctx.stroke();
        
        // Dashed center line
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
        ctx.fillStyle = '#fff'; // White text
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);
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

      if (room.type) {
        ctx.fillStyle = room.type === 'wet' ? 'rgba(59, 130, 246, 0.4)' : 
                        room.type === 'living' ? 'rgba(249, 115, 22, 0.4)' : 
                        room.type === 'balcony' ? 'rgba(34, 197, 94, 0.4)' :
                        'rgba(148, 163, 184, 0.4)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      }
      ctx.fill();

      const isSelected = room.id === selectedRoomId;
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.strokeStyle = isSelected ? '#ef4444' : (room.type ? '#333' : '#dc2626');
      ctx.stroke();

      if (editorScale > 0 && room.type) {
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
        
        const isSelected = wall.id === selectedWallId;
        const visualThickness = Math.max(3, (wall.properties.thickness / 5)); 

        ctx.lineWidth = isSelected ? visualThickness + 4 : visualThickness;
        ctx.strokeStyle = isSelected ? '#ef4444' : 
                          wall.properties.material === 'gazbeton' ? '#facc15' : 
                          wall.properties.material === 'tugla' ? '#f97316' : 
                          wall.properties.material === 'briket' ? '#a8a29e' : '#cbd5e1';
        ctx.stroke();

        if (isSelected) {
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

  }, [editorImage, editorRooms, editorWalls, editorColumns, editorBeams, drawingPoints, drawingWallStart, calibrationPoints, cursorPos, mode, selectedRoomId, selectedWallId, selectedColumnId, selectedBeamId, editorScale, view, costs]);

  // ... (Keep Image Upload) ...
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        if (canvasRef.current) {
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
        }
        setEditorImage(img);
        setMode('view');
        setEditorRooms([]);
        setEditorWalls([]);
        setEditorColumns([]);
        setEditorBeams([]);
        setEditorScale(0);
        setZoom(1);
      };
      img.src = evt.target.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const getCanvasCoordinates = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const openRoomModal = (room: Room) => {
      setTempRoomData(JSON.parse(JSON.stringify(room)));
      setSelectedRoomId(room.id);
      setSelectedWallId(null);
      setSelectedColumnId(null);
      setSelectedBeamId(null);
      setModalType('roomParams');
  };

  const openWallModal = (wall: Wall) => {
      setTempWallData(JSON.parse(JSON.stringify(wall)));
      setSelectedWallId(wall.id);
      setSelectedRoomId(null);
      setSelectedColumnId(null);
      setSelectedBeamId(null);
      setModalType('wallParams');
  };

  const openColumnModal = (col: Column) => {
      setTempColumnData(JSON.parse(JSON.stringify(col)));
      setSelectedColumnId(col.id);
      setSelectedRoomId(null);
      setSelectedWallId(null);
      setSelectedBeamId(null);
      setModalType('columnParams');
  };

  const openBeamModal = (beam: Beam) => {
      setTempBeamData(JSON.parse(JSON.stringify(beam)));
      setSelectedBeamId(beam.id);
      setSelectedRoomId(null);
      setSelectedWallId(null);
      setSelectedColumnId(null);
      setModalType('beamParams');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (view !== 'editor') return;
    const { x, y } = getCanvasCoordinates(e);

    if (mode === 'calibrate') {
      const newPoints = [...calibrationPoints, { x, y }];
      setCalibrationPoints(newPoints);
      if (newPoints.length === 2) {
        const distPx = Math.hypot(newPoints[1].x - newPoints[0].x, newPoints[1].y - newPoints[0].y);
        setTempCalibrationDist(distPx);
        setModalType('calibrationInput');
      }
    } 
    else if (mode === 'draw' || mode === 'draw_column') {
      if (drawingPoints.length > 2 && Math.hypot(x - drawingPoints[0].x, y - drawingPoints[0].y) < 20) {
        if(mode === 'draw') finishPolygon();
        if(mode === 'draw_column') finishColumnPolygon();
      } else {
        setDrawingPoints([...drawingPoints, { x, y }]);
      }
    }
    else if (mode === 'draw_wall' || mode === 'draw_beam') {
        if (!drawingWallStart) {
            setDrawingWallStart({x, y});
        } else {
            if(mode === 'draw_wall') createWall(drawingWallStart, {x, y});
            if(mode === 'draw_beam') createBeam(drawingWallStart, {x, y});
            setDrawingWallStart(null); 
        }
    }
    else if (mode === 'magic') {
        if (!canvasRef.current) return;
        setIsProcessing(true);
        setTimeout(() => {
            const ctx = canvasRef.current!.getContext('2d');
            if(ctx) {
                const points = floodFillRoom(ctx, x, y, canvasRef.current!.width, canvasRef.current!.height);
                if (points && points.length > 2) {
                    createRoom(points, `Oda ${editorRooms.length + 1}`);
                } else {
                    alert("Oda algılanamadı.");
                }
            }
            setIsProcessing(false);
        }, 10);
    }
    else if (mode === 'select' || mode === 'view') {
      // Prioritize smaller/lines first
      let clickedWall = null;
      for (const w of editorWalls) if (distanceToSegment({x,y}, w.startPoint, w.endPoint) < 5) { clickedWall = w; break; }
      
      let clickedBeam = null;
      for (const b of editorBeams) if (distanceToSegment({x,y}, b.startPoint, b.endPoint) < 5) { clickedBeam = b; break; }

      if (clickedBeam) { openBeamModal(clickedBeam); return; }
      if (clickedWall) { openWallModal(clickedWall); return; }

      const clickedColumn = editorColumns.find(c => isPointInPolygon({x,y}, c.points));
      if (clickedColumn) { openColumnModal(clickedColumn); return; }

      const clickedRoom = editorRooms.find(r => r.points.length > 0 && isPointInPolygon({ x, y }, r.points));
      if (clickedRoom) { openRoomModal(clickedRoom); return; }
      
      setSelectedRoomId(null); setSelectedWallId(null); setSelectedColumnId(null); setSelectedBeamId(null);
    }
  };

  const createRoom = (points: Point[], defaultName: string) => {
    const { area, perimeter } = getPolygonAreaAndPerimeter(points);
    const newRoom: Room = {
      id: Date.now().toString(),
      name: defaultName,
      points: points,
      area_px: area,
      perimeter_px: perimeter,
      type: null,
      properties: { ceilingHeight: 2.8, windowArea: 0, doorCount: 1, hasCornice: true, floorType: 'unknown', wallFinish: 'boya' }
    };
    setEditorRooms([...editorRooms, newRoom]);
    setDrawingPoints([]);
    setMode('select');
    openRoomModal(newRoom);
  };

  const finishColumnPolygon = () => {
      if(drawingPoints.length < 3) return;
      const { area, perimeter } = getPolygonAreaAndPerimeter(drawingPoints);
      const newCol: Column = {
          id: Date.now().toString(),
          points: drawingPoints,
          area_px: area,
          perimeter_px: perimeter,
          properties: { type: 'kolon', height: 2.9, connectingBeamHeight: 50 }
      };
      setEditorColumns([...editorColumns, newCol]);
      setDrawingPoints([]);
      openColumnModal(newCol);
  }

  const createWall = (start: Point, end: Point) => {
      const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
      const newWall: Wall = {
          id: Date.now().toString(),
          startPoint: start,
          endPoint: end,
          length_px: lengthPx,
          properties: { material: 'gazbeton', thickness: 13.5, isUnderBeam: false, beamHeight: 50 }
      };
      setEditorWalls([...editorWalls, newWall]);
      openWallModal(newWall);
  };

  const createBeam = (start: Point, end: Point) => {
      const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
      const newBeam: Beam = {
          id: Date.now().toString(),
          startPoint: start,
          endPoint: end,
          length_px: lengthPx,
          properties: { width: 25, height: 50, slabThickness: 15 }
      };
      setEditorBeams([...editorBeams, newBeam]);
      openBeamModal(newBeam);
  };

  const finishPolygon = () => {
    if (drawingPoints.length < 3) return;
    createRoom(drawingPoints, `Oda ${editorRooms.length + 1}`);
  };

  const addManualRoom = () => {
    const newRoom: Room = {
        id: Date.now().toString(),
        name: `Manuel Oda ${editorRooms.length + 1}`,
        points: [],
        area_px: 0,
        perimeter_px: 0,
        manualAreaM2: 15,
        manualPerimeterM: 15.65,
        type: 'living',
        properties: { ceilingHeight: 2.8, windowArea: 2, doorCount: 1, hasCornice: true, floorType: 'parke', wallFinish: 'boya' }
    };
    setEditorRooms([...editorRooms, newRoom]);
    openRoomModal(newRoom);
  };

  const handleCalibrationSubmit = (meters: number) => {
    if (tempCalibrationDist && meters > 0) {
      const newScale = tempCalibrationDist / meters;
      setEditorScale(newScale);
      setCalibrationPoints([]);
      setModalType(null);
      setMode('view');
      alert(`Kalibrasyon: 1m = ${newScale.toFixed(2)}px`);
    }
  };

  const handleRoomUpdate = (updatedProps: Partial<RoomProperties>, type?: RoomType, name?: string, manualStats?: {area: number, perimeter: number}) => {
    setEditorRooms(editorRooms.map(r => {
        if (r.id !== selectedRoomId) return r;
        const newType = type || r.type;
        let newProps = { ...r.properties, ...updatedProps };
        if (type && type !== r.type) {
            if (type === 'living') { newProps.floorType = 'parke'; newProps.wallFinish = 'boya'; } 
            else if (type === 'wet') { newProps.floorType = 'seramik'; newProps.wallFinish = 'seramik'; newProps.hasCornice = false; } 
            else if (type === 'balcony') { newProps.floorType = 'seramik'; newProps.wallFinish = 'boya'; newProps.hasCornice = false; } 
            else if (type === 'other') { newProps.floorType = 'beton'; newProps.wallFinish = 'boya'; }
        }
        return { ...r, name: name || r.name, type: newType, manualAreaM2: manualStats ? manualStats.area : r.manualAreaM2, manualPerimeterM: manualStats ? manualStats.perimeter : r.manualPerimeterM, properties: newProps };
    }));
  };

  const handleWallUpdate = (updatedProps: Partial<WallProperties>) => {
      setEditorWalls(editorWalls.map(w => { if (w.id !== selectedWallId) return w; return { ...w, properties: { ...w.properties, ...updatedProps } }; }));
  };

  const handleColumnUpdate = (updatedProps: Partial<ColumnProperties>) => {
      setEditorColumns(editorColumns.map(c => { if(c.id !== selectedColumnId) return c; return { ...c, properties: { ...c.properties, ...updatedProps }}; }));
  };

  const handleBeamUpdate = (updatedProps: Partial<BeamProperties>) => {
      setEditorBeams(editorBeams.map(b => { if(b.id !== selectedBeamId) return b; return { ...b, properties: { ...b.properties, ...updatedProps }}; }));
  };

  const handleCancelEdit = () => {
      if (tempRoomData && selectedRoomId) setEditorRooms(prev => prev.map(r => r.id === selectedRoomId ? tempRoomData : r));
      if (tempWallData && selectedWallId) setEditorWalls(prev => prev.map(w => w.id === selectedWallId ? tempWallData : w));
      if (tempColumnData && selectedColumnId) setEditorColumns(prev => prev.map(c => c.id === selectedColumnId ? tempColumnData : c));
      if (tempBeamData && selectedBeamId) setEditorBeams(prev => prev.map(b => b.id === selectedBeamId ? tempBeamData : b));
      
      setModalType(null); setSelectedRoomId(null); setSelectedWallId(null); setSelectedColumnId(null); setSelectedBeamId(null);
      setTempRoomData(null); setTempWallData(null); setTempColumnData(null); setTempBeamData(null);
  };

  const handleSaveEdit = () => {
      setModalType(null); setSelectedRoomId(null); setSelectedWallId(null); setSelectedColumnId(null); setSelectedBeamId(null);
      setTempRoomData(null); setTempWallData(null); setTempColumnData(null); setTempBeamData(null);
  };

  const deleteRoom = () => { if (selectedRoomId) { setEditorRooms(editorRooms.filter(r => r.id !== selectedRoomId)); handleSaveEdit(); } };
  const deleteWall = () => { if (selectedWallId) { setEditorWalls(editorWalls.filter(w => w.id !== selectedWallId)); handleSaveEdit(); } };
  const deleteColumn = () => { if (selectedColumnId) { setEditorColumns(editorColumns.filter(c => c.id !== selectedColumnId)); handleSaveEdit(); } };
  const deleteBeam = () => { if (selectedBeamId) { setEditorBeams(editorBeams.filter(b => b.id !== selectedBeamId)); handleSaveEdit(); } };

  const exportProjectCSV = () => {
      let csv = "\uFEFF";
      csv += `PROJE GENEL MALİYET RAPORU\n\n`;
      csv += `İl:;${buildingStats.province}\n`;
      csv += `İlçe:;${buildingStats.district}\n`;
      csv += `Toplam İnşaat Alanı;${totalConstructionArea.toLocaleString()} m2\n`;
      csv += `Genel Toplam;${projectTotalCost.toLocaleString()} TL\n\n`;
      
      let globalQuantities: Record<string, number> = {};
      units.forEach(unit => {
          const { quantities } = calculateUnitCost(unit, costs, buildingStats);
          Object.entries(quantities).forEach(([key, val]) => {
              if (!globalQuantities[key]) globalQuantities[key] = 0;
              globalQuantities[key] += val * unit.count;
          });
      });

      csv += "Kategori;Kalem;Toplam Miktar;Birim;Birim Fiyat;Toplam Tutar\n";
      costs.forEach(cat => {
        cat.items.forEach(item => {
          let qty = 0;
          if (cat.id === 'kaba_insaat' && item.auto_source === 'total_area') {
              qty = totalConstructionArea * item.multiplier;
          } else {
              qty = globalQuantities[item.name] || 0;
          }
          const total = qty * item.unit_price;
          csv += `${cat.title};"${item.name}";${qty.toLocaleString('tr-TR')};${item.unit};${item.unit_price};${total.toLocaleString('tr-TR')}\n`;
        });
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "proje_maliyet_ozeti.csv";
      link.click();
  };

  const selectedRoom = editorRooms.find(r => r.id === selectedRoomId);
  const selectedWall = editorWalls.find(w => w.id === selectedWallId);
  const selectedColumn = editorColumns.find(c => c.id === selectedColumnId);
  const selectedBeam = editorBeams.find(b => b.id === selectedBeamId);

  // --- RENDER ---
  if (view === 'dashboard') {
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

            <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">
                {/* 1. SECTION: BUILDING GENERAL INFO */}
                 <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-bl-full -mr-10 -mt-10"></div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-building text-blue-500"></i> Yapı Genel Bilgileri
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Kat adetleri, yükseklikleri ve alan bilgileri</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowStructureModal(true)} className="bg-yellow-600/20 hover:bg-yellow-600 text-yellow-400 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition border border-yellow-600/30">
                                <i className="fas fa-hammer mr-2"></i>Kaba Yapı Detay
                            </button>
                            <button onClick={() => setShowBuildingModal(true)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition border border-blue-600/30">
                                <i className="fas fa-pen mr-2"></i>Düzenle
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Konum / Arsa</div>
                            <div className="text-lg font-bold text-white truncate">{buildingStats.province}, {buildingStats.district}</div>
                             <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-slate-500">{buildingStats.landArea} m² Arsa</span>
                                <span className="text-[10px] text-orange-400 font-bold">{buildingStats.heatZone}. Isı Bölgesi</span>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Toplam İnşaat Alanı</div>
                            <div className="text-2xl font-bold text-white">{totalConstructionArea.toLocaleString()} m²</div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Toplam Bina Yüksekliği</div>
                            <div className="text-2xl font-bold text-white">
                                {(
                                    (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + 
                                    buildingStats.groundFloorHeight + 
                                    (buildingStats.basementFloorCount * buildingStats.basementFloorHeight)
                                ).toFixed(1)} m
                            </div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Kaba Yapı Maliyeti</div>
                            <div className="text-2xl font-bold text-yellow-500">{globalStructuralCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                            <div className="text-[10px] text-slate-500 mt-1">Beton & Demir (Global Hesap)</div>
                        </div>
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">İnce İşler Maliyeti</div>
                            <div className="text-2xl font-bold text-purple-400">{interiorFitoutCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                            <div className="text-[10px] text-slate-500 mt-1">Daire İçi İmalatlar (Birim Toplamı)</div>
                        </div>
                    </div>
                 </section>
                 
                 {/* 2. SECTION: PROJECT COST DETAILS */}
                 <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-file-invoice-dollar text-green-500"></i> Proje Maliyet Detayları
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Tüm bağımsız bölümler ve genel yapı maliyetlerinin toplam dökümü (Reçete)</p>
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
                                    <div className="p-4 space-y-3 bg-slate-900/30 animate-fadeIn">
                                        {category.items.map((item) => (
                                            <div key={item.name} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2 last:border-0 last:pb-0 gap-4">
                                                <span className="text-slate-300">{item.name}</span>
                                                <span className="font-mono text-slate-200">{item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                 </section>

                 {/* 3. SECTION: UNIT TYPES */}
                 <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><i className="fas fa-layer-group text-purple-500"></i> Bağımsız Bölüm Tipleri</h2>
                        <button onClick={handleAddUnit} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm"><i className="fas fa-plus"></i> Yeni Tip Ekle</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {units.map(unit => (
                            <div key={unit.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-600 transition group relative">
                                <div className="h-40 bg-slate-900 relative flex items-center justify-center border-b border-slate-700">
                                    {unit.imageData ? <img src={unit.imageData} className="w-full h-full object-cover opacity-60"/> : <i className="fas fa-drafting-compass text-4xl text-slate-600"></i>}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                                        <button onClick={() => handleEditUnit(unit.id)} className="bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-sm">Planı Düzenle</button>
                                        <button onClick={() => handleDeleteUnit(unit.id)} className="bg-red-600 text-white w-10 h-10 rounded-full"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="font-bold text-white mb-2">{unit.name}</div>
                                    <div className="text-xs text-slate-400">Adet: {unit.count}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </section>
            </main>

            {/* Structure Modal */}
            {showStructureModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-white font-bold text-lg"><i className="fas fa-hammer mr-2 text-yellow-500"></i>Kaba Yapı Parametreleri</h3>
                            <button onClick={() => setShowStructureModal(false)} className="text-slate-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
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
                            <button onClick={() => setShowStructureModal(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Building Info Modal */}
            {showBuildingModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-white font-bold text-lg"><i className="fas fa-building mr-2 text-blue-500"></i>Yapı Parametreleri</h3>
                            <button onClick={() => setShowBuildingModal(false)} className="text-slate-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
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
                            <button onClick={() => setShowBuildingModal(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Tamam</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- RENDER: EDITOR VIEW ---
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
                <h2 className="font-bold text-white text-sm">{units.find(u => u.id === activeUnitId)?.name} <span className="text-slate-500 font-normal">Plan Düzenleyicisi</span></h2>
            </div>
             <div className="bg-slate-800 px-3 py-1 rounded text-xs border border-slate-700">
                <span className="text-slate-400 mr-2">Kat Tipi:</span>
                <span className="font-bold text-blue-400 uppercase">
                    {units.find(u => u.id === activeUnitId)?.floorType === 'ground' ? 'Zemin Kat' : 
                     units.find(u => u.id === activeUnitId)?.floorType === 'basement' ? 'Bodrum Kat' : 'Normal Kat'}
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
                <button onClick={() => { setMode('draw'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Oda Çiz"><i className="fas fa-vector-square"></i></button>
                <button onClick={() => { setMode('draw_wall'); setDrawingWallStart(null); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_wall' ? 'bg-yellow-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Duvar Çiz"><i className="fas fa-minus"></i></button>
                <button onClick={() => { setMode('draw_column'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_column' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Kolon/Perde"><i className="fas fa-square"></i></button>
                <button onClick={() => { setMode('draw_beam'); setDrawingWallStart(null); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_beam' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Kiriş"><i className="fas fa-grip-lines"></i></button>
                <button onClick={() => setMode('magic')} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'magic' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Sihirli Değnek"><i className="fas fa-wand-magic-sparkles"></i></button>
                <button onClick={() => { setMode('calibrate'); setCalibrationPoints([]); }} disabled={!editorImage} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'calibrate' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Kalibre Et"><i className="fas fa-ruler-combined"></i></button>
             </div>

             <div className="p-4 flex flex-col gap-3 border-b border-slate-800">
                <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-xs font-bold text-center cursor-pointer border border-slate-700 transition">
                    <i className="fas fa-file-image mr-2"></i>Plan Görseli Yükle
                    <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                </label>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {/* Rooms List */}
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

                {/* Structure List */}
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 px-2 flex justify-between items-center border-t border-slate-800 pt-2">
                    <span>Yapısal</span>
                    <span className="text-[9px] bg-slate-800 px-1 rounded">{editorWalls.length + editorColumns.length + editorBeams.length}</span>
                </div>
                <div className="space-y-1">
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
                    onMouseMove={(e) => setCursorPos(getCanvasCoordinates(e))}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}
                    className={`shadow-2xl border border-slate-700 ${mode === 'calibrate' ? 'cursor-crosshair' : mode.startsWith('draw') ? 'cursor-cell' : mode === 'magic' ? 'cursor-crosshair' : 'cursor-default'}`}
                />
            </div>
        </div>

        {/* Right Cost Panel */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl">
            <div className="p-3 bg-slate-900 border-b border-slate-800 shadow-lg z-10">
                <h2 className="font-bold text-white text-xs flex items-center gap-2"><i className="fas fa-calculator text-blue-500"></i> Daire İçi Maliyet</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                {/* Manual Structure Summary */}
                <div className="border border-slate-700 rounded bg-slate-800/30">
                    <div className="bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700">Yapısal Elemanlar (Kaba)</div>
                    <div className="p-2 space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-400"><span>Kolon Hacim (C30)</span><span className="text-white font-mono">{editorStats?.column_concrete_volume?.toFixed(2)} m3</span></div>
                        <div className="flex justify-between text-[10px] text-slate-400"><span>Kolon Kalıp</span><span className="text-white font-mono">{editorStats?.column_formwork_area?.toFixed(2)} m2</span></div>
                        <div className="h-px bg-slate-700/50 my-1"></div>
                        <div className="flex justify-between text-[10px] text-slate-400"><span>Kiriş Hacim (C30)</span><span className="text-white font-mono">{editorStats?.beam_concrete_volume?.toFixed(2)} m3</span></div>
                        <div className="flex justify-between text-[10px] text-slate-400"><span>Kiriş Kalıp</span><span className="text-white font-mono">{editorStats?.beam_formwork_area?.toFixed(2)} m2</span></div>
                    </div>
                </div>

                {costs.map((category) => {
                    if (category.id === 'kaba_insaat') return null;
                    return (
                        <div key={category.id} className="border border-slate-700 rounded bg-slate-800/30">
                            <div className="bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700">{category.title}</div>
                            <div className="p-2 space-y-1">
                                {category.items.map((item) => (
                                    <div key={item.name} className="flex flex-col text-[10px] border-b border-slate-700/50 pb-1 last:border-0">
                                        <div className="flex justify-between items-center mb-0.5"><span className="text-slate-300">{item.name}</span></div>
                                        <div className="flex items-center gap-1 justify-end">
                                            <span className="font-mono text-slate-400">{editorQuantities[item.name]?.toLocaleString() || 0}</span>
                                            <span className="text-[9px] text-slate-500 w-6">{item.unit}</span>
                                            <span className="text-[9px] text-slate-600">x</span>
                                            <span className="font-bold text-green-400">{((editorQuantities[item.name] || 0) * item.unit_price).toLocaleString('tr-TR', {maximumFractionDigits: 0})}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* --- Calibration Modal --- */}
      {modalType === 'calibrationInput' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl w-80 text-center">
                <h3 className="text-white font-bold text-lg mb-2">Ölçü Giriniz</h3>
                <form onSubmit={(e) => { e.preventDefault(); handleCalibrationSubmit(parseFloat((e.target as any).dist.value)); }}>
                    <input name="dist" type="number" step="0.01" autoFocus placeholder="metre" className="w-full bg-slate-800 border border-slate-600 text-white rounded p-2 mb-4 text-center text-lg focus:border-pink-500 outline-none" />
                    <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded hover:bg-pink-500">Tamamla</button>
                </form>
            </div>
        </div>
      )}
      
      {/* --- Wall Properties Modal --- */}
      {modalType === 'wallParams' && selectedWall && (
          <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg">Duvar Özellikleri</h3>
                    <button onClick={deleteWall} className="text-red-500 text-xs"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Duvar Malzemesi</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                            value={selectedWall.properties.material}
                            onChange={(e) => handleWallUpdate({ material: e.target.value as any })}
                        >
                            <option value="gazbeton">Gazbeton (Ytong)</option>
                            <option value="tugla">Tuğla</option>
                            <option value="briket">Briket</option>
                            <option value="alcipan">Alçıpan</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Duvar Kalınlığı (cm)</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                            value={selectedWall.properties.thickness}
                            onChange={(e) => handleWallUpdate({ thickness: parseFloat(e.target.value) })}
                        >
                            <option value={10}>10 cm</option>
                            <option value={13.5}>13.5 cm</option>
                            <option value={20}>20 cm</option>
                            <option value={25}>25 cm</option>
                        </select>
                    </div>
                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                            <input 
                                type="checkbox" 
                                checked={selectedWall.properties.isUnderBeam} 
                                onChange={(e) => handleWallUpdate({ isUnderBeam: e.target.checked })} 
                                className="w-5 h-5 accent-yellow-500" 
                            />
                            <span className="text-sm font-medium text-white">Kiriş Altı Duvar</span>
                        </label>
                        {selectedWall.properties.isUnderBeam && (
                            <div className="animate-fadeIn">
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Kiriş Sarkması (cm)</label>
                                <input 
                                    type="number" 
                                    value={selectedWall.properties.beamHeight} 
                                    onChange={(e) => handleWallUpdate({ beamHeight: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" 
                                    placeholder="50"
                                />
                                <p className="text-[9px] text-slate-500 mt-1">*Bu değer kat yüksekliğinden düşülür.</p>
                            </div>
                        )}
                    </div>
                    <div className="pt-2 text-center text-xs text-slate-400 font-mono">
                         Uzunluk: {editorScale > 0 ? (selectedWall.length_px / editorScale).toFixed(2) : '?'} m
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={handleCancelEdit} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
          </div>
      )}

      {/* --- Column Properties Modal --- */}
      {modalType === 'columnParams' && selectedColumn && (
          <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-fadeIn">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-square mr-2 text-red-500"></i>Kolon/Perde Detay</h3>
                    <button onClick={deleteColumn} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-red-900/10 p-3 rounded border border-red-900/30 text-[10px] text-red-200">
                        <i className="fas fa-info-circle mr-1"></i>
                        Çevre: {(editorScale > 0 ? (selectedColumn.perimeter_px/editorScale).toFixed(2) : 0)}m | 
                        Alan: {(editorScale > 0 ? (selectedColumn.area_px/(editorScale**2)).toFixed(2) : 0)}m2
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Eleman Tipi</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-red-500"
                            value={selectedColumn.properties.type}
                            onChange={(e) => handleColumnUpdate({ type: e.target.value as any })}
                        >
                            <option value="kolon">Kolon</option>
                            <option value="perde">Perde Duvar</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Eleman Yüksekliği (m)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={selectedColumn.properties.height} 
                            onChange={(e) => handleColumnUpdate({ height: parseFloat(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono" 
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Kiriş Yüksekliği (Düşümü) (cm)</label>
                        <input 
                            type="number" 
                            value={selectedColumn.properties.connectingBeamHeight} 
                            onChange={(e) => handleColumnUpdate({ connectingBeamHeight: parseFloat(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono" 
                            placeholder="Örn: 50"
                        />
                        <p className="text-[9px] text-slate-500 mt-1">Beton döküm yüksekliği hesabı için kullanılır.</p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={handleCancelEdit} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={handleSaveEdit} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
          </div>
      )}

      {/* --- Beam Properties Modal --- */}
      {modalType === 'beamParams' && selectedBeam && (
          <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-fadeIn">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-grip-lines mr-2 text-blue-500"></i>Kiriş Detay</h3>
                    <button onClick={deleteBeam} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-900/10 p-3 rounded border border-blue-900/30 text-[10px] text-blue-200 text-center">
                        Uzunluk: {(editorScale > 0 ? (selectedBeam.length_px/editorScale).toFixed(2) : 0)} m
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Genişlik (cm)</label>
                            <input 
                                type="number" 
                                value={selectedBeam.properties.width} 
                                onChange={(e) => handleBeamUpdate({ width: parseFloat(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono text-center" 
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Yükseklik (cm)</label>
                            <input 
                                type="number" 
                                value={selectedBeam.properties.height} 
                                onChange={(e) => handleBeamUpdate({ height: parseFloat(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono text-center" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Döşeme Kalınlığı (cm)</label>
                        <input 
                            type="number" 
                            value={selectedBeam.properties.slabThickness} 
                            onChange={(e) => handleBeamUpdate({ slabThickness: parseFloat(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono" 
                            placeholder="Örn: 15"
                        />
                        <p className="text-[9px] text-slate-500 mt-1">Kalıp metrajında yan yüzeyden düşülür.</p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={handleCancelEdit} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
          </div>
      )}

      {/* --- Room Modal --- */}
      {modalType === 'roomParams' && selectedRoom && (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-edit mr-2 text-blue-500"></i>Oda Özellikleri</h3>
                    <button onClick={deleteRoom} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* Section 1: Identity & Geometry */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Oda İsmi</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none transition"
                                value={selectedRoom.name}
                                onChange={(e) => handleRoomUpdate({}, undefined, e.target.value)}
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800 p-3 rounded border border-slate-700 relative">
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Alan (m²)</label>
                                {selectedRoom.points.length > 0 ? (
                                    <span className="text-xl font-mono font-bold text-blue-400">
                                        {(editorScale > 0 ? (selectedRoom.area_px / (editorScale * editorScale)) : 0).toFixed(2)}
                                    </span>
                                ) : (
                                    <input 
                                        type="number" 
                                        className="w-full bg-transparent text-xl font-mono font-bold text-blue-400 outline-none border-b border-blue-900 focus:border-blue-500"
                                        value={selectedRoom.manualAreaM2}
                                        onChange={(e) => {
                                            const newArea = parseFloat(e.target.value) || 0;
                                            const calculatedPerimeter = newArea > 0 ? parseFloat((14 * Math.sqrt(newArea / 12)).toFixed(2)) : 0;
                                            handleRoomUpdate({}, undefined, undefined, {
                                                area: newArea,
                                                perimeter: calculatedPerimeter
                                            });
                                        }}
                                    />
                                )}
                                {selectedRoom.points.length === 0 && <span className="absolute top-2 right-2 text-[10px] text-green-500">MANUEL</span>}
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700 relative">
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Çevre (mt)</label>
                                {selectedRoom.points.length > 0 ? (
                                    <span className="text-xl font-mono font-bold text-purple-400">
                                        {(editorScale > 0 ? (selectedRoom.perimeter_px / editorScale) : 0).toFixed(2)}
                                    </span>
                                ) : (
                                    <input 
                                        type="number" 
                                        className="w-full bg-transparent text-xl font-mono font-bold text-purple-400 outline-none border-b border-purple-900 focus:border-purple-500"
                                        value={selectedRoom.manualPerimeterM}
                                        onChange={(e) => {
                                            const newPerimeter = parseFloat(e.target.value) || 0;
                                            handleRoomUpdate({}, undefined, undefined, {
                                                area: selectedRoom.manualAreaM2!,
                                                perimeter: newPerimeter
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-700"></div>

                    {/* Section 2: Type Selection (Auto-fill) */}
                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Oda Tipi (Otomatik Malzeme Seçimi)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                {id: 'living', label: 'Salon / Oda', icon: 'fa-couch', color: 'orange'},
                                {id: 'wet', label: 'Banyo / Mutfak', icon: 'fa-bath', color: 'blue'},
                                {id: 'balcony', label: 'Balkon / Teras', icon: 'fa-sun', color: 'green'},
                                {id: 'other', label: 'Otopark / Depo', icon: 'fa-warehouse', color: 'gray'},
                            ].map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => handleRoomUpdate({}, t.id as RoomType)}
                                    className={`p-3 rounded border text-left flex items-center gap-3 transition ${selectedRoom.type === t.id ? `bg-${t.color}-900/30 border-${t.color}-500 text-white` : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <i className={`fas ${t.icon} text-xl w-6 text-center`}></i>
                                    <span className="text-sm font-bold">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-slate-700"></div>

                    {/* Section 3: Structural & Openings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Tavan Yüksekliği (m)</label>
                             <input type="number" step="0.1" value={selectedRoom.properties.ceilingHeight} onChange={(e) => handleRoomUpdate({ ceilingHeight: parseFloat(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                             <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Pencere Alanı (m²)</label>
                             <input type="number" step="0.1" value={selectedRoom.properties.windowArea} onChange={(e) => handleRoomUpdate({ windowArea: parseFloat(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" placeholder="Duvar düşümü için" />
                        </div>
                        <div>
                             <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Kapı Sayısı (Adet)</label>
                             <input type="number" value={selectedRoom.properties.doorCount} onChange={(e) => handleRoomUpdate({ doorCount: parseInt(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div className="flex items-center">
                             <label className="flex items-center gap-3 cursor-pointer p-2 bg-slate-800 border border-slate-600 rounded w-full hover:bg-slate-700 transition">
                                <input type="checkbox" checked={selectedRoom.properties.hasCornice} onChange={(e) => handleRoomUpdate({ hasCornice: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                                <span className="text-sm font-medium text-white">Kartonpiyer Ekle</span>
                             </label>
                        </div>
                    </div>

                    {/* Section 4: Materials Selection */}
                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Malzeme Seçimi</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Zemin Kaplaması</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    value={selectedRoom.properties.floorType}
                                    onChange={(e) => handleRoomUpdate({ floorType: e.target.value as any })}
                                >
                                    <option value="parke">Laminat Parke</option>
                                    <option value="seramik">Seramik / Fayans</option>
                                    <option value="beton">Brüt Beton / Şap</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Duvar Kaplaması (Boya/Seramik)</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    value={selectedRoom.properties.wallFinish}
                                    onChange={(e) => handleRoomUpdate({ wallFinish: e.target.value as any })}
                                >
                                    <option value="boya">Saten Boya</option>
                                    <option value="seramik">Duvar Seramiği</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={handleCancelEdit} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-3 rounded-lg font-bold transition border border-slate-700">
                        <i className="fas fa-times mr-2"></i>Değiştirmeden Çık
                    </button>
                    <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition shadow-lg">
                        <i className="fas fa-check mr-2"></i>Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);