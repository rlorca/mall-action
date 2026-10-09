/**
 * ALL the copy in MALL ACTION lives in this file: jokes, banners, bubbles, headlines, store names.
 * Add a joke here and `tests/copy.test.ts` immediately checks that it fits on screen.
 * (README: "Where to add jokes".)
 */

/** Maximum lengths (characters) so every line fits the 256 px screen. */
export const LIMITS = {
  bubble: 28,
  spygramLine: 21,
  spygramLines: 2,
  comment: 21,
  headline: 26,
  /** PA announcements are wrapped into banner lines of this width. */
  paLine: 30,
  banner: 40,
} as const;

// ---------------------------------------------------------------- SPYGRAM
export interface SpygramPost {
  caption: [string, string];
  comment: string;
}

export const SPYGRAM_ARRIVAL: SpygramPost[] = [
  { caption: ['FEELING CUTE,', 'MIGHT DELETE LATER'], comment: 'MOM: SO PROUD OF U' },
  { caption: ['FIRST DAY ON THE JOB!', '#BLESSED'], comment: 'BOSS: DELETE THIS' },
  { caption: ['MALL RAT? NO.', 'MALL AGENT.'], comment: 'MOM: WEAR A JACKET' },
  { caption: ['ZIPLINE WAS $0.', 'PARKING WAS $12.'], comment: 'DAD: TOLD U SO' },
  { caption: ['OUTFIT OF THE DAY:', 'TRENCHCOAT, AGAIN'], comment: 'FOREVER12: 20% OFF!' },
  { caption: ['NO SPIES WERE HARMED', 'IN THIS SELFIE. YET.'], comment: 'DIMITRI: :(' },
  { caption: ['ROOFTOP VIBES', '#UNDERCOVER'], comment: 'HQ: WHY IS IT PUBLIC' },
  { caption: ["DON'T TELL HQ, I'M", 'HERE FOR PRETZELS'], comment: 'HQ: WE CAN SEE THIS' },
  { caption: ['GOLDEN HOUR.', 'LICENSE TO CHILL.'], comment: 'MOM: CALL YOUR MOTHER' },
  { caption: ['SECRET MISSION.', 'PLEASE LIKE & SHARE'], comment: 'HQ: ...SERIOUSLY?' },
];

export const SPYGRAM_CLEAR: SpygramPost[] = [
  { caption: ['MISSION COMPLETE.', 'ALSO BOUGHT SOCKS.'], comment: 'MOM: WHAT COLOR?' },
  { caption: ['6 PACKAGES.', '0 RECEIPTS. #WIN'], comment: 'RETURNS DESK: NO' },
  { caption: ['SAVED THE WORLD.', 'STILL NO PARKING.'], comment: 'DAD: TYPICAL' },
  { caption: ['SPIES: 0', 'ME: 1 #MALLRAT'], comment: 'BORIS: REMATCH?' },
  { caption: ['GETAWAY CAR:', 'WOOD PANELING. ICONIC'], comment: 'HQ: RETURN THE CAR' },
  { caption: ['TREATED MYSELF TO A', 'CINNABOMB. EARNED IT.'], comment: 'MOM: EAT A VEGGIE' },
  { caption: ['HQ SAID KEEP IT QUIET', 'SO HERE IS A POST'], comment: "HQ: YOU'RE FIRED" },
  { caption: ['FOUND A PET ROCK.', 'HIS NAME IS KEVIN.'], comment: 'KEVIN: ...' },
  { caption: ['BRB, RETURNING 6', 'SUSPICIOUS PACKAGES'], comment: 'MALL COP: WAIT WHAT' },
  { caption: ['SEE YOU NEXT LOOP,', 'FOOD COURT'], comment: 'HOT SPY: <3<3<3' },
];

// ---------------------------------------------------------------- first-visit store lines
/** Speech bubbles over the guards. `who` is the guard index (0 = first spy, 'bot' = the security bot). */
export interface StoreLine {
  who: number | 'bot';
  text: string;
}
export const FIRST_VISIT_LINES: Record<string, StoreLine[]> = {
  kgbtoys: [
    { who: 0, text: "DIMITRI, HE'S HERE!" },
    { who: 1, text: 'DA! HIDE THE TEDDIES!' },
  ],
  forever12: [
    { who: 0, text: "IT'S NOT A DISGUISE." },
    { who: 1, text: "IT'S A LOOK, SERGEI." },
  ],
  radioshock: [
    { who: 0, text: "YOU'LL NEED BATTERIES." },
    { who: 'bot', text: 'BEEP. NOT INCLUDED.' },
  ],
  hotspy: [{ who: 0, text: 'WANT FRIES WITH THAT?' }],
  footlock: [
    { who: 0, text: 'THESE ARE MY GETAWAY SHOES' },
    { who: 1, text: 'BOTH LEFT FEET, COMRADE' },
  ],
  sambaddy: [{ who: 0, text: 'TURN IT UP, BORIS!' }],
  crookstone: [{ who: 0, text: 'TRY THE MASSAGE CHAIR...' }],
  sharper: [{ who: 'bot', text: "BEEP. PLEASE DON'T TOUCH." }],
  spenders: [{ who: 0, text: 'WHOA... THE LAVA LAMP...' }],
};

