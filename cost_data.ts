export interface CostItem {
  name: string;
  unit: string;
  unit_price: number;
  // 'net_wall_area': Wall surface minus windows/doors
  // 'cornice_length': Perimeter if cornice is selected
  auto_source: 'total_area' | 'total_perimeter' | 'dry_area' | 'wet_area' | 'dry_perimeter' | 'wall_surface_area' | 'net_wall_area' | 'cornice_length' | 'manual';
  multiplier: number;
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
        multiplier: 0.38
      },
      {
        name: "İnşaat Demiri",
        unit: "ton",
        unit_price: 24000,
        auto_source: "total_area",
        multiplier: 0.040
      }
    ]
  },
  {
    id: "duvar_tavan",
    title: "2. Duvar ve Tavan İşleri",
    items: [
      {
        name: "Gazbeton Duvar Örülmesi",
        unit: "m2",
        unit_price: 850,
        auto_source: "net_wall_area", // Openings subtracted
        multiplier: 1
      },
      {
        name: "İç Sıva (Kara Sıva)",
        unit: "m2",
        unit_price: 250,
        auto_source: "net_wall_area",
        multiplier: 1
      },
      {
        name: "Saten Alçı ve Boya (Duvar)",
        unit: "m2",
        unit_price: 350,
        auto_source: "net_wall_area",
        multiplier: 1
      },
      {
        name: "Tavan Boyası",
        unit: "m2",
        unit_price: 150,
        auto_source: "total_area",
        multiplier: 1
      },
      {
        name: "Kartonpiyer / Stropiyer",
        unit: "mt",
        unit_price: 85,
        auto_source: "cornice_length",
        multiplier: 1
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
        multiplier: 1
      },
      {
        name: "Seramik Kaplama (Banyo/Mutfak)",
        unit: "m2",
        unit_price: 950,
        auto_source: "wet_area",
        multiplier: 1
      },
      {
        name: "Şap Atılması",
        unit: "m2",
        unit_price: 120,
        auto_source: "total_area",
        multiplier: 1
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
        multiplier: 1
      },
      {
        name: "Mutfak Dolabı (Tahmini)",
        unit: "mt",
        unit_price: 15000,
        auto_source: "manual",
        multiplier: 0
      },
      {
        name: "İç Kapı (Panel)",
        unit: "Adet",
        unit_price: 4500,
        auto_source: "manual",
        multiplier: 0
      }
    ]
  }
];