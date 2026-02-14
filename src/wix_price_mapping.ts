// wix_price_mapping.ts
// Sol Taraf: cost_data.ts 'name' alanı
// Sağ Taraf: Wix Veritabanı '_id'

export const WIX_PRICE_MAP: Record<string, string> = {
    // Kaba Yapı
    "Betonarme Betonu (C30)": "betonmal",
    "İnşaat Demiri": "demirmal",
    "Kalıp İşçiliği & Malzeme": "kalipdemirbetonisc",
    
    // Duvar
    "Gazbeton Duvar (13.5'luk)": "ytongmal",
    "Tuğla Duvar (13.5'luk)": "tuglamal",
    "Briket Duvar (15'lik)": "briketmal",
    "İç Sıva (Kara Sıva)": "karasivaisc",
    "İç Cephe Boyası": "boyamal",
    "Tavan Boyası": "tavanboyamal",
    "Kartonpiyer / Stropiyer": "alcikartonpiyermalisc",

    // Zemin
    "Laminat Parke (Anahtar Teslim)": "parkepaket",
    "Seramik Kaplama (Banyo/Koridor)": "seramikmal",
    "Şap Atılması (Malz.+İşçilik)": "sappaket",

    // İnce İşler
    "İç Kapı (Panel/Lake)": "odakapisipaket",
    "Mutfak Dolabı (Standart)": "mutfakdolabipaket",

    // Tesisat
    "Elektrik Tesisatı (Boru/Kablo) m2": "elektriktesisatmal",
    
    // Proje
    "Mimari Proje": "mimariprojeisc",
    "Statik Proje": "statikprojeisc",
    "Elektrik Projesi": "elektrikprojeisc",
    "Mekanik Proje": "mekanikprojeisc",
    "Akustik Rapor": "akustikraporisc",
    
    // Şantiye
    "Şantiye Şefi (Aylık)": "santiyesefiisc",
    "İş Makinesi (JCB/Ekskavatör)": "jcbpaket",
    "Şantiye Elektrik/Su Tüketimi": "elektriktuketimmal",
    
    // Diğer (Wix'te varsa eşleşecek, yoksa manuel kalacak)
    "Mantolama (Malz.+İşçilik)": "mantolamamalisc",
    "PVC Pencere (Doğrama)": "pvcpenceremal",
    "Sıhhi Tesisat Altyapısı (Daire Başı)": "sihhitesisatisc",
    "Doğalgaz Kolon Tesisatı": "petektesisatmontajiisc",
    "Su Deposu ve Hidrofor": "sudeposu2m3mal",
    "Asansör (10 Kişilik Paket)": "asansor2durakpaket",
    "Kamera ve Güvenlik Altyapısı": "kamerasistemi8lipaket",
    "Görüntülü Diafon Sistemi": "diyafongoruntulumal"
};