// ---------------------------------------------------------------- spies
export const SPY_LAST_WORDS = [
  'I WAS JUST BROWSING!',
  "WHAT'S YOUR RETURN POLICY?!",
  'I HAD A COUPON!',
  'TELL MY CAT...',
  'NOT THE FACE!',
  'I WAS ON MY LUNCH BREAK!',
  'WORTH IT. 70% OFF.',
  'MY RECEIPT...',
];

export const SPY_ELEVATOR_LINES = [
  '...NICE WEATHER.',
  'GOING DOWN? ME TOO.',
  '*AWKWARD COUGH*',
  'THIS IS MY FLOOR, ACTUALLY',
];

// ---------------------------------------------------------------- PA + newspaper
export const PA_LINES = [
  'ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.',
  'FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.',
  "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
  'LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.',
  'BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.',
  'THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.',
  'A REMINDER: SECURITY IS WATCHING. MOSTLY TV.',
];

export const HEADLINES = [
  'LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING',
  'SPIES FOILED; FOOD COURT SALES UP 300%',
  "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
  "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
  'GAMESTONK SHARE PRICE DOWN ANOTHER 99%',
];

// ---------------------------------------------------------------- misc one-liners
export const MISC = {
  walkerHey: 'HEY!',
  copWhistle: 'HEY! STOP RIGHT THERE!',
  copCaught: 'DETAINED! -500',
  fittingShriek: 'OCCUPIED!!',
  trap: "IT'S A TRAP!",
  nothing: 'NOTHING HERE',
  alarm: 'ALARM! SECURITY ALERTED',
  blackFriday1: 'BLACK FRIDAY!',
  blackFriday2: '70% OFF EVERYTHING',
  gamestonkClerk: "IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
  nowPlaying: 'NOW PLAYING: SIDE B',
  closed1: 'ATTENTION SHOPPERS:',
  closed2: 'THE MALL IS NOW CLOSED',
  levelClearReceipt: 'WAIT! YOUR RECEIPT!',
  photoStrip: 'PHOTO STRIP GET!',
  mallDirectory: 'MALL DIRECTORY',
  pressStart: 'PRESS START',
  subtitle: 'A SHOPPING MALL ESPIONAGE',
  copyright: '(C) 2026 FLICKERSOFT',
  hint: 'Z SHOOT  X JUMP/SEARCH  SHIFT MAP',
  continueQ: 'CONTINUE?',
  gameOver: 'GAME OVER',
  dailyMall: 'THE DAILY MALL',
} as const;

/** Joke items from the GameStonk easter egg (+1 point, goes in the inventory). */
export const JOKE_ITEMS = [
  'EXPIRED COUPON',
  'PRE-OWNED STRATEGY GUIDE',
  'PET ROCK',
  'MOOD RING',
  '1 SHARE (DOWN 99%)',
] as const;

// ---------------------------------------------------------------- floors
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'] as const;
export const FLOOR_BANNERS = [
  'R - ROOF, SKY & SPIES',
  '4F - FASHION & GADGETS, SPIES',
  '3F - TOYS & GIFTS, SPIES',
  '2F - MUSIC & SNACKS, SPIES',
  '1F - SHOES & BOOKS, SPIES',
  'P - PARKING, GOING HOME',
];

// ---------------------------------------------------------------- stores
export type StoreId =
  | 'forever12'
  | 'radioshock'
  | 'crookstone'
  | 'gamestonk'
  | 'kgbtoys'
  | 'blockblustar'
  | 'spenders'
  | 'sambaddy'
  | 'sharper'
  | 'hotspy'
  | 'circuitpity'
  | 'footlock'
  | 'borderline';

export type StoreRole = 'target' | 'powerup' | 'closed';

