export type PlaceKind = 'city' | 'town' | 'site' | 'river';

export interface Place {
  name: string;
  arabic?: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

/**
 * A curated layer on top of the OSM basemap: the places worth labelling even at
 * low zoom. Villages, roads and the finer river network come from the tiles.
 */
export const PLACES: Place[] = [
  // Cities
  { name: 'Beirut', arabic: 'بيروت', kind: 'city', lat: 33.8938, lng: 35.5018 },
  { name: 'Tripoli', arabic: 'طرابلس', kind: 'city', lat: 34.4367, lng: 35.8497 },
  { name: 'Sidon', arabic: 'صيدا', kind: 'city', lat: 33.5571, lng: 35.3729 },
  { name: 'Tyre', arabic: 'صور', kind: 'city', lat: 33.2704, lng: 35.2038 },
  { name: 'Zahlé', arabic: 'زحلة', kind: 'city', lat: 33.8463, lng: 35.9019 },
  { name: 'Jounieh', arabic: 'جونية', kind: 'city', lat: 33.9808, lng: 35.6178 },
  { name: 'Baalbek', arabic: 'بعلبك', kind: 'city', lat: 34.0058, lng: 36.2181 },
  { name: 'Nabatieh', arabic: 'النبطية', kind: 'city', lat: 33.3789, lng: 35.4839 },
  { name: 'Byblos', arabic: 'جبيل', kind: 'city', lat: 34.1232, lng: 35.6519 },
  { name: 'Halba', arabic: 'حلبا', kind: 'city', lat: 34.5439, lng: 36.0803 },

  // Towns & villages
  { name: 'Batroun', arabic: 'البترون', kind: 'town', lat: 34.2553, lng: 35.6581 },
  { name: 'Aley', arabic: 'عاليه', kind: 'town', lat: 33.8106, lng: 35.5972 },
  { name: 'Bsharri', arabic: 'بشري', kind: 'town', lat: 34.2506, lng: 35.9931 },
  { name: 'Ehden', arabic: 'إهدن', kind: 'town', lat: 34.2939, lng: 35.975 },
  { name: 'Jezzine', arabic: 'جزين', kind: 'town', lat: 33.5406, lng: 35.5847 },
  { name: 'Deir el Qamar', arabic: 'دير القمر', kind: 'town', lat: 33.7003, lng: 35.5622 },
  { name: 'Beiteddine', arabic: 'بيت الدين', kind: 'town', lat: 33.6944, lng: 35.5806 },
  { name: 'Marjeyoun', arabic: 'مرجعيون', kind: 'town', lat: 33.3608, lng: 35.5906 },
  { name: 'Hasbaya', arabic: 'حاصبيا', kind: 'town', lat: 33.3972, lng: 35.6853 },
  { name: 'Rachaya', arabic: 'راشيا', kind: 'town', lat: 33.5028, lng: 35.8433 },
  { name: 'Bint Jbeil', arabic: 'بنت جبيل', kind: 'town', lat: 33.1225, lng: 35.4283 },
  { name: 'Hermel', arabic: 'الهرمل', kind: 'town', lat: 34.3919, lng: 36.3831 },
  { name: 'Zgharta', arabic: 'زغرتا', kind: 'town', lat: 34.3986, lng: 35.8964 },
  { name: 'Amioun', arabic: 'أميون', kind: 'town', lat: 34.3, lng: 35.8067 },
  { name: 'Broummana', arabic: 'برمانا', kind: 'town', lat: 33.8825, lng: 35.6167 },
  { name: 'Baskinta', arabic: 'بسكنتا', kind: 'town', lat: 33.9333, lng: 35.7833 },
  { name: 'Amchit', arabic: 'عمشيت', kind: 'town', lat: 34.1372, lng: 35.6483 },
  { name: 'Anjar', arabic: 'عنجر', kind: 'town', lat: 33.7278, lng: 35.9314 },
  { name: 'Qoubaiyat', arabic: 'القبيات', kind: 'town', lat: 34.5667, lng: 36.2833 },
  { name: 'Tannourine', arabic: 'تنورين', kind: 'town', lat: 34.2044, lng: 35.9139 },

  { name: 'Naqoura', arabic: 'الناقورة', kind: 'town', lat: 33.1136, lng: 35.1394 },
  { name: 'Chekka', arabic: 'شكا', kind: 'town', lat: 34.3003, lng: 35.7222 },
  { name: 'Anfeh', arabic: 'انفه', kind: 'town', lat: 34.3494, lng: 35.7297 },
  { name: 'Damour', arabic: 'الدامور', kind: 'town', lat: 33.7297, lng: 35.4553 },
  { name: 'Jiyeh', arabic: 'الجية', kind: 'town', lat: 33.6597, lng: 35.4183 },
  { name: 'Qana', arabic: 'قانا', kind: 'town', lat: 33.2078, lng: 35.3033 },
  { name: 'Faraya', arabic: 'فاريا', kind: 'town', lat: 34.0006, lng: 35.8236 },
  { name: 'Bhamdoun', arabic: 'بحمدون', kind: 'town', lat: 33.7972, lng: 35.6528 },
  { name: 'Douma', arabic: 'دوما', kind: 'town', lat: 34.2103, lng: 35.8283 },
  { name: 'Bkassine', arabic: 'بكاسين', kind: 'town', lat: 33.5325, lng: 35.5717 },

  // Sites worth a pin of their own
  { name: 'Cedars of God', kind: 'site', lat: 34.2447, lng: 36.0489 },
  { name: 'Qadisha Valley', kind: 'site', lat: 34.2472, lng: 35.9333 },
  { name: 'Jeita Grotto', kind: 'site', lat: 33.9439, lng: 35.6414 },
  { name: 'Baatara Gorge', kind: 'site', lat: 34.2331, lng: 35.8347 },
  { name: 'Faqra Ruins', kind: 'site', lat: 34.0089, lng: 35.8189 },
  { name: 'Mseilha Fort', kind: 'site', lat: 34.2478, lng: 35.6767 },
  { name: 'Beaufort Castle', kind: 'site', lat: 33.3239, lng: 35.5372 },
  { name: 'Aammiq Wetland', kind: 'site', lat: 33.7297, lng: 35.7861 },
  { name: 'Barouk Cedars', kind: 'site', lat: 33.6931, lng: 35.6931 },
  { name: 'Raouché Rocks', kind: 'site', lat: 33.8908, lng: 35.4714 },

  // Rivers (label anchors — the courses themselves are drawn by the basemap)
  { name: 'Litani River', kind: 'river', lat: 33.6217, lng: 35.7533 },
  { name: 'Orontes (Assi)', kind: 'river', lat: 34.3517, lng: 36.4033 },
  { name: 'Qadisha (Abu Ali)', kind: 'river', lat: 34.2811, lng: 35.9256 },
  { name: 'Ibrahim River', kind: 'river', lat: 34.0781, lng: 35.7189 },
  { name: 'Awali River', kind: 'river', lat: 33.5514, lng: 35.4453 },
  { name: 'Nahr el Kalb', kind: 'river', lat: 33.9581, lng: 35.6497 },
  { name: 'Damour River', kind: 'river', lat: 33.6819, lng: 35.5044 },
  { name: 'Hasbani River', kind: 'river', lat: 33.3494, lng: 35.6217 },
  { name: 'Beirut River', kind: 'river', lat: 33.8703, lng: 35.5539 },
  { name: 'Zahrani River', kind: 'river', lat: 33.4547, lng: 35.4033 },
];
