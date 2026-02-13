import React, { useState, useRef, useEffect, useMemo } from 'react';
import { COST_DATA, CostCategory } from '../cost_data';
import { Point, RoomType, WallMaterial, UnitFloorType, RoomProperties, WallProperties, ColumnProperties, BeamProperties, Room, Wall, Column, Beam, UnitType, BuildingStats } from './types';
import { TURKEY_HEAT_MAP } from './constants';
import { getPolygonAreaAndPerimeter, isPointInPolygon, distanceToSegment, floodFillRoom } from './utils/geometry';
import { calculateUnitCost } from './utils/calculations';

// Components
import { BuildingModal } from './components/Modals/BuildingModals';
import { WallModal, RoomModal, ColumnModal, BeamModal, CalibrationModal } from './components/Modals/EditorModals';
import { StructuralManagerModal } from './components/Modals/StructuralManagerModal';
import { RoomManagerModal } from './components/Modals/RoomManagerModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { EditorView } from './components/Editor/EditorView';

export const App = () => {
  // --- Global State ---
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  
  // New State: Editor Scope ('architectural' for Rooms, 'structural' for Walls/Columns/Beams)
  const [editorScope, setEditorScope] = useState<'architectural' | 'structural'>('architectural');

  const [costs, setCosts] = useState<CostCategory[]>(COST_DATA);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. APARTMENT UNITS (Mimari - Daire Tipleri)
  const [units, setUnits] = useState<UnitType[]>([
      { 
          id: 'u1', name: 'Tip A (2+1)', count: 5, rooms: [], walls: [], columns: [], beams: [], 
          floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(), 
          structuralSource: 'global_calculated' 
      }
  ]);

  // 2. STRUCTURAL FLOORS (Statik - Kat Planları)
  const [structuralUnits, setStructuralUnits] = useState<UnitType[]>([
      {
          id: 's1', name: 'Normal Kat Planı', count: 5, rooms: [], walls: [], columns: [], beams: [],
          floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(),
          structuralSource: 'detailed_unit' // Default to detailed for structural plans
      }
  ]);

  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  
  // State for Manager Modals
  const [structuralManagerUnitId, setStructuralManagerUnitId] = useState<string | null>(null);
  const [roomManagerUnitId, setRoomManagerUnitId] = useState<string | null>(null);

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
  const [isFetchingHeat, setIsFetchingHeat] = useState(false);

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

    // Calculate aggregated quantities from all units AND structural floors
    const aggregatedQuantities = new Map<string, number>();
    
    // 1. Process Apartments (Units) - Mostly Architectural & Fitout
    units.forEach(unit => {
        const { quantities } = calculateUnitCost(unit, costs, buildingStats);
        Object.entries(quantities).forEach(([key, val]) => {
            aggregatedQuantities.set(key, (aggregatedQuantities.get(key) || 0) + (val * unit.count));
        });
    });

    // 2. Process Structural Floors - Mostly Concrete, Rebar, Walls
    structuralUnits.forEach(sUnit => {
        const { quantities } = calculateUnitCost(sUnit, costs, buildingStats);
        Object.entries(quantities).forEach(([key, val]) => {
            aggregatedQuantities.set(key, (aggregatedQuantities.get(key) || 0) + (val * sUnit.count));
        });
    });

    costs.forEach(category => {
        let categoryTotal = 0;
        const processedItems = category.items.map(item => {
            let autoQty = 0;

            // Determine Auto Quantity
            if (item.auto_source === 'total_area') {
                autoQty = totalConstructionArea * item.multiplier;
            } else if (item.auto_source !== 'manual') {
                autoQty = aggregatedQuantities.get(item.name) || 0;
            }

            // Decide Final Quantity (Manual overrides Auto)
            const finalQty = item.manualQuantity !== undefined ? item.manualQuantity : autoQty;
            
            // Decide Final Price (Manual overrides Unit Price)
            const finalPrice = item.manualPrice !== undefined ? item.manualPrice : item.unit_price;

            const totalPrice = finalQty * finalPrice;
            categoryTotal += totalPrice;

            return {
                ...item,
                calculatedAutoQty: autoQty,
                finalQty,
                finalPrice,
                totalPrice
            };
        });

        details.push({
            id: category.id,
            title: category.title,
            totalCategoryCost: categoryTotal,
            items: processedItems
        });
        
        if (category.id === 'kaba_insaat') structuralCost += categoryTotal;
        else fitoutCost += categoryTotal;
    });

    return {
        projectCostDetails: details,
        projectTotalCost: structuralCost + fitoutCost,
        globalStructuralCost: structuralCost,
        interiorFitoutCost: fitoutCost
    };
  }, [costs, units, structuralUnits, totalConstructionArea, buildingStats]);

  // --- Fetch Prices ---
  useEffect(() => {
    const fetchPrices = async () => {
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
        }
    };
    fetchPrices();
  }, []);

  // --- Handlers ---
  const handleUpdateCostItem = (catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => {
      setCosts(prevCosts => prevCosts.map(cat => {
          if (cat.id !== catId) return cat;
          return {
              ...cat,
              items: cat.items.map(item => {
                  if (item.name !== itemName) return item;
                  return { ...item, [field]: value };
              })
          };
      }));
  };

  // Add Apartment Unit
  const handleAddUnit = () => {
      const newUnit: UnitType = {
          id: Date.now().toString(),
          name: `Yeni Daire Tip ${units.length + 1}`,
          floorType: 'normal',
          count: 1,
          rooms: [], walls: [], columns: [], beams: [],
          imageData: null, scale: 0, lastEdited: Date.now(),
          structuralSource: 'global_calculated'
      };
      setUnits([...units, newUnit]);
  };

  // Add Structural Floor Plan
  const handleAddStructuralUnit = () => {
      const newSUnit: UnitType = {
          id: 's-' + Date.now().toString(),
          name: `Yeni Kat Planı ${structuralUnits.length + 1}`,
          floorType: 'normal',
          count: 1,
          rooms: [], walls: [], columns: [], beams: [],
          imageData: null, scale: 0, lastEdited: Date.now(),
          structuralSource: 'detailed_unit'
      };
      setStructuralUnits([...structuralUnits, newSUnit]);
  };
  
  const handleUpdateUnitCount = (id: string, count: number, isStructural: boolean) => {
      if (isStructural) {
          setStructuralUnits(structuralUnits.map(u => u.id === id ? { ...u, count: Math.max(0, count) } : u));
      } else {
          setUnits(units.map(u => u.id === id ? { ...u, count: Math.max(0, count) } : u));
      }
  };

  const handleToggleStructuralSource = (id: string) => {
      // Typically used for Structural Plans, but can be for Units too if user wants to draw walls inside units
      const targetIsStructural = structuralUnits.some(u => u.id === id);
      if (targetIsStructural) {
          setStructuralUnits(structuralUnits.map(u => u.id === id ? { 
            ...u, structuralSource: u.structuralSource === 'global_calculated' ? 'detailed_unit' : 'global_calculated' 
        } : u));
      } else {
          setUnits(units.map(u => u.id === id ? { 
            ...u, structuralSource: u.structuralSource === 'global_calculated' ? 'detailed_unit' : 'global_calculated' 
        } : u));
      }
  };

  // Generalized function to open editor
  const openEditor = (id: string, scope: 'architectural' | 'structural') => {
      // Find in both lists
      let unit = units.find(u => u.id === id);
      if (!unit) unit = structuralUnits.find(u => u.id === id);
      
      if (!unit) return;

      setEditorScope(scope);
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

  const handleEditUnitArchitectural = (id: string) => openEditor(id, 'architectural');
  const handleEditUnitStructural = (id: string) => openEditor(id, 'structural');

  const handleDeleteUnit = (id: string, isStructural: boolean) => {
      if (confirm('Silmek istediğinize emin misiniz?')) {
          if (isStructural) {
              setStructuralUnits(structuralUnits.filter(u => u.id !== id));
          } else {
              setUnits(units.filter(u => u.id !== id));
          }
      }
  };

  const saveAndExitEditor = () => {
      if (activeUnitId) {
          const updatedData = {
              rooms: editorRooms,
              walls: editorWalls,
              columns: editorColumns,
              beams: editorBeams,
              scale: editorScale,
              imageData: editorImage ? editorImage.src : null,
              lastEdited: Date.now()
          };

          // Try updating units first
          if (units.some(u => u.id === activeUnitId)) {
             setUnits(units.map(u => u.id === activeUnitId ? { ...u, ...updatedData } : u));
          } 
          // Else update structural units
          else if (structuralUnits.some(u => u.id === activeUnitId)) {
             setStructuralUnits(structuralUnits.map(u => u.id === activeUnitId ? { ...u, ...updatedData } : u));
          }
      }
      setView('dashboard');
      setActiveUnitId(null);
  };
  
  const handleUpdateUnit = (updatedUnit: UnitType) => {
      if (units.some(u => u.id === updatedUnit.id)) {
        setUnits(units.map(u => u.id === updatedUnit.id ? updatedUnit : u));
      } else {
        setStructuralUnits(structuralUnits.map(u => u.id === updatedUnit.id ? updatedUnit : u));
      }
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
    const currentUnit = units.find(u=>u.id===activeUnitId) || structuralUnits.find(u=>u.id===activeUnitId);

    const tempUnit: UnitType = {
        id: 'temp', name: 'temp', count: 1, 
        rooms: editorRooms, walls: editorWalls, columns: editorColumns, beams: editorBeams,
        floorType: currentUnit?.floorType || 'normal',
        imageData: null, scale: editorScale, lastEdited: 0,
        structuralSource: editorScope === 'structural' ? 'detailed_unit' : 'global_calculated' // Temporary for calc
    };
    // Force detailed calculation for immediate feedback in editor if in structural scope
    tempUnit.structuralSource = 'detailed_unit';
    
    const { quantities, stats } = calculateUnitCost(tempUnit, costs, buildingStats);
    setEditorQuantities(quantities);
    setEditorStats(stats);
  }, [editorRooms, editorWalls, editorColumns, editorBeams, editorScale, view, costs, buildingStats, activeUnitId, editorScope, units, structuralUnits]);


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
        // Do not clear rooms/walls/columns. Keep existing data when image changes.
        setEditorScale(editorScale > 0 ? editorScale : 0);
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
      // Logic split by Editor Scope
      if (editorScope === 'structural') {
          // Priority: Column -> Wall -> Beam
          const clickedColumn = editorColumns.find(c => isPointInPolygon({x,y}, c.points));
          if (clickedColumn) { openColumnModal(clickedColumn); return; }

          let clickedWall = null;
          for (const w of editorWalls) if (distanceToSegment({x,y}, w.startPoint, w.endPoint) < 5) { clickedWall = w; break; }
          if (clickedWall) { openWallModal(clickedWall); return; }

          let clickedBeam = null;
          for (const b of editorBeams) if (distanceToSegment({x,y}, b.startPoint, b.endPoint) < 5) { clickedBeam = b; break; }
          if (clickedBeam) { openBeamModal(clickedBeam); return; }
      }
      
      if (editorScope === 'architectural') {
          const clickedRoom = editorRooms.find(r => r.points.length > 0 && isPointInPolygon({ x, y }, r.points));
          if (clickedRoom) { openRoomModal(clickedRoom); return; }
      }
      
      setSelectedRoomId(null); setSelectedWallId(null); setSelectedColumnId(null); setSelectedBeamId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPos(getCanvasCoordinates(e));
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

  const selectedRoom = editorRooms.find(r => r.id === selectedRoomId);
  const selectedWall = editorWalls.find(w => w.id === selectedWallId);
  const selectedColumn = editorColumns.find(c => c.id === selectedColumnId);
  const selectedBeam = editorBeams.find(b => b.id === selectedBeamId);

  return (
    <>
      {view === 'dashboard' ? (
        <DashboardView 
            projectTotalCost={projectTotalCost}
            buildingStats={buildingStats}
            totalConstructionArea={totalConstructionArea}
            globalStructuralCost={globalStructuralCost}
            interiorFitoutCost={interiorFitoutCost}
            projectCostDetails={projectCostDetails}
            units={units}
            structuralUnits={structuralUnits}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            handleAddUnit={handleAddUnit}
            handleAddStructuralUnit={handleAddStructuralUnit}
            handleEditUnit={handleEditUnitArchitectural}
            handleEditUnitStructural={handleEditUnitStructural}
            handleDeleteUnit={handleDeleteUnit}
            setShowBuildingModal={setShowBuildingModal}
            onOpenStructuralManager={(id) => setStructuralManagerUnitId(id)}
            onOpenRoomManager={(id) => setRoomManagerUnitId(id)}
            handleUpdateUnitCount={handleUpdateUnitCount}
            handleToggleStructuralSource={handleToggleStructuralSource}
            handleUpdateCostItem={handleUpdateCostItem}
        />
      ) : (
        <EditorView 
            unit={units.find(u => u.id === activeUnitId) || structuralUnits.find(u => u.id === activeUnitId)}
            editorScale={editorScale}
            editorImage={editorImage}
            saveAndExitEditor={saveAndExitEditor}
            mode={mode}
            setMode={setMode}
            setDrawingPoints={setDrawingPoints}
            setDrawingWallStart={setDrawingWallStart}
            setCalibrationPoints={setCalibrationPoints}
            handleImageUpload={handleImageUpload}
            editorRooms={editorRooms}
            editorWalls={editorWalls}
            editorColumns={editorColumns}
            editorBeams={editorBeams}
            openRoomModal={openRoomModal}
            openWallModal={openWallModal}
            openColumnModal={openColumnModal}
            openBeamModal={openBeamModal}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            selectedColumnId={selectedColumnId}
            selectedBeamId={selectedBeamId}
            zoom={zoom}
            setZoom={setZoom}
            handleMouseDown={handleMouseDown}
            handleMouseMove={handleMouseMove}
            canvasRef={canvasRef}
            containerRef={containerRef}
            costs={costs}
            editorStats={editorStats}
            editorQuantities={editorQuantities}
            drawingPoints={drawingPoints}
            drawingWallStart={drawingWallStart}
            calibrationPoints={calibrationPoints}
            cursorPos={cursorPos}
            editorScope={editorScope}
        />
      )}

      {/* --- MODALS --- */}
      {showBuildingModal && (
          <BuildingModal 
              onClose={() => setShowBuildingModal(false)}
              buildingStats={buildingStats}
              setBuildingStats={setBuildingStats}
              handleProvinceChange={handleProvinceChange}
              handleDistrictChange={handleDistrictChange}
              isFetchingHeat={isFetchingHeat}
          />
      )}
      
      {structuralManagerUnitId && (
        <StructuralManagerModal
            unit={units.find(u => u.id === structuralManagerUnitId) || structuralUnits.find(u => u.id === structuralManagerUnitId)!}
            onClose={() => setStructuralManagerUnitId(null)}
            onUpdateUnit={handleUpdateUnit}
        />
      )}

      {roomManagerUnitId && (
        <RoomManagerModal
            unit={units.find(u => u.id === roomManagerUnitId)!}
            onClose={() => setRoomManagerUnitId(null)}
            onUpdateUnit={handleUpdateUnit}
        />
      )}

      {modalType === 'calibrationInput' && (
          <CalibrationModal onSubmit={handleCalibrationSubmit} />
      )}

      {modalType === 'wallParams' && selectedWall && (
          <WallModal 
            wall={selectedWall}
            scale={editorScale}
            onUpdate={handleWallUpdate}
            onDelete={deleteWall}
            onClose={handleCancelEdit}
            onSave={handleSaveEdit}
          />
      )}

      {modalType === 'columnParams' && selectedColumn && (
          <ColumnModal 
            column={selectedColumn}
            scale={editorScale}
            onUpdate={handleColumnUpdate}
            onDelete={deleteColumn}
            onClose={handleCancelEdit}
            onSave={handleSaveEdit}
          />
      )}

      {modalType === 'beamParams' && selectedBeam && (
          <BeamModal 
            beam={selectedBeam}
            scale={editorScale}
            onUpdate={handleBeamUpdate}
            onDelete={deleteBeam}
            onClose={handleCancelEdit}
            onSave={handleSaveEdit}
          />
      )}

      {modalType === 'roomParams' && selectedRoom && (
          <RoomModal 
            room={selectedRoom}
            scale={editorScale}
            onUpdate={handleRoomUpdate}
            onDelete={deleteRoom}
            onClose={handleCancelEdit}
            onSave={handleSaveEdit}
          />
      )}
    </>
  );
};