export interface StoreInfo {
  id: StoreId;
  /** Sign text (tiny font, <= 20 chars). */
  name: string;
  /** Bottom-strip / marquee name inside the store. */
  longName: string;
  parody: string;
  floor: number; // index into FLOOR_NAMES (1 = 4F ... 4 = 1F)
  role: StoreRole;
}

export const STORES: StoreInfo[] = [
  { id: 'forever12', name: 'FOREVER 12', longName: 'FOREVER 12', parody: 'Forever 21', floor: 1, role: 'target' },
  { id: 'radioshock', name: 'RADIOSHOCK', longName: 'RADIOSHOCK', parody: 'RadioShack', floor: 1, role: 'target' },
  { id: 'crookstone', name: 'CROOKSTONE', longName: 'CROOKSTONE', parody: 'Brookstone', floor: 1, role: 'powerup' },
  { id: 'gamestonk', name: 'GAMESTONK', longName: 'GAMESTONK', parody: 'GameStop', floor: 1, role: 'powerup' },
  { id: 'kgbtoys', name: 'KGB TOYS', longName: 'KGB TOYS', parody: 'KB Toys', floor: 2, role: 'target' },
  { id: 'blockblustar', name: 'BLOCKBLUSTER VIDEO', longName: 'BLOCKBLUSTER VIDEO', parody: 'Blockbuster', floor: 2, role: 'closed' },
  { id: 'spenders', name: "SPENDER'S GIFTS", longName: "SPENDER'S GIFTS", parody: "Spencer's", floor: 2, role: 'powerup' },
  { id: 'sambaddy', name: 'SAM BADDY', longName: 'SAM BADDY', parody: 'Sam Goody', floor: 3, role: 'target' },
  { id: 'sharper', name: 'SHARPER IMAGINE', longName: 'SHARPER IMAGINE', parody: 'Sharper Image', floor: 3, role: 'powerup' },
  { id: 'hotspy', name: 'HOT SPY ON A STICK', longName: 'HOT SPY ON A STICK', parody: 'Hot Dog on a Stick', floor: 3, role: 'target' },
  { id: 'circuitpity', name: 'CIRCUIT PITY', longName: 'CIRCUIT PITY', parody: 'Circuit City', floor: 3, role: 'closed' },
  { id: 'footlock', name: 'FOOT LOCKPICKER', longName: 'FOOT LOCKPICKER', parody: 'Foot Locker', floor: 4, role: 'target' },
  { id: 'borderline', name: 'BORDERLINE BOOKS', longName: 'BORDERLINE BOOKS', parody: 'Borders', floor: 4, role: 'closed' },
];

