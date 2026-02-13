export type Point = { x: number; y: number };
export type RoomType = 'living' | 'wet' | 'balcony' | 'other' | null;
export type WallMaterial = 'gazbeton' | 'tugla' | 'briket' | 'alcipan';
export type UnitFloorType = 'normal' | 'ground' | 'basement';

export interface RoomProperties {
  ceilingHeight: number;
  windowArea: number; 
  doorCount: number; 
  hasCornice: boolean;
  floorType: 'parke' | 'seramik' | 'beton' | 'unknown';
  wallFinish: 'boya' | 'seramik' | 'unknown'; 
}

export interface WallProperties {
  material: WallMaterial;
  thickness: number; // cm
  isUnderBeam: boolean;
  beamHeight: number; // cm
}

export interface ColumnProperties {
    type: 'kolon' | 'perde';
    height: number;
    connectingBeamHeight: number;
}

export interface BeamProperties {
    width: number; // cm
    height: number; // cm
    slabThickness: number; // cm
}

export type Room = {
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

export type Wall = {
  id: string;
  startPoint: Point;
  endPoint: Point;
  length_px: number;
  manualLengthM?: number; // New: For manual input without drawing
  properties: WallProperties;
};

export type Column = {
    id: string;
    points: Point[];
    area_px: number;
    perimeter_px: number;
    manualAreaM2?: number; // New
    manualPerimeterM?: number; // New
    properties: ColumnProperties;
};

export type Beam = {
    id: string;
    startPoint: Point;
    endPoint: Point;
    length_px: number;
    manualLengthM?: number; // New
    properties: BeamProperties;
};

export interface UnitType {
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
    // New: Toggle source for structural calculations
    structuralSource: 'global_calculated' | 'detailed_unit';
}

export interface BuildingStats {
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