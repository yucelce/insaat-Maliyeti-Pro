export interface CostItem {
  name: string;
  unit: string;
  unit_price: number;
  // auto_source determines how the default quantity is calculated
  // 'manual': Quantity must be entered by user
  // 'total_area': Multiplied by Total Construction Area (m2)
  // 'net_wall_area', etc.: Derived from Editor drawings
  auto_source: 'total_area' | 'total_perimeter' | 'dry_area' | 'wet_area' | 'dry_perimeter' | 'wall_surface_area' | 'net_wall_area' | 'cornice_length' | 'manual' | 'wall_gazbeton_area' | 'wall_tugla_area' | 'wall_briket_area';
  multiplier: number; // Applied to the auto_source value
  wixId?: string; // ID mapping for Wix Backend
  manualQuantity?: number; // User override for quantity
  manualPrice?: number; // User override for unit price
  scope?: 'global' | 'unit'; // Determines if item is per-unit or project-wide
}

export interface CostCategory {
  id: string;
  title: string;
  items: CostItem[];
}

export const COST_DATA: CostCategory[] = [
  // 1. RESMİ & İDARİ GİDERLER
  {
    id: "resmi_idari",
    title: "1. Projelendirme ve Resmi Giderler",
    items: [
      { name: "Mimari Proje", unit: "Adet", unit_price: 25000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Statik Proje", unit: "m2", unit_price: 45, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Mekanik Proje", unit: "m2", unit_price: 35, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Elektrik Projesi", unit: "m2", unit_price: 35, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Zemin Etüdü", unit: "Adet", unit_price: 15000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Haritacı Ücreti (Lihkab)", unit: "Adet", unit_price: 8000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Akustik Rapor", unit: "Adet", unit_price: 5000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Yapı Denetim Hizmet Bedeli", unit: "m2", unit_price: 150, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Ruhsat ve İskan Harçları", unit: "Adet", unit_price: 50000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Şantiye Şefi (Aylık)", unit: "Ay", unit_price: 20000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Enerji Kimlik Belgesi", unit: "Adet", unit_price: 3000, auto_source: "manual", multiplier: 1, scope: 'global' }
    ]
  },

  // 2. ŞANTİYE & HAFRİYAT
  {
    id: "santiye_hafriyat",
    title: "2. Şantiye Kurulumu ve Hafriyat",
    items: [
      { name: "Hafriyat (Kazı ve Döküm)", unit: "m3", unit_price: 450, auto_source: "total_area", multiplier: 1.5, scope: 'global' },
      { name: "İş Makinesi (JCB/Ekskavatör)", unit: "Saat", unit_price: 2500, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Şantiye Çiti (Çevirme)", unit: "mt", unit_price: 350, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Konteyner (Ofis/Depo)", unit: "Adet", unit_price: 65000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Şantiye Elektrik/Su Tüketimi", unit: "Ay", unit_price: 5000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Su Drenaj Sistemi", unit: "mt", unit_price: 450, auto_source: "manual", multiplier: 1, scope: 'global' }
    ]
  },

  // 3. KABA İNŞAAT (Beton, Demir, Çatı)
  {
    id: "kaba_insaat",
    title: "3. Kaba Yapı (Betonarme ve Çatı)",
    items: [
      { name: "Betonarme Betonu (C30)", unit: "m3", unit_price: 2650, auto_source: "total_area", multiplier: 0.38, wixId: "betonmal", scope: 'global' },
      { name: "İnşaat Demiri", unit: "ton", unit_price: 25500, auto_source: "total_area", multiplier: 0.045, wixId: "demirmal", scope: 'global' },
      { name: "Kalıp İşçiliği & Malzeme", unit: "m2", unit_price: 850, auto_source: "total_area", multiplier: 2.6, wixId: "kalipdemirbetonisc", scope: 'global' },
      { name: "Temel Su Yalıtımı (Bohçalama)", unit: "m2", unit_price: 450, auto_source: "total_area", multiplier: 0.25, scope: 'global' },
      { name: "Çatı Konstrüksiyon ve Kaplama", unit: "m2", unit_price: 2200, auto_source: "total_area", multiplier: 0.25, scope: 'global' },
      { name: "Asansör Kuyu ve Ray İşleri", unit: "Adet", unit_price: 45000, auto_source: "manual", multiplier: 1, scope: 'global' }
    ]
  },

  // 4. DUVAR VE TAVAN İŞLERİ
  {
    id: "duvar_tavan",
    title: "4. Duvar, Tavan ve Alçı İşleri",
    items: [
      { name: "Gazbeton Duvar (13.5'luk)", unit: "m2", unit_price: 950, auto_source: "wall_gazbeton_area", multiplier: 1, wixId: "ytongmal", scope: 'unit' },
      { name: "Tuğla Duvar (13.5'luk)", unit: "m2", unit_price: 750, auto_source: "wall_tugla_area", multiplier: 1, wixId: "tuglamal", scope: 'unit' },
      { name: "Briket Duvar (15'lik)", unit: "m2", unit_price: 650, auto_source: "wall_briket_area", multiplier: 1, wixId: "briketmal", scope: 'unit' },
      { name: "İç Sıva (Kara Sıva)", unit: "m2", unit_price: 350, auto_source: "net_wall_area", multiplier: 1, wixId: "karasivaisc", scope: 'unit' },
      { name: "Alçı Sıva (Kaba+Saten)", unit: "m2", unit_price: 450, auto_source: "net_wall_area", multiplier: 1, scope: 'unit' },
      { name: "İç Cephe Boyası", unit: "m2", unit_price: 250, auto_source: "net_wall_area", multiplier: 1, wixId: "boyamal", scope: 'unit' },
      { name: "Tavan Boyası", unit: "m2", unit_price: 180, auto_source: "total_area", multiplier: 1, wixId: "tavanboyamal", scope: 'unit' },
      { name: "Asma Tavan (Alçıpan)", unit: "m2", unit_price: 650, auto_source: "manual", multiplier: 1, scope: 'unit' },
      { name: "Kartonpiyer / Stropiyer", unit: "mt", unit_price: 120, auto_source: "cornice_length", multiplier: 1, wixId: "alcikartonpiyermalisc", scope: 'unit' }
    ]
  },

  // 5. DIŞ CEPHE VE YALITIM
  {
    id: "dis_cephe",
    title: "5. Dış Cephe ve Yalıtım",
    items: [
      { name: "Mantolama (Malz.+İşçilik)", unit: "m2", unit_price: 1200, auto_source: "total_area", multiplier: 1.2, scope: 'global' },
      { name: "Dış Cephe Boyası/Kaplama", unit: "m2", unit_price: 450, auto_source: "total_area", multiplier: 1.2, scope: 'global' },
      { name: "PVC Pencere (Doğrama)", unit: "m2", unit_price: 4500, auto_source: "manual", multiplier: 0, scope: 'global' }, // Usually calculated per hole but often global contract
      { name: "Mermer Denizlik", unit: "mt", unit_price: 750, auto_source: "manual", multiplier: 0, scope: 'global' },
      { name: "Balkon Korkulukları (Alüminyum)", unit: "mt", unit_price: 1800, auto_source: "manual", multiplier: 0, scope: 'global' }
    ]
  },

  // 6. ZEMİN VE MERDİVEN
  {
    id: "zemin_kaplama",
    title: "6. Zemin Kaplamaları ve Merdiven",
    items: [
      { name: "Şap Atılması (Malz.+İşçilik)", unit: "m2", unit_price: 180, auto_source: "total_area", multiplier: 1, wixId: "sappaket", scope: 'unit' },
      { name: "Laminat Parke (Anahtar Teslim)", unit: "m2", unit_price: 750, auto_source: "dry_area", multiplier: 1, wixId: "parkepaket", scope: 'unit' },
      { name: "Seramik Kaplama (Banyo/Koridor)", unit: "m2", unit_price: 1100, auto_source: "wet_area", multiplier: 1, wixId: "seramikmal", scope: 'unit' },
      { name: "Merdiven Mermer Kaplama", unit: "Basamak", unit_price: 1500, auto_source: "manual", multiplier: 1, scope: 'global' }, // Stairs are usually common area
      { name: "Merdiven Korkuluğu", unit: "mt", unit_price: 1800, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Süpürgelik", unit: "mt", unit_price: 150, auto_source: "dry_perimeter", multiplier: 1, scope: 'unit' }
    ]
  },

  // 7. İNCE İŞLER (Mobilya, Kapı, Vitrifiye)
  {
    id: "ince_isler",
    title: "7. İnce İşler ve Mobilya",
    items: [
      { name: "Çelik Kapı (Daire Giriş)", unit: "Adet", unit_price: 15000, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "İç Kapı (Panel/Lake)", unit: "Adet", unit_price: 6500, auto_source: "manual", multiplier: 0, wixId: "odakapisipaket", scope: 'unit' },
      { name: "Mutfak Dolabı (Standart)", unit: "mt", unit_price: 18000, auto_source: "manual", multiplier: 0, wixId: "mutfakdolabipaket", scope: 'unit' },
      { name: "Mutfak Tezgahı (Granit/Çimstone)", unit: "mt", unit_price: 8000, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Banyo Dolabı & Lavabo", unit: "Adet", unit_price: 6000, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Klozet Takımı (Gömme Rezervuar)", unit: "Adet", unit_price: 7500, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Duşakabin", unit: "Adet", unit_price: 5500, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Batarya Grubu (Mutfak/Banyo)", unit: "Set", unit_price: 4500, auto_source: "manual", multiplier: 0, scope: 'unit' }
    ]
  },

  // 8. MEKANİK TESİSAT
  {
    id: "mekanik_tesisat",
    title: "8. Mekanik Tesisat",
    items: [
      { name: "Sıhhi Tesisat Altyapısı (Daire Başı)", unit: "Adet", unit_price: 25000, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Isıtma Tesisatı (Mobil Sistem)", unit: "m2", unit_price: 450, auto_source: "total_area", multiplier: 1, scope: 'unit' },
      { name: "Kombi ve Montajı", unit: "Adet", unit_price: 35000, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Panel Radyatör", unit: "mt", unit_price: 3500, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Doğalgaz Kolon Tesisatı", unit: "Adet", unit_price: 45000, auto_source: "manual", multiplier: 0, scope: 'global' },
      { name: "Asansör (10 Kişilik Paket)", unit: "Adet", unit_price: 650000, auto_source: "manual", multiplier: 0, scope: 'global' },
      { name: "Yangın Dolabı ve Tesisatı", unit: "Adet", unit_price: 15000, auto_source: "manual", multiplier: 0, scope: 'global' },
      { name: "Su Deposu ve Hidrofor", unit: "Paket", unit_price: 45000, auto_source: "manual", multiplier: 1, scope: 'global' }
    ]
  },

  // 9. ELEKTRİK TESİSATI
  {
    id: "elektrik_tesisat",
    title: "9. Elektrik Tesisatı",
    items: [
      { name: "Elektrik Tesisatı (Boru/Kablo) m2", unit: "m2", unit_price: 1400, auto_source: "total_area", multiplier: 1, wixId: "elektriktesisatmal", scope: 'unit' },
      { name: "Anahtar ve Priz Grupları", unit: "Adet", unit_price: 150, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Sigorta Panosu ve Şalt Malz.", unit: "Adet", unit_price: 8500, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Görüntülü Diafon Sistemi", unit: "Daire", unit_price: 4500, auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Merkezi Uydu Sistemi", unit: "Paket", unit_price: 15000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Kamera ve Güvenlik Altyapısı", unit: "Paket", unit_price: 25000, auto_source: "manual", multiplier: 1, scope: 'global' }
    ]
  }
];