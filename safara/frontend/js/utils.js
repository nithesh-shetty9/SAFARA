// ── SAFARA — DB & Session Utilities ──

const DB = (() => {
  const KEY      = 'safara_v2';
  // ── SEED_VERSION ──────────────────────────────────────────────────────────
  // Bump this string whenever you add/edit/remove incidents in SEED_INCIDENTS
  // below. On next page load the stored data will be merged with new seeds
  // so your additions always show up on the map without clearing localStorage.
  const SEED_VERSION = 'v5';

  // ── Seed incidents — edit freely, bump SEED_VERSION after every change ────
  // Every entry MUST have a real lat/lng so the dot appears on the map.
  // Status must be 'confirmed' to show as a crime dot during routing.
  const SEED_INCIDENTS = [
    // ── Mangaluru / Coastal Karnataka — 120 verified locations ───────────
    { id:1,   type:'Safe Zone',           location:'Kadri Manjunatha Temple',        lat:12.8856, lng:74.8556, severity:'LOW',    status:'confirmed', ts:'2024-12-01T18:00:00', userId:1, desc:'Well lit temple surroundings',           is_harassment:false },
    { id:2,   type:'Harassment',          location:'Mangaladevi Temple Road',        lat:12.8574, lng:74.8389, severity:'HIGH',   status:'confirmed', ts:'2024-12-01T20:10:00', userId:1, desc:'Verbal harassment reported',              is_harassment:true  },
    { id:3,   type:'Unsafe Environment',  location:'Kudroli Temple Parking',         lat:12.8777, lng:74.8433, severity:'LOW',    status:'confirmed', ts:'2024-12-01T21:00:00', userId:1, desc:'Poor lighting in parking area',           is_harassment:false },
    { id:4,   type:'Safe Zone',           location:'St Aloysius Chapel',             lat:12.8713, lng:74.8461, severity:'LOW',    status:'confirmed', ts:'2024-12-02T17:30:00', userId:1, desc:'Tourist friendly and monitored',          is_harassment:false },
    { id:5,   type:'Suspicious Activity', location:'Rosario Cathedral Road',         lat:12.8671, lng:74.8420, severity:'MEDIUM', status:'confirmed', ts:'2024-12-02T19:00:00', userId:1, desc:'Suspicious person loitering',             is_harassment:false },
    { id:6,   type:'Safe Zone',           location:'Infant Jesus Shrine',            lat:12.8871, lng:74.8532, severity:'LOW',    status:'confirmed', ts:'2024-12-02T18:45:00', userId:1, desc:'Busy area with visitors',                 is_harassment:false },
    { id:7,   type:'Harassment',          location:'Ullal Dargah Market',            lat:12.8090, lng:74.8535, severity:'MEDIUM', status:'confirmed', ts:'2024-12-02T20:30:00', userId:1, desc:'Harassment near crowded lane',            is_harassment:true  },
    { id:8,   type:'Safe Zone',           location:'Surathkal Beach Entrance',       lat:13.0084, lng:74.7943, severity:'LOW',    status:'confirmed', ts:'2024-12-03T17:40:00', userId:1, desc:'Evening crowd ensures safety',            is_harassment:false },
    { id:9,   type:'Suspicious Activity', location:'Panambur Beach Parking',         lat:12.9539, lng:74.8003, severity:'MEDIUM', status:'confirmed', ts:'2024-12-03T19:20:00', userId:1, desc:'Vehicle parked unusually long',           is_harassment:false },
    { id:10,  type:'Harassment',          location:'Tannirbhavi Beach Path',         lat:12.9006, lng:74.8146, severity:'HIGH',   status:'confirmed', ts:'2024-12-03T21:10:00', userId:1, desc:'Harassment near walkway',                 is_harassment:true  },
    { id:11,  type:'Unsafe Environment',  location:'Sultan Battery Steps',           lat:12.8711, lng:74.8195, severity:'LOW',    status:'confirmed', ts:'2024-12-04T19:40:00', userId:1, desc:'Area poorly lit',                         is_harassment:false },
    { id:12,  type:'Safe Zone',           location:'Someshwara Beach',               lat:12.7876, lng:74.8560, severity:'LOW',    status:'confirmed', ts:'2024-12-04T18:20:00', userId:1, desc:'Family friendly beach',                   is_harassment:false },
    { id:13,  type:'Suspicious Activity', location:'Kadri Hill Park',                lat:12.8859, lng:74.8561, severity:'MEDIUM', status:'confirmed', ts:'2024-12-04T20:15:00', userId:1, desc:'Person watching joggers',                 is_harassment:false },
    { id:14,  type:'Safe Zone',           location:'Tannirbhavi Tree Park',          lat:12.9001, lng:74.8155, severity:'LOW',    status:'confirmed', ts:'2024-12-05T17:50:00', userId:1, desc:'Security presence',                       is_harassment:false },
    { id:15,  type:'Harassment',          location:'Lighthouse Hill Garden',         lat:12.8718, lng:74.8429, severity:'MEDIUM', status:'confirmed', ts:'2024-12-05T20:00:00', userId:1, desc:'Reported harassment',                     is_harassment:true  },
    { id:16,  type:'Suspicious Activity', location:'Govt Museum Hampankatta',        lat:12.8730, lng:74.8435, severity:'LOW',    status:'confirmed', ts:'2024-12-05T19:30:00', userId:1, desc:'Suspicious loitering',                    is_harassment:false },
    { id:17,  type:'Unsafe Environment',  location:'New Mangalore Port Road',        lat:12.9516, lng:74.8175, severity:'LOW',    status:'confirmed', ts:'2024-12-05T21:30:00', userId:1, desc:'Poor lighting',                           is_harassment:false },
    { id:18,  type:'Theft / Snatching',   location:'Forum Fiza Mall Parking',        lat:12.8655, lng:74.8426, severity:'HIGH',   status:'confirmed', ts:'2024-12-06T20:10:00', userId:1, desc:'Phone snatching',                         is_harassment:false },
    { id:19,  type:'Safe Zone',           location:'City Centre Mall',               lat:12.8702, lng:74.8421, severity:'LOW',    status:'confirmed', ts:'2024-12-06T18:10:00', userId:1, desc:'CCTV monitored',                          is_harassment:false },
    { id:20,  type:'Safe Zone',           location:'Mangalore Central Railway Station', lat:12.8698, lng:74.8430, severity:'LOW', status:'confirmed', ts:'2024-12-06T19:00:00', userId:1, desc:'Police patrol visible',                  is_harassment:false },
    { id:21,  type:'Safe Zone',           location:'Surathkal Lighthouse',           lat:13.0095, lng:74.7928, severity:'LOW',    status:'confirmed', ts:'2024-12-07T18:00:00', userId:1, desc:'Tourist area safe',                       is_harassment:false },
    { id:22,  type:'Suspicious Activity', location:'Kankanady Market',               lat:12.8840, lng:74.8575, severity:'MEDIUM', status:'confirmed', ts:'2024-12-07T19:10:00', userId:1, desc:'Unknown person following shoppers',       is_harassment:false },
    { id:23,  type:'Harassment',          location:'Bendoorwell Circle',             lat:12.8804, lng:74.8510, severity:'HIGH',   status:'confirmed', ts:'2024-12-07T20:15:00', userId:1, desc:'Verbal harassment reported',              is_harassment:true  },
    { id:24,  type:'Unsafe Environment',  location:'Bejai Road',                     lat:12.8855, lng:74.8457, severity:'LOW',    status:'confirmed', ts:'2024-12-07T21:00:00', userId:1, desc:'Dark stretch of road',                    is_harassment:false },
    { id:25,  type:'Safe Zone',           location:'NITK Campus Gate',               lat:13.0108, lng:74.7941, severity:'LOW',    status:'confirmed', ts:'2024-12-08T17:20:00', userId:1, desc:'Security guards present',                 is_harassment:false },
    { id:26,  type:'Suspicious Activity', location:'Pumpwell Junction',              lat:12.8679, lng:74.8583, severity:'MEDIUM', status:'confirmed', ts:'2024-12-08T18:40:00', userId:1, desc:'Suspicious bike circling area',           is_harassment:false },
    { id:27,  type:'Harassment',          location:'Deralakatte Bus Stop',           lat:12.8155, lng:74.8892, severity:'HIGH',   status:'confirmed', ts:'2024-12-08T19:50:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:28,  type:'Safe Zone',           location:'Kudroli Park',                   lat:12.8785, lng:74.8440, severity:'LOW',    status:'confirmed', ts:'2024-12-08T18:10:00', userId:1, desc:'Public presence ensures safety',          is_harassment:false },
    { id:29,  type:'Unsafe Environment',  location:'Bajpe Airport Road',             lat:12.9613, lng:74.8901, severity:'LOW',    status:'confirmed', ts:'2024-12-08T21:10:00', userId:1, desc:'Dim street lighting',                     is_harassment:false },
    { id:30,  type:'Suspicious Activity', location:'Falnir Road',                    lat:12.8675, lng:74.8462, severity:'MEDIUM', status:'confirmed', ts:'2024-12-08T20:25:00', userId:1, desc:'Suspicious loitering',                    is_harassment:false },
    { id:31,  type:'Safe Zone',           location:'Lady Hill Circle',               lat:12.8852, lng:74.8441, severity:'LOW',    status:'confirmed', ts:'2024-12-09T17:10:00', userId:1, desc:'Busy traffic zone',                       is_harassment:false },
    { id:32,  type:'Harassment',          location:'Kavoor Junction',                lat:12.9150, lng:74.8530, severity:'HIGH',   status:'confirmed', ts:'2024-12-09T19:15:00', userId:1, desc:'Reported harassment',                     is_harassment:true  },
    { id:33,  type:'Suspicious Activity', location:'Bondel Church Road',             lat:12.9040, lng:74.8550, severity:'MEDIUM', status:'confirmed', ts:'2024-12-09T20:00:00', userId:1, desc:'Suspicious individual',                   is_harassment:false },
    { id:34,  type:'Safe Zone',           location:'Mannagudda Park',                lat:12.8768, lng:74.8478, severity:'LOW',    status:'confirmed', ts:'2024-12-09T18:05:00', userId:1, desc:'Families around',                         is_harassment:false },
    { id:35,  type:'Unsafe Environment',  location:'Urwa Market Street',             lat:12.8875, lng:74.8469, severity:'LOW',    status:'confirmed', ts:'2024-12-09T21:10:00', userId:1, desc:'Poor lighting',                           is_harassment:false },
    { id:36,  type:'Suspicious Activity', location:'Ashoknagar Main Road',           lat:12.8920, lng:74.8572, severity:'MEDIUM', status:'confirmed', ts:'2024-12-10T20:30:00', userId:1, desc:'Suspicious bike riders',                  is_harassment:false },
    { id:37,  type:'Safe Zone',           location:'Kadri Park',                     lat:12.8860, lng:74.8568, severity:'LOW',    status:'confirmed', ts:'2024-12-10T17:30:00', userId:1, desc:'Joggers and families present',            is_harassment:false },
    { id:38,  type:'Harassment',          location:'KS Rao Road',                    lat:12.8708, lng:74.8427, severity:'HIGH',   status:'confirmed', ts:'2024-12-10T20:40:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:39,  type:'Safe Zone',           location:'PVS Circle',                     lat:12.8722, lng:74.8425, severity:'LOW',    status:'confirmed', ts:'2024-12-10T18:20:00', userId:1, desc:'Commercial busy area',                    is_harassment:false },
    { id:40,  type:'Unsafe Environment',  location:'Car Street',                     lat:12.8692, lng:74.8420, severity:'LOW',    status:'confirmed', ts:'2024-12-10T21:15:00', userId:1, desc:'Narrow dark lane',                        is_harassment:false },
    { id:41,  type:'Safe Zone',           location:'Central Market',                 lat:12.8682, lng:74.8441, severity:'LOW',    status:'confirmed', ts:'2024-12-11T17:45:00', userId:1, desc:'Crowded market',                          is_harassment:false },
    { id:42,  type:'Suspicious Activity', location:'Attavar Junction',               lat:12.8634, lng:74.8472, severity:'MEDIUM', status:'confirmed', ts:'2024-12-11T20:05:00', userId:1, desc:'Suspicious person wandering',             is_harassment:false },
    { id:43,  type:'Harassment',          location:'Jeppinamogaru Road',             lat:12.8601, lng:74.8531, severity:'HIGH',   status:'confirmed', ts:'2024-12-11T20:50:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:44,  type:'Safe Zone',           location:'Yeyyadi Circle',                 lat:12.9078, lng:74.8583, severity:'LOW',    status:'confirmed', ts:'2024-12-11T18:10:00', userId:1, desc:'Traffic monitored',                       is_harassment:false },
    { id:45,  type:'Unsafe Environment',  location:'Kottara Cross',                  lat:12.8952, lng:74.8479, severity:'LOW',    status:'confirmed', ts:'2024-12-11T21:10:00', userId:1, desc:'Street lights not working',               is_harassment:false },
    { id:46,  type:'Suspicious Activity', location:'Kuloor Bridge',                  lat:12.9158, lng:74.8289, severity:'MEDIUM', status:'confirmed', ts:'2024-12-12T19:50:00', userId:1, desc:'Suspicious bike parked',                  is_harassment:false },
    { id:47,  type:'Safe Zone',           location:'Baikampady Industrial Area Gate', lat:12.9488, lng:74.8341, severity:'LOW',  status:'confirmed', ts:'2024-12-12T18:15:00', userId:1, desc:'Security checkpoint',                     is_harassment:false },
    { id:48,  type:'Harassment',          location:'Surathkal Market',               lat:13.0090, lng:74.7930, severity:'HIGH',   status:'confirmed', ts:'2024-12-12T20:30:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:49,  type:'Safe Zone',           location:'KREC Beach',                     lat:13.0120, lng:74.7915, severity:'LOW',    status:'confirmed', ts:'2024-12-12T17:30:00', userId:1, desc:'Student activity area',                   is_harassment:false },
    { id:50,  type:'Unsafe Environment',  location:'Thokottu Bridge',                lat:12.8138, lng:74.8662, severity:'LOW',    status:'confirmed', ts:'2024-12-12T21:20:00', userId:1, desc:'Dim lighting on bridge',                  is_harassment:false },
    { id:51,  type:'Safe Zone',           location:'Ullal Beach Entrance',           lat:12.8077, lng:74.8428, severity:'LOW',    status:'confirmed', ts:'2024-12-13T18:00:00', userId:1, desc:'Families around',                         is_harassment:false },
    { id:52,  type:'Suspicious Activity', location:'Talapady Border Road',           lat:12.7705, lng:74.8852, severity:'MEDIUM', status:'confirmed', ts:'2024-12-13T19:15:00', userId:1, desc:'Suspicious vehicle',                      is_harassment:false },
    { id:53,  type:'Harassment',          location:'Derlakatte Junction',            lat:12.8152, lng:74.8891, severity:'HIGH',   status:'confirmed', ts:'2024-12-13T20:30:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:54,  type:'Safe Zone',           location:'AJ Hospital Area',               lat:12.8927, lng:74.8569, severity:'LOW',    status:'confirmed', ts:'2024-12-13T18:25:00', userId:1, desc:'Hospital security present',               is_harassment:false },
    { id:55,  type:'Unsafe Environment',  location:'Nanthur Circle',                 lat:12.8945, lng:74.8592, severity:'LOW',    status:'confirmed', ts:'2024-12-13T21:10:00', userId:1, desc:'Dark corner street',                      is_harassment:false },
    { id:56,  type:'Suspicious Activity', location:'Padil Railway Gate',             lat:12.8688, lng:74.8681, severity:'MEDIUM', status:'confirmed', ts:'2024-12-14T20:00:00', userId:1, desc:'Suspicious loitering',                    is_harassment:false },
    { id:57,  type:'Safe Zone',           location:'Konaje Campus Area',             lat:12.8242, lng:74.9270, severity:'LOW',    status:'confirmed', ts:'2024-12-14T17:50:00', userId:1, desc:'University security patrol',              is_harassment:false },
    { id:58,  type:'Harassment',          location:'Mudipu Market',                  lat:12.8391, lng:74.9365, severity:'HIGH',   status:'confirmed', ts:'2024-12-14T20:40:00', userId:1, desc:'Reported harassment',                     is_harassment:true  },
    { id:59,  type:'Safe Zone',           location:'Vamanjoor Junction',             lat:12.9168, lng:74.8954, severity:'LOW',    status:'confirmed', ts:'2024-12-14T18:10:00', userId:1, desc:'Busy junction',                           is_harassment:false },
    { id:60,  type:'Unsafe Environment',  location:'Gurupura Bridge',                lat:12.9284, lng:74.8613, severity:'LOW',    status:'confirmed', ts:'2024-12-14T21:10:00', userId:1, desc:'Low visibility area',                     is_harassment:false },
    { id:61,  type:'Safe Zone',           location:'Bondel Junction',                lat:12.9030, lng:74.8560, severity:'LOW',    status:'confirmed', ts:'2024-12-15T18:05:00', userId:1, desc:'Traffic monitored',                       is_harassment:false },
    { id:62,  type:'Suspicious Activity', location:'Kottara Chowki',                 lat:12.8963, lng:74.8504, severity:'MEDIUM', status:'confirmed', ts:'2024-12-15T19:30:00', userId:1, desc:'Suspicious group',                        is_harassment:false },
    { id:63,  type:'Harassment',          location:'Urwa Stores',                    lat:12.8878, lng:74.8462, severity:'HIGH',   status:'confirmed', ts:'2024-12-15T20:45:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:64,  type:'Safe Zone',           location:'Ballalbagh Park',                lat:12.8789, lng:74.8531, severity:'LOW',    status:'confirmed', ts:'2024-12-15T17:40:00', userId:1, desc:'Public activity',                         is_harassment:false },
    { id:65,  type:'Unsafe Environment',  location:'Kankanady Railway Bridge',       lat:12.8835, lng:74.8578, severity:'LOW',    status:'confirmed', ts:'2024-12-15T21:00:00', userId:1, desc:'Dim street lighting',                     is_harassment:false },
    { id:66,  type:'Suspicious Activity', location:'Alake Road',                     lat:12.8780, lng:74.8428, severity:'MEDIUM', status:'confirmed', ts:'2024-12-16T20:20:00', userId:1, desc:'Unknown person loitering',                is_harassment:false },
    { id:67,  type:'Safe Zone',           location:'Falnir Park',                    lat:12.8689, lng:74.8451, severity:'LOW',    status:'confirmed', ts:'2024-12-16T17:50:00', userId:1, desc:'Joggers present',                         is_harassment:false },
    { id:68,  type:'Harassment',          location:'Pandeshwar Road',                lat:12.8641, lng:74.8420, severity:'HIGH',   status:'confirmed', ts:'2024-12-16T20:35:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:69,  type:'Safe Zone',           location:'Port Area Gate',                 lat:12.9515, lng:74.8168, severity:'LOW',    status:'confirmed', ts:'2024-12-16T18:30:00', userId:1, desc:'Port security',                           is_harassment:false },
    { id:70,  type:'Unsafe Environment',  location:'Panambur Truck Road',            lat:12.9581, lng:74.8065, severity:'LOW',    status:'confirmed', ts:'2024-12-16T21:20:00', userId:1, desc:'Dark truck route',                        is_harassment:false },
    { id:71,  type:'Safe Zone',           location:'Kuloor Ferry Point',             lat:12.9180, lng:74.8254, severity:'LOW',    status:'confirmed', ts:'2024-12-17T18:10:00', userId:1, desc:'Ferry staff present',                     is_harassment:false },
    { id:72,  type:'Suspicious Activity', location:'Baikampady Cross',               lat:12.9495, lng:74.8331, severity:'MEDIUM', status:'confirmed', ts:'2024-12-17T19:25:00', userId:1, desc:'Suspicious parked vehicle',               is_harassment:false },
    { id:73,  type:'Harassment',          location:'Surathkal Bus Stand',            lat:13.0072, lng:74.7934, severity:'HIGH',   status:'confirmed', ts:'2024-12-17T20:40:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:74,  type:'Safe Zone',           location:'NITK Main Gate',                 lat:13.0109, lng:74.7945, severity:'LOW',    status:'confirmed', ts:'2024-12-17T17:55:00', userId:1, desc:'Campus security',                         is_harassment:false },
    { id:75,  type:'Unsafe Environment',  location:'Hosabettu Road',                 lat:12.9970, lng:74.8035, severity:'LOW',    status:'confirmed', ts:'2024-12-17T21:00:00', userId:1, desc:'Low street lighting',                     is_harassment:false },
    { id:76,  type:'Suspicious Activity', location:'Katipalla Junction',             lat:12.9820, lng:74.8305, severity:'MEDIUM', status:'confirmed', ts:'2024-12-18T20:10:00', userId:1, desc:'Suspicious bike activity',                is_harassment:false },
    { id:77,  type:'Safe Zone',           location:'Kulai Beach Entrance',           lat:12.9722, lng:74.8071, severity:'LOW',    status:'confirmed', ts:'2024-12-18T18:05:00', userId:1, desc:'Visitors around',                         is_harassment:false },
    { id:78,  type:'Harassment',          location:'Kulai Market Road',              lat:12.9734, lng:74.8124, severity:'HIGH',   status:'confirmed', ts:'2024-12-18T20:45:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:79,  type:'Safe Zone',           location:'Mulki Bridge Area',              lat:13.0905, lng:74.7932, severity:'LOW',    status:'confirmed', ts:'2024-12-18T17:30:00', userId:1, desc:'Busy traffic ensures safety',             is_harassment:false },
    { id:80,  type:'Unsafe Environment',  location:'Mulki Riverside Road',           lat:13.0911, lng:74.7971, severity:'LOW',    status:'confirmed', ts:'2024-12-18T21:10:00', userId:1, desc:'Dark stretch',                            is_harassment:false },
    { id:81,  type:'Safe Zone',           location:'Bantwal Bus Stand',              lat:12.8922, lng:75.0310, severity:'LOW',    status:'confirmed', ts:'2024-12-19T18:10:00', userId:1, desc:'Public crowd',                            is_harassment:false },
    { id:82,  type:'Suspicious Activity', location:'BC Road Junction',               lat:12.8928, lng:75.0342, severity:'MEDIUM', status:'confirmed', ts:'2024-12-19T19:30:00', userId:1, desc:'Suspicious car parked',                   is_harassment:false },
    { id:83,  type:'Harassment',          location:'Bantwal Market Street',          lat:12.8915, lng:75.0330, severity:'HIGH',   status:'confirmed', ts:'2024-12-19T20:50:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:84,  type:'Safe Zone',           location:'Bantwal Temple Area',            lat:12.8902, lng:75.0312, severity:'LOW',    status:'confirmed', ts:'2024-12-19T17:45:00', userId:1, desc:'Pilgrims around',                         is_harassment:false },
    { id:85,  type:'Unsafe Environment',  location:'Bantwal Bridge Road',            lat:12.8895, lng:75.0301, severity:'LOW',    status:'confirmed', ts:'2024-12-19T21:10:00', userId:1, desc:'Low lighting',                            is_harassment:false },
    { id:86,  type:'Suspicious Activity', location:'Kalladka Junction',              lat:12.8701, lng:75.0371, severity:'MEDIUM', status:'confirmed', ts:'2024-12-20T20:05:00', userId:1, desc:'Suspicious individual',                   is_harassment:false },
    { id:87,  type:'Safe Zone',           location:'Kalladka Temple Area',           lat:12.8690, lng:75.0358, severity:'LOW',    status:'confirmed', ts:'2024-12-20T18:10:00', userId:1, desc:'Pilgrim crowd',                           is_harassment:false },
    { id:88,  type:'Harassment',          location:'Kalladka Market',                lat:12.8705, lng:75.0369, severity:'HIGH',   status:'confirmed', ts:'2024-12-20T20:40:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:89,  type:'Safe Zone',           location:'Puttur Bus Stand',               lat:12.7603, lng:75.2010, severity:'LOW',    status:'confirmed', ts:'2024-12-20T18:30:00', userId:1, desc:'Busy station',                            is_harassment:false },
    { id:90,  type:'Unsafe Environment',  location:'Puttur Market Road',             lat:12.7608, lng:75.2035, severity:'LOW',    status:'confirmed', ts:'2024-12-20T21:00:00', userId:1, desc:'Dark lane',                               is_harassment:false },
    { id:91,  type:'Safe Zone',           location:'Moodbidri Temple Area',          lat:13.0658, lng:74.9956, severity:'LOW',    status:'confirmed', ts:'2024-12-21T18:10:00', userId:1, desc:'Tourist and pilgrim area',                is_harassment:false },
    { id:92,  type:'Suspicious Activity', location:'Moodbidri Market',               lat:13.0665, lng:74.9971, severity:'MEDIUM', status:'confirmed', ts:'2024-12-21T19:30:00', userId:1, desc:'Suspicious individual',                   is_harassment:false },
    { id:93,  type:'Harassment',          location:'Moodbidri Bus Stand',            lat:13.0661, lng:74.9965, severity:'HIGH',   status:'confirmed', ts:'2024-12-21T20:45:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:94,  type:'Safe Zone',           location:'Moodbidri Jain Basadi Area',     lat:13.0672, lng:74.9950, severity:'LOW',    status:'confirmed', ts:'2024-12-21T17:50:00', userId:1, desc:'Pilgrim presence',                        is_harassment:false },
    { id:95,  type:'Unsafe Environment',  location:'Moodbidri Bypass Road',          lat:13.0688, lng:74.9982, severity:'LOW',    status:'confirmed', ts:'2024-12-21T21:10:00', userId:1, desc:'Low street lighting',                     is_harassment:false },
    { id:96,  type:'Suspicious Activity', location:'Belman Junction',                lat:13.0861, lng:75.0060, severity:'MEDIUM', status:'confirmed', ts:'2024-12-22T20:00:00', userId:1, desc:'Suspicious parked car',                   is_harassment:false },
    { id:97,  type:'Safe Zone',           location:'Belman Temple Area',             lat:13.0855, lng:75.0049, severity:'LOW',    status:'confirmed', ts:'2024-12-22T18:20:00', userId:1, desc:'Temple security',                         is_harassment:false },
    { id:98,  type:'Harassment',          location:'Belman Market Road',             lat:13.0869, lng:75.0068, severity:'HIGH',   status:'confirmed', ts:'2024-12-22T20:40:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:99,  type:'Safe Zone',           location:'Kinnigoli Bus Stand',            lat:13.0660, lng:74.8791, severity:'LOW',    status:'confirmed', ts:'2024-12-22T18:10:00', userId:1, desc:'Public crowd',                            is_harassment:false },
    { id:100, type:'Unsafe Environment',  location:'Kinnigoli Market Lane',          lat:13.0671, lng:74.8804, severity:'LOW',    status:'confirmed', ts:'2024-12-22T21:05:00', userId:1, desc:'Dim lighting',                            is_harassment:false },
    { id:101, type:'Safe Zone',           location:'Mulki Temple Street',            lat:13.0915, lng:74.7925, severity:'LOW',    status:'confirmed', ts:'2024-12-23T18:10:00', userId:1, desc:'Temple visitors around',                  is_harassment:false },
    { id:102, type:'Suspicious Activity', location:'Mulki Bus Stand',                lat:13.0901, lng:74.7935, severity:'MEDIUM', status:'confirmed', ts:'2024-12-23T19:30:00', userId:1, desc:'Suspicious loitering',                    is_harassment:false },
    { id:103, type:'Harassment',          location:'Mulki Market Area',              lat:13.0890, lng:74.7948, severity:'HIGH',   status:'confirmed', ts:'2024-12-23T20:40:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:104, type:'Safe Zone',           location:'Mulki Riverside Park',           lat:13.0921, lng:74.7915, severity:'LOW',    status:'confirmed', ts:'2024-12-23T17:50:00', userId:1, desc:'Families around',                         is_harassment:false },
    { id:105, type:'Unsafe Environment',  location:'Mulki Bridge Corner',            lat:13.0918, lng:74.7929, severity:'LOW',    status:'confirmed', ts:'2024-12-23T21:05:00', userId:1, desc:'Low visibility',                          is_harassment:false },
    { id:106, type:'Suspicious Activity', location:'Kinnigoli Cross Road',           lat:13.0655, lng:74.8782, severity:'MEDIUM', status:'confirmed', ts:'2024-12-24T20:00:00', userId:1, desc:'Suspicious bike',                         is_harassment:false },
    { id:107, type:'Safe Zone',           location:'Kinnigoli Church Area',          lat:13.0663, lng:74.8798, severity:'LOW',    status:'confirmed', ts:'2024-12-24T18:05:00', userId:1, desc:'Public presence',                         is_harassment:false },
    { id:108, type:'Harassment',          location:'Kinnigoli Market Street',        lat:13.0669, lng:74.8810, severity:'HIGH',   status:'confirmed', ts:'2024-12-24T20:35:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:109, type:'Safe Zone',           location:'Surathkal Market Road',          lat:13.0082, lng:74.7938, severity:'LOW',    status:'confirmed', ts:'2024-12-24T18:15:00', userId:1, desc:'Crowded street',                          is_harassment:false },
    { id:110, type:'Unsafe Environment',  location:'Surathkal Old Port Road',        lat:13.0069, lng:74.7962, severity:'LOW',    status:'confirmed', ts:'2024-12-24T21:00:00', userId:1, desc:'Dim street lights',                       is_harassment:false },
    { id:111, type:'Safe Zone',           location:'Panambur Beach Entrance Road',   lat:12.9542, lng:74.7995, severity:'LOW',    status:'confirmed', ts:'2024-12-25T18:10:00', userId:1, desc:'Tourist activity',                        is_harassment:false },
    { id:112, type:'Suspicious Activity', location:'Panambur Truck Parking',         lat:12.9558, lng:74.8041, severity:'MEDIUM', status:'confirmed', ts:'2024-12-25T19:40:00', userId:1, desc:'Suspicious parked truck',                 is_harassment:false },
    { id:113, type:'Harassment',          location:'Panambur Market Street',         lat:12.9561, lng:74.8022, severity:'HIGH',   status:'confirmed', ts:'2024-12-25T20:55:00', userId:1, desc:'Harassment reported',                     is_harassment:true  },
    { id:114, type:'Safe Zone',           location:'Panambur Park Area',             lat:12.9548, lng:74.7989, severity:'LOW',    status:'confirmed', ts:'2024-12-25T17:55:00', userId:1, desc:'Visitors present',                        is_harassment:false },
    { id:115, type:'Unsafe Environment',  location:'Panambur Port Road',             lat:12.9572, lng:74.8061, severity:'LOW',    status:'confirmed', ts:'2024-12-25T21:05:00', userId:1, desc:'Low lighting',                            is_harassment:false },
    { id:116, type:'Suspicious Activity', location:'Baikampady Junction',            lat:12.9482, lng:74.8339, severity:'MEDIUM', status:'confirmed', ts:'2024-12-26T20:05:00', userId:1, desc:'Suspicious bike riders',                  is_harassment:false },
    { id:117, type:'Safe Zone',           location:'Baikampady Park Area',           lat:12.9490, lng:74.8351, severity:'LOW',    status:'confirmed', ts:'2024-12-26T18:10:00', userId:1, desc:'Industrial security area',                is_harassment:false },
    { id:118, type:'Harassment',          location:'Baikampady Market',              lat:12.9479, lng:74.8345, severity:'HIGH',   status:'confirmed', ts:'2024-12-26T20:40:00', userId:1, desc:'Harassment complaint',                    is_harassment:true  },
    { id:119, type:'Safe Zone',           location:'Kuloor Ferry Road',              lat:12.9175, lng:74.8245, severity:'LOW',    status:'confirmed', ts:'2024-12-26T18:20:00', userId:1, desc:'Ferry commuters present',                 is_harassment:false },
    { id:120, type:'Unsafe Environment',  location:'Kuloor Bridge Edge',             lat:12.9162, lng:74.8261, severity:'LOW',    status:'confirmed', ts:'2024-12-26T21:10:00', userId:1, desc:'Low lighting at bridge edge',             is_harassment:false },
    // ── ADD NEW INCIDENTS BELOW THIS LINE ─────────────────────────────────
    // 1. Add entry with next id (121, 122, ...)
    // 2. Bump SEED_VERSION above from 'v5' to 'v6'
    // 3. Run in browser console: localStorage.removeItem('safara_v2'); location.reload();
  ];

  const defaults = () => ({
    seedVersion: SEED_VERSION,
    users: [
      { id: 1, name: 'Demo User', email: 'user@safara.in',  pw: 'user123',  role: 'user'  },
      { id: 2, name: 'City NGO',  email: 'ngo@safara.in',   pw: 'ngo123',   role: 'ngo'   },
      { id: 3, name: 'Admin',     email: 'admin@safara.in', pw: 'admin123', role: 'admin' }
    ],
    incidents: JSON.parse(JSON.stringify(SEED_INCIDENTS)),
    nextId: 200
  });

  // ── Load with seed-merge logic ────────────────────────────────────────────
  // If SEED_VERSION changed since last save, merge any new seed IDs into the
  // stored data so manual edits to SEED_INCIDENTS always take effect.
  const load = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      if (!stored) return defaults();

      // Seed version unchanged — return stored data as-is (preserves user reports)
      if (stored.seedVersion === SEED_VERSION) return stored;

      // Seed version bumped — merge new seed incidents that aren't already stored
      const storedIds = new Set(stored.incidents.map(i => i.id));
      const newSeeds  = SEED_INCIDENTS.filter(i => !storedIds.has(i.id));
      stored.incidents = [...stored.incidents, ...newSeeds];
      stored.seedVersion = SEED_VERSION;
      save(stored);
      return stored;
    } catch {
      return defaults();
    }
  };
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));

  return {
    getUsers:     ()    => load().users,
    getIncidents: ()    => load().incidents,
    findUser:     (e,p) => load().users.find(u => u.email === e && u.pw === p) || null,
    emailUsed:    (e)   => load().users.some(u => u.email === e),
    addUser(u)    { const d = load(); u.id = d.nextId++; d.users.push(u); save(d); return u; },
    addIncident(i){ const d = load(); i.id = d.nextId++; d.incidents.push(i); save(d); return i; },
    updateIncident(id, changes) {
      const d = load();
      const idx = d.incidents.findIndex(x => x.id == id);
      if (idx >= 0) { d.incidents[idx] = { ...d.incidents[idx], ...changes }; save(d); }
    },
  };
})();

const Session = {
  save:  u  => localStorage.setItem('safara_session', JSON.stringify(u)),
  get:   () => { try { return JSON.parse(localStorage.getItem('safara_session')); } catch { return null; } },
  clear: () => localStorage.removeItem('safara_session'),
};

// ── AI Classification via Claude ──
async function classifyWithLLM(text, location, apiKey) {
  const systemPrompt = `You are a public safety AI embedded in SAFARA, a women's safety navigation app.
Analyze the incident report and respond with valid JSON only — no extra text.
Schema:
{
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "is_harassment": boolean,
  "tags": string[],
  "summary": string,
  "route_advice": string
}
Severity guide:
  LOW    = environmental risk (poor lighting, isolated area)
  MEDIUM = suspicious or threatening behaviour
  HIGH   = direct harassment, physical threat, or assault
Keep summary and route_advice calm and reassuring — never alarming.`;

  const userMsg = `Incident type/description: "${text}"\nLocation: "${location || 'unknown'}"`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(apiKey ? { 'x-api-key': apiKey } : {})
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    const lower = text.toLowerCase();
    const severity = lower.match(/assault|grab|attack|follow/) ? 'HIGH'
                   : lower.match(/suspicious|stare|uncomfortable|unsafe/) ? 'MEDIUM' : 'LOW';
    return {
      severity,
      is_harassment: lower.includes('harass') || lower.includes('follow') || lower.includes('uncomfortable'),
      tags: [],
      summary: 'Report received and queued for review.',
      route_advice: 'SAFARA has noted this location. Safer alternatives will be prioritised for nearby commuters.'
    };
  }
}

// ── Toast ──
const Toast = (() => {
  let container = null;
  const init = () => {
    if (container) return;
    container = document.createElement('div');
    container.className = 'toast-wrap';
    document.body.appendChild(container);
  };
  return {
    show(title, sub = '', icon = '✅') {
      init();
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-text">
          <div class="toast-title">${title}</div>
          ${sub ? `<div class="toast-sub">${sub}</div>` : ''}
        </div>`;
      container.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }
  };
})();

// ── SOS Modal ──
function openSOSModal() {
  const existing = document.getElementById('sos-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'sos-modal';
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="modal-icon">🚨</div>
      <div class="modal-title">Alert Sent</div>
      <div class="modal-body">
        Your location has been shared with nearby authorities.<br/>
        Coordinates: <strong id="sos-coords">Detecting…</strong><br/><br/>
        Stay calm. Move towards a lit, busy area.<br/>
        <strong>Police (100) notified.</strong>
      </div>
      <button class="modal-close" id="sos-close">I'm Safe — Close</button>
    </div>`;
  document.body.appendChild(modal);

  navigator.geolocation?.getCurrentPosition(
    p => { document.getElementById('sos-coords').textContent = `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`; },
    () => { document.getElementById('sos-coords').textContent = 'Bengaluru (fallback)'; }
  );
  modal.addEventListener('click', () => modal.remove());
  document.getElementById('sos-close').addEventListener('click', () => modal.remove());
}

// ── Header renderer ──
function renderHeader(user) {
  const roleBadge = user.role !== 'user'
    ? `<span style="margin-left:8px;font-size:.72rem;padding:2px 9px;border-radius:100px;
        background:${user.role === 'admin' ? '#fef3c7' : '#dbeafe'};
        color:${user.role === 'admin' ? '#b45309' : 'var(--blue)'};
        font-weight:700;text-transform:uppercase;letter-spacing:.04em;">
        ${user.role === 'admin' ? 'Government' : 'NGO'}</span>` : '';
  return `
    <div class="header-brand">
      <div class="header-mark">S</div>
      <span class="header-name">SAFARA</span>
    </div>
    <div class="header-welcome">
      Welcome, <strong>${user.name.split(' ')[0]}</strong>${roleBadge}
    </div>
    <div class="header-actions">
      <button class="header-sos" onclick="openSOSModal()">🚨 SOS</button>
      <button class="header-logout" onclick="handleLogout()">Sign out</button>
    </div>`;
}

// ── Sidebar renderer ──
function renderSidebar(nav, activeId, onNav) {
  window._safaraNav = onNav;
  return `
    <button class="sidebar-toggle" id="sidebar-toggle" onclick="toggleSidebar()" title="Toggle menu">☰</button>
    <div class="sidebar-divider"></div>
    ${nav.map(n => `
      <button class="nav-item${activeId === n.id ? ' active' : ''}" onclick="window._safaraNav('${n.id}')" title="${n.label}" data-nav="${n.id}">
        <span>${n.icon}</span>
        <span class="nav-item-label">${n.label}</span>
      </button>`).join('')}`;
}

function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  sb.classList.toggle('expanded');
  document.getElementById('sidebar-toggle').textContent = sb.classList.contains('expanded') ? '←' : '☰';
}

function handleLogout() {
  Session.clear();
  window.location.href = 'login.html';
}

// ── Guard: redirect to login if not authenticated ──
function requireAuth() {
  const user = Session.get();
  if (!user) { window.location.href = 'login.html'; return null; }
  return user;
}
