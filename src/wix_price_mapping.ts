// wix_price_mapping.ts

// ÖNEMLİ NOT: Sol taraftaki isimler 'cost_data.ts' dosyanızdaki 'name' alanı ile
// HARFİ HARFİNE aynı olmalıdır. Yoksa eşleşmez.

export const WIX_PRICE_MAP: Record<string, string> = {
    // --- 1. KABA İNŞAAT ---
    // JSON'da 'betonmal' ve 'demirmal' görünmüyordu. 
    // Eğer veritabanında yoklarsa burası çalışmaz. 
    // Ancak 'kalipdemirbetonisc' verisi gelmişti (990.5 TL).
    "Kalıp ve Demir İşçiliği": "kalipdemirbetonisc", 
    "Kalıp İşçiliği": "kalipisc",

    // --- 2. DUVAR VE TAVAN ---
    // Sizin dosyanızda 'ytongmal' vardı ama Wix'ten 'ytongmalisc' geldi.
    "Gazbeton Duvar (13.5'luk)": "ytongmalisc", 
    "Boya İşçiliği": "boyaisc", 
    "Mantolama (Malz+İşç)": "mantolamamalisc",
    "Akustik Rapor": "akustikraporisc",

    // --- 3. ZEMİN VE KAPLAMALAR ---
    // JSON'da 'parkepaket' yoktu. 'parkemal' (484 TL) ve 'parkeisc' (123.8 TL) vardı.
    // Uygulamanızda hangisini kullanıyorsanız onu seçin.
    "Laminat Parke Malzemesi": "parkemal", 
    "Laminat Parke İşçiliği": "parkeisc",
    "Laminat Parke (Malz+İşç Paket)": "parkemalisc", // Bu ID JSON'da mevcuttu (607.8 TL)

    // --- 4. MEKANİK & TESİSAT ---
    "Elektrik Tesisatı (m2 başı)": "elektriktesisatmal", // JSON: 19575 TL (Birim fiyat kontrol edilmeli)
    "Elektrik İşçiliği": "elektriktesisatisc",
    "Sıhhi Tesisat Malzemesi (Temiz)": "temiztesisatmal",
    "Sıhhi Tesisat Malzemesi (Pis)": "pissutesisatmal",
    "Sıhhi Tesisat İşçiliği": "sihhitesisatisc",
    "Doğalgaz / Petek Montajı": "petektesisatmontajiisc",

    // --- 5. MOBİLYA VE KAPI ---
    "Mutfak Dolabı (Paket)": "mutfakdolabipaket", // JSON: 6955 TL
    "Oda Kapısı (Malzeme)": "odakapisimal",       // JSON: 6180 TL
    "Portmanto": "portmantomal",
    "Davlumbaz": "davlumbazmal",
    "Mutfak Evyesi": "evyemal",

    // --- 6. DİĞER ---
    "PVC Pencere (Malzeme)": "pvcpenceremal",
    "PVC Pencere İşçiliği": "pvcpencereisc",
    "Asansör (Yeşil Etiket)": "asansoryesiletiketisc",
    "Asansör (2 Durak)": "asansor2durakpaket",
    "Yapı Denetim (Küçük Paket)": "bayindirlikm2kucuk30paket",
    "Yapı Denetim (Büyük Paket)": "bayindirlikm2buyuk30paket",
    
    // --- PROJELER ---
    "Mimari Proje": "mimariprojeisc",
    "Statik Proje": "statikprojeisc",
    "Elektrik Proje": "elektrikprojeisc",
    "Mekanik Proje": "mekanikprojeisc"
};