export function storeInfo(id: StoreId): StoreInfo {
  const s = STORES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown store ${id}`);
  return s;
}

// ---------------------------------------------------------------- power-up display names
export const POWERUP_NAMES = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  armor: 'ARMOR VEST',
  sneakers: 'SNEAKERS',
  radar: 'RADAR',
  oneup: '1-UP',
  cinnabomb: 'CINNABOMB',
  juice: 'ORANGE JULI-OOZE',
  pretzel: 'SOFT PRETZEL',
} as const;


// ---------------------------------------------------------------- UI labels (every on-screen word lives here)
export const UI = {
  titleWord1: 'MALL',
  titleWord2: 'ACTION',
  hint1: 'ARROWS:MOVE  Z:SHOOT  X:JUMP/SEARCH',
  hint2: 'SHIFT:MAP  ENTER:PAUSE  C:CRT  M:MUTE',
  hiScore: 'HI-SCORE',
  score: 'SCORE',
  blackFridayMode: 'BLACK FRIDAY MODE',
  spygram: 'SPYGRAM',
  spygramHandle: '@AGENT_RED',
  likes: 'LIKES',
  agoStamp: '2M AGO',
  youAreHere: 'YOU ARE HERE',
  legendPackage: 'PACKAGE',
  legendCleared: 'CLEARED',
  legendPowerup: 'POWER-UP',
  legendClosed: 'CLOSED',
  legendCar: 'CAR',
  legendYou: 'YOU',
  legendRadar: 'RADAR',
  exit: 'EXIT',
  items: 'ITEMS: ',
  itemsNone: 'ITEMS: NONE YET',
  pause: 'PAUSE',
  missionComplete: 'MISSION COMPLETE!',
  levelClear: 'LEVEL CLEAR!',
  packages: 'PACKAGES',
  time: 'TIME',
  timeBonus: 'TIME BONUS',
  clearBonus: 'CLEAR BONUS',
  loop: 'LOOP',
  go: 'GO!',
  filePhoto: 'FILE PHOTO',
  lateEdition: 'LATE EDITION  *  25 CENTS',
  newsFiller: 'MALL WALKERS CLUB MEETS',
  continuesLeft: 'CONTINUES LEFT: ',
  thanks: 'THANKS FOR SHOPPING',
  pressAnyButton: 'PRESS ANY BUTTON',
  directory: 'DIRECTORY',
  kioskNearest: 'NEAREST PACKAGE: FLASHING',
  kioskAllFound: 'ALL PACKAGES FOUND - GO TO P!',
  photoStrip: 'PHOTO STRIP',
  extraLife: 'EXTRA LIFE!',
  armorBroke: 'ARMOR BROKE!',
  pressToSearch: 'PRESS X TO SEARCH',
  searching: 'SEARCHING...',
  alarmHud: 'ALARM',
  pkgHud: 'PKG',
} as const;

/** Short names for the 16 px HUD strip (tiny font). */
export const POWERUP_HUD_NAMES = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  armor: 'ARMOR',
  sneakers: 'SNEAKERS',
  radar: 'RADAR',
  oneup: '1-UP',
  cinnabomb: 'CINNABOMB',
  juice: 'JULI-OOZE',
  pretzel: 'PRETZEL',
} as const;

export const packagesLeftText = (n: number) => `PACKAGES LEFT: ${n}`;
export const packageNText = (n: number) => `PACKAGE ${n}/6`;
export const youGotText = (item: string) => `YOU GOT: ${item}`;
export const nextLoopText = (n: number) => `NEXT: LOOP ${n} - HARDER`;

/** Every line that must respect a length limit, labelled; used by tests. */
export function allCopyChecks(): { label: string; text: string; max: number }[] {
  const out: { label: string; text: string; max: number }[] = [];
  const bubble = (label: string, text: string) => out.push({ label, text, max: LIMITS.bubble });
  for (const [store, lines] of Object.entries(FIRST_VISIT_LINES)) lines.forEach((l, i) => bubble(`firstVisit ${store}#${i}`, l.text));
  SPY_LAST_WORDS.forEach((t, i) => bubble(`lastWords#${i}`, t));
  SPY_ELEVATOR_LINES.forEach((t, i) => bubble(`elevatorLine#${i}`, t));
  for (const [name, list] of [
    ['arrival', SPYGRAM_ARRIVAL],
    ['clear', SPYGRAM_CLEAR],
  ] as const) {
    list.forEach((p, i) => {
      p.caption.forEach((c, j) => out.push({ label: `spygram ${name}#${i} caption${j}`, text: c, max: LIMITS.spygramLine }));
      out.push({ label: `spygram ${name}#${i} comment`, text: p.comment, max: LIMITS.comment });
    });
  }
  HEADLINES.forEach((h, i) => wrapLines(h, LIMITS.headline).forEach((l, j) => out.push({ label: `headline#${i} line${j}`, text: l, max: LIMITS.headline })));
  PA_LINES.forEach((h, i) => wrapLines(h, LIMITS.paLine).forEach((l, j) => out.push({ label: `pa#${i} line${j}`, text: l, max: LIMITS.paLine })));
  JOKE_ITEMS.forEach((t, i) => out.push({ label: `jokeItem#${i}`, text: youGotText(t), max: LIMITS.banner }));
  FLOOR_BANNERS.forEach((t, i) => out.push({ label: `floorBanner#${i}`, text: t, max: LIMITS.banner }));
  for (const [k, v] of Object.entries(MISC)) {
    if (k === 'gamestonkClerk') continue; // typewriter box wraps it
    out.push({ label: `misc.${k}`, text: v, max: LIMITS.banner });
  }
  for (const [k, v] of Object.entries(UI)) out.push({ label: `ui.${k}`, text: v, max: LIMITS.banner });
  for (const [k, v] of Object.entries(POWERUP_HUD_NAMES)) out.push({ label: `hudName.${k}`, text: v, max: 11 });
  for (const n of [0, 1, 6]) out.push({ label: `packagesLeft(${n})`, text: packagesLeftText(n), max: LIMITS.banner }, { label: `packageN(${n})`, text: packageNText(n), max: LIMITS.banner });
  out.push({ label: 'nextLoop', text: nextLoopText(99), max: LIMITS.banner });
  out.push({ label: 'continuesLeft', text: UI.continuesLeft + '3', max: LIMITS.banner });
  return out;
}

/** Greedy word wrap to `width` characters. Words longer than `width` stay on their own line. */
export function wrapLines(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
