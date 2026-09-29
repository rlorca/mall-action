import { StoreDef, FixtureDef, PowerUpType } from "./types";
import { PRNG } from "../utils/prng";

export const STORE_CATALOG: Omit<StoreDef, "cleared" | "hasPackage">[] = [
  // 4F Stores
  {
    id: "forever_12",
    name: "FOREVER 12",
    parodyName: "Forever 21 parody",
    floor: 4,
    role: "TARGET",
    x: 60,
    width: 80,
    windowDisplays: ["Mannequins", "Clothing Rack"],
    theme: "fashion"
  },
  {
    id: "radioshock",
    name: "RADIOSHOCK",
    parodyName: "RadioShack parody",
    floor: 4,
    role: "TARGET",
    x: 220,
    width: 80,
    windowDisplays: ["Flickering TVs", "Walkie-Talkies"],
    theme: "electronics"
  },
  {
    id: "crookstone",
    name: "CROOKSTONE",
    parodyName: "Brookstone parody",
    floor: 4,
    role: "POWERUP",
    x: 380,
    width: 80,
    windowDisplays: ["Massage Chair", "Pedestal Gadgets"],
    theme: "gadgets"
  },
  {
    id: "gamestonk",
    name: "GAMESTONK",
    parodyName: "GameStop parody",
    floor: 4,
    role: "POWERUP",
    x: 540,
    width: 80,
    windowDisplays: ["Cartridges Stack", "Rocket Poster"],
    theme: "games"
  },

  // 3F Stores
  {
    id: "kgb_toys",
    name: "KGB TOYS",
    parodyName: "KB Toys parody",
    floor: 3,
    role: "TARGET",
    x: 100,
    width: 80,
    windowDisplays: ["Teddy Bears in Fur Hats", "Toy Rocket"],
    theme: "toys"
  },
  {
    id: "blockbluster",
    name: "BLOCKBLUSTER VIDEO",
    parodyName: "Blockbuster parody",
    floor: 3,
    role: "CLOSED",
    x: 300,
    width: 80,
    windowDisplays: ["For Lease Sign", "VHS Poster"],
    theme: "closed"
  },
  {
    id: "spenders",
    name: "SPENDER'S GIFTS",
    parodyName: "Spencer's parody",
    floor: 3,
    role: "POWERUP",
    x: 500,
    width: 80,
    windowDisplays: ["Animated Lava Lamp", "Plasma Ball"],
    theme: "novelty"
  },

  // 2F Stores
  {
    id: "sam_baddy",
    name: "SAM BADDY",
    parodyName: "Sam Goody parody",
    floor: 2,
    role: "TARGET",
    x: 60,
    width: 80,
    windowDisplays: ["Tapes & Vinyl", "Boombox"],
    theme: "music"
  },
  {
    id: "sharper_imagine",
    name: "SHARPER IMAGINE",
    parodyName: "Sharper Image parody",
    floor: 2,
    role: "POWERUP",
    x: 220,
    width: 80,
    windowDisplays: ["Robot Vacuum", "Glowing Orb"],
    theme: "gadgets"
  },
  {
    id: "hot_spy",
    name: "HOT SPY ON A STICK",
    parodyName: "Hot Dog on a Stick parody",
    floor: 2,
    role: "TARGET",
    x: 380,
    width: 80,
    windowDisplays: ["Lemonade Tub", "Corn Dogs"],
    theme: "food"
  },
  {
    id: "circuit_pity",
    name: "CIRCUIT PITY",
    parodyName: "Circuit City parody",
    floor: 2,
    role: "CLOSED",
    x: 540,
    width: 80,
    windowDisplays: ["Half-down Shutter", "Dead TVs"],
    theme: "closed"
  },

  // 1F Stores
  {
    id: "foot_lockpicker",
    name: "FOOT LOCKPICKER",
    parodyName: "Foot Locker parody",
    floor: 1,
    role: "TARGET",
    x: 140,
    width: 80,
    windowDisplays: ["Sneaker Wall", "Jersey"],
    theme: "sports"
  },
  {
    id: "borderline_books",
    name: "BORDERLINE BOOKS",
    parodyName: "Borders parody",
    floor: 1,
    role: "CLOSED",
    x: 440,
    width: 80,
    windowDisplays: ["Closing Sale Banner"],
    theme: "closed"
  }
];

/**
 * Generates initial store state for a level loop.
 */
export function createStoreDefs(): StoreDef[] {
  return STORE_CATALOG.map((s) => ({
    ...s,
    cleared: false,
    hasPackage: s.role === "TARGET"
  }));
}

/**
 * Creates room fixtures for top-down 16x11 tile room grid.
 */
export function generateStoreFixtures(
  store: StoreDef,
  prng: PRNG,
  isBlackFriday: boolean
): FixtureDef[] {
  const fixtures: FixtureDef[] = [];
  const powerupOptions: PowerUpType[] = [
    "RAPID", "SPREAD", "ARMOR", "SNEAKERS", "RADAR", "CINNABOMB", "JULIOOZE", "PRETZEL"
  ];

  // Room grid coordinates (tiles 1..14 X, 1..9 Y)
  const locations = [
    { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 10, y: 2 }, { x: 13, y: 2 },
    { x: 3, y: 5 }, { x: 7, y: 5 }, { x: 12, y: 5 },
    { x: 2, y: 8 }, { x: 13, y: 8 }
  ];

  // Pick one fixture to hold the package if target store and not yet cleared
  const packageIndex = store.role === "TARGET" && !store.cleared ? prng.randInt(0, locations.length - 1) : -1;

  locations.forEach((loc, idx) => {
    let content: FixtureDef["content"] = "NOTHING";
    let powerupType: PowerUpType | undefined;

    if (idx === packageIndex) {
      content = "PACKAGE";
    } else if (isBlackFriday || store.role === "POWERUP") {
      content = prng.random() < 0.7 ? "POWERUP" : "NOTHING";
      if (content === "POWERUP") {
        powerupType = prng.randChoice(powerupOptions);
      }
    } else {
      const roll = prng.random();
      if (roll < 0.25) {
        content = "POWERUP";
        powerupType = prng.randChoice(powerupOptions);
      } else if (roll < 0.45) {
        content = "TRAP";
      } else {
        content = "NOTHING";
      }
    }

    fixtures.push({
      id: `${store.id}_fix_${idx}`,
      x: loc.x * 16,
      y: loc.y * 16,
      width: 16,
      height: 16,
      type: store.theme === "fashion" && idx === 0 ? "fitting_room" : "shelf",
      searched: false,
      content,
      powerupType
    });
  });

  return fixtures;
}
