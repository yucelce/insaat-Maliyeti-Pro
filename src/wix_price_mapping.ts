// Bu dosyada Uygulama içindeki Malzeme Adı ile Wix Veritabanındaki ID eşleşmesi yapılır.
// Sol taraf: Uygulamadaki tam isim (cost_data.ts ile birebir aynı olmalı)
// Sağ taraf: Wix Veritabanındaki '_id' değeri

export const WIX_PRICE_MAP: Record<string, string> = {
    // 1. Kaba İnşaat
    "Betonarme Betonu (C30)": "betonmal",
    "İnşaat Demiri": "demirmal",
    "Kalıp İşçiliği & Malzeme": "kalipdemirbetonisc",

    // 2. Duvar ve Tavan
    "Gazbeton Duvar (13.5'luk)": "ytongmal",
    "Tuğla Duvar (13.5'luk)": "tuglamal",
    "Briket Duvar (15'lik)": "briketmal",
    "İç Sıva (Kara Sıva)": "karasivaisc",
    "Saten Alçı ve Boya (Duvar)": "boyamal",
    "Tavan Boyası": "tavanboyamal",
    "Kartonpiyer / Stropiyer": "alcikartonpiyermalisc",

    // 3. Zemin Kaplamaları
    "Laminat Parke (Şilte+Süpürgelik Dahil)": "parkepaket",
    "Seramik Kaplama (Banyo/Mutfak)": "seramikmal",
    "Şap Atılması": "sappaket",

    // 4. Mekanik & Diğer
    "Elektrik Tesisatı (m2 başı)": "elektriktesisatmal",
    "Mutfak Dolabı (Tahmini)": "mutfakdolabipaket",
    "İç Kapı (Panel)": "odakapisipaket"
};