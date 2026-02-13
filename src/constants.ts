export const TURKEY_HEAT_MAP: Record<string, { zone: number, districts: Record<string, number> }> = {
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