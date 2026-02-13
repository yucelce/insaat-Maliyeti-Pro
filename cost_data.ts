export interface CostItem {
  name: string;
  unit: string;
  unit_price: number;
  // Expanded auto_source types for specific materials
  auto_source: 'total_area' | 'total_perimeter' | 'dry_area' | 'wet_area' | 'dry_perimeter' | 'wall_surface_area' | 'net_wall_area' | 'cornice_length' | 'manual' | 'wall_gazbeton_area' | 'wall_tugla_area' | 'wall_briket_area';
  multiplier: number;
  wixId?: string; // ID mapping for Wix Backend
  manualQuantity?: number; // User override for quantity
}

export interface CostCategory {
  id: string;
  title: string;
  items: CostItem[];
}

export const COST_DATA: CostCategory[] = [
  {
    id: "kaba_insaat",
    title: "1. Kaba İnşaat (Structure)",
    items: [
      {
        name: "Betonarme Betonu (C30)",
        unit: "m3",
        unit_price: 2500,
        auto_source: "total_area",
        multiplier: 0.38, // Varsayılan: 1 m2 inşaat alanına 0.38 m3 beton
        wixId: "betonmal"
      },
      {
        name: "İnşaat Demiri",
        unit: "ton",
        unit_price: 24000,
        auto_source: "total_area",
        multiplier: 0.040, // Varsayılan: 1 m2 inşaat alanına 40kg demir
        wixId: "demirmal"
      },
      {
        name: "Kalıp İşçiliği & Malzeme",
        unit: "m2",
        unit_price: 650,
        auto_source: "total_area",
        multiplier: 2.6, // Varsayılan: 1 m2 döşeme için 2.6 m2 kalıp yüzeyi
        wixId: "kalipdemirbetonisc"
      }
    ]
  },
  {
    id: "duvar_tavan",
    title: "2. Duvar ve Tavan İşleri",
    items: [
      {
        name: "Gazbeton Duvar (13.5'luk)",
        unit: "m2",
        unit_price: 850,
        auto_source: "wall_gazbeton_area", 
        multiplier: 1,
        wixId: "ytongmal"
      },
      {
        name: "Tuğla Duvar (13.5'luk)",
        unit: "m2",
        unit_price: 650,
        auto_source: "wall_tugla_area", 
        multiplier: 1,
        wixId: "tuglamal"
      },
      {
        name: "Briket Duvar (15'lik)",
        unit: "m2",
        unit_price: 550,
        auto_source: "wall_briket_area", 
        multiplier: 1,
        wixId: "briketmal"
      },
      {
        name: "İç Sıva (Kara Sıva)",
        unit: "m2",
        unit_price: 250,
        auto_source: "net_wall_area", // All walls regardless of material need plaster
        multiplier: 1,
        wixId: "karasivaisc"
      },
      {
        name: "Saten Alçı ve Boya (Duvar)",
        unit: "m2",
        unit_price: 350,
        auto_source: "net_wall_area",
        multiplier: 1,
        wixId: "boyamal"
      },
      {
        name: "Tavan Boyası",
        unit: "m2",
        unit_price: 150,
        auto_source: "total_area",
        multiplier: 1,
        wixId: "tavanboyamal"
      },
      {
        name: "Kartonpiyer / Stropiyer",
        unit: "mt",
        unit_price: 85,
        auto_source: "cornice_length",
        multiplier: 1,
        wixId: "alcikartonpiyermalisc"
      }
    ]
  },
  {
    id: "zemin_kaplama",
    title: "3. Zemin Kaplamaları",
    items: [
      {
        name: "Laminat Parke (Şilte+Süpürgelik Dahil)",
        unit: "m2",
        unit_price: 650,
        auto_source: "dry_area",
        multiplier: 1,
        wixId: "parkepaket"
      },
      {
        name: "Seramik Kaplama (Banyo/Mutfak)",
        unit: "m2",
        unit_price: 950,
        auto_source: "wet_area",
        multiplier: 1,
        wixId: "seramikmal"
      },
      {
        name: "Şap Atılması",
        unit: "m2",
        unit_price: 120,
        auto_source: "total_area",
        multiplier: 1,
        wixId: "sappaket"
      }
    ]
  },
  {
    id: "tesisat_diger",
    title: "4. Mekanik, Elektrik & Diğer",
    items: [
      {
        name: "Elektrik Tesisatı (m2 başı)",
        unit: "m2",
        unit_price: 1200,
        auto_source: "total_area",
        multiplier: 1,
        wixId: "elektriktesisatmal"
      },
      {
        name: "Mutfak Dolabı (Tahmini)",
        unit: "mt",
        unit_price: 15000,
        auto_source: "manual",
        multiplier: 0,
        wixId: "mutfakdolabipaket"
      },
      {
        name: "İç Kapı (Panel)",
        unit: "Adet",
        unit_price: 4500,
        auto_source: "manual",
        multiplier: 0,
        wixId: "odakapisipaket"
      }
    ]
  }
];