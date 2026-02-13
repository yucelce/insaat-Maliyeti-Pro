import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { COST_DATA } from './cost_data';

// --- Types ---
type Point = { x: number; y: number };
type RoomType = 'living' | 'wet' | 'balcony' | 'other' | null;

interface RoomProperties {
  ceilingHeight: number;
  windowArea: number; 
  doorCount: number; 
  hasCornice: boolean;
  floorType: 'parke' | 'seramik' | 'beton' | 'unknown';
  wallType: 'boya' | 'seramik' | 'unknown';
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

// New: Defines a type of independent unit (e.g., "2+1 Type A")
interface UnitType {
    id: string;
    name: string;
    count: number; // Quantity of this unit in the project
    rooms: Room[];
    imageData: string | null; // Base64 of the plan
    scale: number; // px per meter
    lastEdited: number;
}

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

// --- Cost Calculator Function (Pure Logic) ---
const calculateUnitCost = (unit: UnitType) => {
    let quantities: Record<string, number> = {};
    let totalCost = 0;

    let stats = {
      total_area: 0, total_perimeter: 0, wet_area: 0, dry_area: 0, dry_perimeter: 0, net_wall_area: 0, cornice_length: 0
    };

    unit.rooms.forEach(room => {
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
      const grossWallArea = perimeterM * room.properties.ceilingHeight;
      const netWall = Math.max(0, grossWallArea - room.properties.windowArea - doorAreaDedudction);
      
      if (room.properties.wallType === 'boya') {
         stats.net_wall_area += netWall;
      }
      if (room.properties.hasCornice) {
        stats.cornice_length += perimeterM;
      }
    });

    COST_DATA.forEach(cat => {
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
  // --- Global State (Project Level) ---
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [units, setUnits] = useState<UnitType[]>([
      { id: '1', name: 'Tip A (2+1)', count: 5, rooms: [], imageData: null, scale: 0, lastEdited: Date.now() }
  ]);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

  // --- Editor State (Active Unit Level) ---
  // These are temporary states while editing. They get saved to 'units' on exit.
  const [editorImage, setEditorImage] = useState<HTMLImageElement | null>(null);
  const [editorRooms, setEditorRooms] = useState<Room[]>([]);
  const [editorScale, setEditorScale] = useState<number>(0);
  
  const [zoom, setZoom] = useState<number>(1);
  const [mode, setMode] = useState<'view' | 'calibrate' | 'draw' | 'magic' | 'select'>('view');
  
  // Interaction State
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // Data State for Cost Panel in Editor
  const [editorQuantities, setEditorQuantities] = useState<Record<string, number>>({});
  
  // Modals
  const [modalType, setModalType] = useState<'roomParams' | 'calibrationInput' | null>(null);
  const [tempCalibrationDist, setTempCalibrationDist] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Dashboard Logic ---
  const handleAddUnit = () => {
      const newUnit: UnitType = {
          id: Date.now().toString(),
          name: `Yeni Tip ${units.length + 1}`,
          count: 1,
          rooms: [],
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
      setEditorRooms(unit.rooms); // Load rooms
      setEditorScale(unit.scale); // Load scale
      
      // Load Image
      if (unit.imageData) {
          const img = new Image();
          img.onload = () => {
              setEditorImage(img);
              if (canvasRef.current) {
                canvasRef.current.width = img.width;
                canvasRef.current.height = img.height;
              }
              // Reset view
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
      if (confirm('Bu bağımsız bölüm tipini ve tüm çizimlerini silmek istediğinize emin misiniz?')) {
          setUnits(units.filter(u => u.id !== id));
      }
  };

  const handleUpdateUnitCount = (id: string, newCount: number) => {
      setUnits(units.map(u => u.id === id ? { ...u, count: Math.max(1, newCount) } : u));
  };

  const handleUpdateUnitName = (id: string, newName: string) => {
      setUnits(units.map(u => u.id === id ? { ...u, name: newName } : u));
  };

  const saveAndExitEditor = () => {
      if (activeUnitId) {
          setUnits(units.map(u => u.id === activeUnitId ? {
              ...u,
              rooms: editorRooms,
              scale: editorScale,
              imageData: editorImage ? editorImage.src : null, // Save base64 source
              lastEdited: Date.now()
          } : u));
      }
      setView('dashboard');
      setActiveUnitId(null);
  };

  // --- Editor Logic: Cost Calculation (Live) ---
  useEffect(() => {
    if (view !== 'editor') return;
    
    // Create a temporary unit object to use the helper function
    const tempUnit: UnitType = {
        id: 'temp', name: 'temp', count: 1, 
        rooms: editorRooms, imageData: null, scale: editorScale, lastEdited: 0
    };
    const { quantities } = calculateUnitCost(tempUnit);
    setEditorQuantities(quantities);

  }, [editorRooms, editorScale, view]);

  // --- Canvas Rendering (Only in Editor) ---
  useEffect(() => {
    if (view !== 'editor') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (editorImage) ctx.drawImage(editorImage, 0, 0);

    // Draw Rooms
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

      // Label
      if (editorScale > 0 && room.type) {
        const cx = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
        const cy = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;
        const area = (room.area_px / (editorScale * editorScale)).toFixed(1);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(cx - 30, cy - 12, 60, 24);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${room.name}`, cx, cy);
      }
    });

    if (mode === 'draw' && drawingPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
      for (let i = 1; i < drawingPoints.length; i++) ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
      if (cursorPos) ctx.lineTo(cursorPos.x, cursorPos.y);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
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
  }, [editorImage, editorRooms, drawingPoints, calibrationPoints, cursorPos, mode, selectedRoomId, editorScale, view]);

  // --- Editor Handlers ---
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
    else if (mode === 'draw') {
      if (drawingPoints.length > 2 && Math.hypot(x - drawingPoints[0].x, y - drawingPoints[0].y) < 20) {
        finishPolygon();
      } else {
        setDrawingPoints([...drawingPoints, { x, y }]);
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
      const clickedRoom = editorRooms.find(r => r.points.length > 0 && isPointInPolygon({ x, y }, r.points));
      if (clickedRoom) {
        setSelectedRoomId(clickedRoom.id);
        setModalType('roomParams');
      } else {
        setSelectedRoomId(null);
      }
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
      properties: {
        ceilingHeight: 2.8,
        windowArea: 0,
        doorCount: 1,
        hasCornice: true,
        floorType: 'unknown',
        wallType: 'boya'
      }
    };
    setEditorRooms([...editorRooms, newRoom]);
    setDrawingPoints([]);
    setMode('select');
    setSelectedRoomId(newRoom.id);
    setModalType('roomParams');
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
        manualPerimeterM: 16,
        type: 'living',
        properties: {
            ceilingHeight: 2.8,
            windowArea: 2,
            doorCount: 1,
            hasCornice: true,
            floorType: 'parke',
            wallType: 'boya'
        }
    };
    setEditorRooms([...editorRooms, newRoom]);
    setSelectedRoomId(newRoom.id);
    setModalType('roomParams');
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
            if (type === 'living') {
                newProps.floorType = 'parke';
                newProps.wallType = 'boya';
            } else if (type === 'wet') {
                newProps.floorType = 'seramik';
                newProps.wallType = 'seramik';
                newProps.hasCornice = false;
            } else if (type === 'balcony') {
                newProps.floorType = 'seramik';
                newProps.wallType = 'boya';
                newProps.hasCornice = false;
            } else if (type === 'other') {
                newProps.floorType = 'beton';
                newProps.wallType = 'boya';
            }
        }

        return {
            ...r,
            name: name || r.name,
            type: newType,
            manualAreaM2: manualStats ? manualStats.area : r.manualAreaM2,
            manualPerimeterM: manualStats ? manualStats.perimeter : r.manualPerimeterM,
            properties: newProps
        };
    }));
  };

  const deleteRoom = () => {
    if (selectedRoomId) {
      setEditorRooms(editorRooms.filter(r => r.id !== selectedRoomId));
      setSelectedRoomId(null);
      setModalType(null);
    }
  };

  // --- Export Logic ---
  const exportProjectCSV = () => {
    let csv = "\uFEFF";
    csv += `PROJE GENEL MALİYET RAPORU\n\n`;
    
    // Aggregation
    let projectTotal = 0;
    let globalQuantities: Record<string, number> = {};

    units.forEach(unit => {
        const { quantities, totalCost } = calculateUnitCost(unit);
        projectTotal += totalCost * unit.count;
        
        Object.entries(quantities).forEach(([key, val]) => {
            if (!globalQuantities[key]) globalQuantities[key] = 0;
            globalQuantities[key] += val * unit.count;
        });
    });

    csv += "Kategori;Kalem;Toplam Miktar;Birim;Birim Fiyat;Toplam Tutar\n";
    
    COST_DATA.forEach(cat => {
      cat.items.forEach(item => {
        const qty = globalQuantities[item.name] || 0;
        const total = qty * item.unit_price;
        csv += `${cat.title};"${item.name}";${qty.toLocaleString('tr-TR')};${item.unit};${item.unit_price};${total.toLocaleString('tr-TR')}\n`;
      });
    });
    
    csv += `;;;GENEL TOPLAM;;${projectTotal.toLocaleString('tr-TR')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "proje_ozeti.csv";
    link.click();
  };

  // --- Calculate Project Totals for Display ---
  const projectTotalCost = useMemo(() => {
      let total = 0;
      units.forEach(u => {
          total += calculateUnitCost(u).totalCost * u.count;
      });
      return total;
  }, [units]);

  const selectedRoom = editorRooms.find(r => r.id === selectedRoomId);

  // --- RENDER: DASHBOARD VIEW ---
  if (view === 'dashboard') {
      return (
        <div className="flex h-screen flex-col bg-slate-900 font-sans text-slate-200 overflow-y-auto">
            <header className="bg-slate-950 border-b border-slate-800 p-6 shadow-md z-10 sticky top-0">
                <div className="flex justify-between items-center max-w-6xl mx-auto">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                            <i className="fas fa-city"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white leading-tight">ProMetraj <span className="text-blue-400">Manager</span></h1>
                            <p className="text-sm text-slate-400">Çoklu Bağımsız Bölüm & Maliyet Yönetimi</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-400 uppercase font-bold tracking-wider">Toplam Proje Maliyeti</div>
                        <div className="text-3xl font-bold text-green-500">{projectTotalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-6xl mx-auto w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Bağımsız Bölüm Tipleri</h2>
                    <div className="flex gap-3">
                         <button onClick={exportProjectCSV} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-700 transition flex items-center gap-2">
                            <i className="fas fa-file-csv"></i> Rapor Al
                        </button>
                        <button onClick={handleAddUnit} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/20">
                            <i className="fas fa-plus"></i> Yeni Tip Ekle
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {units.map(unit => {
                        const unitCost = calculateUnitCost(unit).totalCost;
                        const totalArea = calculateUnitCost(unit).stats.total_area;
                        
                        return (
                            <div key={unit.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-600 transition group relative">
                                <div className="h-40 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                                    {unit.imageData ? (
                                        <img src={unit.imageData} alt={unit.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition" />
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-600">
                                            <i className="fas fa-drafting-compass text-4xl mb-2"></i>
                                            <span className="text-sm">Plan Yok</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs text-white">
                                        {unit.rooms.length} Oda
                                    </div>
                                    {/* Action Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                        <button onClick={() => handleEditUnit(unit.id)} className="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition" title="Planı Düzenle">
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button onClick={() => handleDeleteUnit(unit.id)} className="bg-red-600 hover:bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition" title="Sil">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-4">
                                    <div className="mb-4">
                                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Tip Adı</label>
                                        <input 
                                            type="text" 
                                            value={unit.name} 
                                            onChange={(e) => handleUpdateUnitName(unit.id, e.target.value)} 
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    
                                    <div className="flex gap-3 mb-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Adet</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={unit.count} 
                                                onChange={(e) => handleUpdateUnitCount(unit.id, parseInt(e.target.value) || 1)} 
                                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-center focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Birim m²</label>
                                            <div className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-slate-300 font-mono text-center">
                                                {totalArea.toFixed(0)} m²
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-700">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-slate-400">Birim Maliyet</span>
                                            <span className="text-sm font-bold text-slate-200">{unitCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400">Tip Toplamı</span>
                                            <span className="text-lg font-bold text-green-400">{(unitCost * unit.count).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Empty State Add Button */}
                    <button onClick={handleAddUnit} className="border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/30 transition h-[360px] gap-4">
                        <i className="fas fa-plus-circle text-5xl"></i>
                        <span className="font-bold">Yeni Bağımsız Bölüm Ekle</span>
                    </button>
                </div>
            </main>
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
        <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-4 z-20 shadow-xl overflow-y-auto scrollbar-hide">
            <label className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center cursor-pointer transition text-blue-400 tooltip-container group" title="Plan Yükle / Değiştir">
                <i className="fas fa-file-image text-lg"></i>
                <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
            </label>

            <div className="w-8 h-px bg-slate-800"></div>

            <button onClick={() => setMode('view')} className={`w-10 h-10 rounded flex items-center justify-center transition ${mode === 'view' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Gezinme">
                <i className="fas fa-arrows-alt"></i>
            </button>

            <button onClick={() => { setMode('calibrate'); setCalibrationPoints([]); }} disabled={!editorImage} className={`w-10 h-10 rounded flex items-center justify-center transition disabled:opacity-30 ${mode === 'calibrate' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Kalibre Et">
                <i className="fas fa-ruler-combined"></i>
            </button>

            <button onClick={() => { setMode('draw'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`w-10 h-10 rounded flex items-center justify-center transition disabled:opacity-30 ${mode === 'draw' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Çiz">
                <i className="fas fa-pen-nib"></i>
            </button>

            <button onClick={() => setMode('magic')} disabled={!editorImage || editorScale === 0} className={`w-10 h-10 rounded flex items-center justify-center transition disabled:opacity-30 ${mode === 'magic' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Sihirli Değnek">
                <i className="fas fa-wand-magic-sparkles"></i>
            </button>
            
            <div className="w-8 h-px bg-slate-800"></div>
            
            <button onClick={addManualRoom} className="w-10 h-10 rounded flex items-center justify-center bg-slate-800 hover:bg-green-600 text-green-500 hover:text-white transition" title="Manuel Oda Ekle">
                <i className="fas fa-plus-square"></i>
            </button>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col">
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-slate-800/90 p-1 rounded border border-slate-700 shadow-xl backdrop-blur">
                <button onClick={() => setZoom(z => Math.min(z + 0.2, 5))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-600 rounded"><i className="fas fa-plus"></i></button>
                <span className="text-center text-xs text-slate-400 font-mono select-none">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.2))} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-600 rounded"><i className="fas fa-minus"></i></button>
            </div>

            <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-center p-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                {!editorImage ? (
                    <div className="flex flex-col items-center justify-center text-slate-600 p-10 border-2 border-dashed border-slate-800 rounded-xl">
                        <i className="fas fa-cloud-upload-alt text-6xl mb-4 opacity-50"></i>
                        <p className="text-lg font-medium">Kat Planı Yükleyin</p>
                        <p className="text-sm mt-2">Bu tip için plan görseli yüklemek üzere sol menüyü kullanın.</p>
                    </div>
                ) : (
                    <canvas 
                        ref={canvasRef} 
                        onMouseDown={handleMouseDown}
                        onMouseMove={(e) => setCursorPos(getCanvasCoordinates(e))}
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}
                        className={`shadow-2xl border border-slate-700 ${mode === 'calibrate' ? 'cursor-crosshair' : mode === 'draw' ? 'cursor-cell' : mode === 'magic' ? 'cursor-crosshair' : 'cursor-default'}`}
                    />
                )}
            </div>
        </div>

        {/* Right Cost Panel (Specific to Unit Type) */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl">
            <div className="p-3 bg-slate-900 border-b border-slate-800 shadow-lg z-10">
                <h2 className="font-bold text-white text-xs flex items-center gap-2">
                    <i className="fas fa-calculator text-blue-500"></i> Birim Maliyet (1 Adet)
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                {COST_DATA.map((category) => (
                    <div key={category.id} className="border border-slate-700 rounded bg-slate-800/30">
                        <div className="bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700">
                            {category.title}
                        </div>
                        <div className="p-2 space-y-1">
                            {category.items.map((item) => (
                                <div key={item.name} className="flex flex-col text-[10px] border-b border-slate-700/50 pb-1 last:border-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-slate-300">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 justify-end">
                                        <span className="font-mono text-slate-400">{editorQuantities[item.name]?.toLocaleString() || 0}</span>
                                        <span className="text-[9px] text-slate-500 w-6">{item.unit}</span>
                                        <span className="text-[9px] text-slate-600">x</span>
                                        <span className="font-bold text-green-400">
                                            {((editorQuantities[item.name] || 0) * item.unit_price).toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
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

      {/* --- Detailed Room Properties Modal --- */}
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
                                        onChange={(e) => handleRoomUpdate({}, undefined, undefined, {area: parseFloat(e.target.value), perimeter: selectedRoom.manualPerimeterM!})}
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
                                        onChange={(e) => handleRoomUpdate({}, undefined, undefined, {area: selectedRoom.manualAreaM2!, perimeter: parseFloat(e.target.value)})}
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

                    {/* Section 4: Materials Info (Read Only or Editable) */}
                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Seçili Malzemeler</h4>
                        <div className="flex justify-between text-sm text-slate-300">
                            <span>Zemin: <strong className="text-white capitalize">{selectedRoom.properties.floorType}</strong></span>
                            <span>Duvar: <strong className="text-white capitalize">{selectedRoom.properties.wallType}</strong></span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl">
                    <button onClick={() => {setModalType(null); setSelectedRoomId(null);}} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition shadow-lg">
                        Kaydet ve Kapat
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