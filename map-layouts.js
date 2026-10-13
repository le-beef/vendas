// Centers measured from the exact map images supplied for the event editor.
export const SALON_LAYOUTS = Object.freeze(["6x4", "6x5", "7x5", "8x5"]);

// The two premium bands are mapped to the supplied position images, not to table numbers.
// Indices are zero-based and remain valid even when only some positions are activated.
const salonSectorSlots = {
  "6x4": { gold:[5, 6, 10, 14, 18], silver:[0, 1, 2, 7, 11, 15, 19] },
  "6x5": { gold:[6, 7, 12, 17, 22], silver:[0, 1, 2, 8, 13, 18, 23] },
  "7x5": { gold:[6, 7, 12, 17, 22, 27], silver:[0, 1, 2, 8, 13, 18, 23, 28] },
  "8x5": { gold:[6, 7, 12, 17, 22, 27, 32], silver:[0, 1, 2, 8, 13, 18, 23, 28, 33] }
};

export function salonSectorForSlot(layout, slotId) {
  if (!SALON_LAYOUTS.includes(layout)) return "regular";
  const match = String(slotId || "").match(/^slot-salao-([0-9]x[0-9])-([0-9]{2})$/);
  if (!match || match[1] !== layout) return "regular";
  const index = Number(match[2]) - 1;
  if (salonSectorSlots[layout].gold.includes(index)) return "gold";
  if (salonSectorSlots[layout].silver.includes(index)) return "silver";
  return "regular";
}

const salonPositions = {
  "6x4": [
    [70, 122], [207, 155], [319, 155], [431, 155], [543, 155], [107, 195],
    [206, 266], [319, 266], [431, 266], [543, 266],
    [207, 378], [319, 378], [431, 378], [543, 378],
    [207, 489], [319, 489], [431, 489], [543, 489],
    [206, 600], [319, 601], [431, 601], [543, 601],
    [319, 712], [431, 712], [543, 712]
  ],
  "6x5": [
    [71, 122], [184, 130], [271, 130], [362, 130], [450, 130], [538, 130], [108, 195],
    [207, 246], [293, 246], [383, 246], [470, 246], [558, 246],
    [207, 361], [293, 361], [383, 361], [470, 361], [558, 361],
    [207, 477], [293, 477], [383, 477], [470, 477], [558, 477],
    [207, 593], [293, 593], [383, 593], [470, 593], [558, 593],
    [293, 708], [383, 708], [470, 708], [558, 708]
  ],
  "7x5": [
    [71, 122], [184, 130], [271, 130], [362, 130], [450, 130], [538, 130], [108, 195],
    [207, 226], [293, 226], [383, 226], [470, 226], [558, 226],
    [207, 322], [293, 322], [383, 322], [470, 322], [558, 322],
    [207, 418], [293, 418], [383, 418], [470, 418], [558, 418],
    [207, 514], [293, 514], [383, 514], [470, 514], [558, 514],
    [207, 611], [293, 611], [383, 611], [470, 610], [558, 610],
    [293, 705], [383, 705], [470, 705], [558, 705]
  ],
  "8x5": [
    [70, 122], [204, 120], [283, 120], [366, 120], [446, 120], [527, 120], [107, 195],
    [202, 204], [292, 204], [382, 204], [473, 204], [563, 204],
    [202, 288], [292, 288], [383, 288], [473, 288], [563, 288],
    [202, 372], [292, 372], [382, 372], [473, 372], [564, 372],
    [202, 457], [292, 457], [382, 457], [473, 457], [563, 457],
    [202, 541], [292, 541], [382, 541], [473, 541], [563, 541],
    [202, 625], [292, 625], [382, 625], [473, 625], [563, 625],
    [303, 718], [385, 718], [465, 718], [545, 718]
  ]
};

const mezzaninePositions = [
  [523, 135], [523, 240], [523, 346], [523, 452], [523, 558], [523, 664],
  [287, 747], [381, 747], [476, 747],
  [287, 845], [378, 845], [468, 845], [559, 845]
];

export function validMapLayout(area, layout) {
  return area === "mezanino" ? layout === "13" : area === "salao" && SALON_LAYOUTS.includes(layout);
}

export function presetSlotsFor(area, layout) {
  if (!validMapLayout(area, layout)) return [];
  const points = area === "mezanino" ? mezzaninePositions : salonPositions[layout];
  const imageWidth = area === "mezanino" ? 925 : layout === "6x5" || layout === "7x5" ? 914 : 913;
  const imageHeight = area === "mezanino" ? 960 : 957;
  return points.map(([px, py], index) => ({
    id: `slot-${area}-${layout}-${String(index + 1).padStart(2, "0")}`,
    area,
    x: Math.round(px / imageWidth * 10000) / 100,
    y: Math.round(py / imageHeight * 10000) / 100,
    width: area === "mezanino" ? 7 : 6.4,
    height: area === "mezanino" ? 7 : 6.4
  }));
}
