globalThis.MallData = (() => {
  const names = Copy.stores;
  const roles = ["TTUU", "TCU", "TUTC", "TC"].join("");
  const layouts = [
    "3,3 8,3 12,3 4,7 10,7",
    "2,3 6,3 11,4 5,7 12,7",
    "3,4 7,3 11,3 3,7 11,7",
    "2,4 12,4 4,7 10,7",
    "2,3 6,4 11,3 3,7 9,7",
    "",
    "3,3 7,4 11,3 5,7 12,7",
    "2,4 5,3 11,3 4,7 10,6",
    "3,3 8,4 12,3 3,7 11,6",
    "2,3 6,3 10,3 4,7 12,7",
    "",
    "3,4 7,3 12,4 2,7 10,7",
    "",
  ];
  const stores = names.map((name, i) => ({
    name,
    id: i,
    f: [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4][i],
    x: [144, 306, 486, 674, 160, 346, 520, 146, 334, 498, 677, 154, 490][i],
    role: roles[i],
    theme: [0, 1, 2, 3, 4, 1, 5, 6, 2, 7, 1, 8, 0][i],
    layout: layouts[i]
      ? layouts[i].split(" ").map((pair) => pair.split(",").map(Number))
      : [],
  }));
  return {
    stores,
    floors: Copy.levels,
    floorY: (f) => 72 + 48 * f,
    shafts: [
      [66, 0, 3],
      [420, 1, 5],
      [600, 0, 4],
    ],
    stairs: [
      [240, 1],
      [240, 3],
    ],
    kiosk: 397,
    booth: 676,
    fountain: 82,
    car: 322,
    powers: Copy.powers,
  };
})();
