// ALL player-facing copy lives here. To add a joke, add it to the right list below.
// tests/copy.test.ts checks that every line fits its limit, so keep these within the limits:
//   speech bubbles 28 chars, SPYGRAM caption lines 21 chars (2 lines max),
//   SPYGRAM comments 21 chars, THE DAILY MALL headline lines 26 chars,
//   banners and PA lines 32 chars.

export const LIMITS = {
  bubble: 28,
  spygramCaption: 21,
  spygramCaptionLines: 2,
  spygramComment: 21,
  headline: 26,
  headlineLines: 3,
  banner: 32,
} as const;

export interface SpygramPost {
  caption: readonly string[];
  comment: string;
  author: string;
}

export const SPYGRAM_ARRIVAL: readonly SpygramPost[] = [
  { caption: ['FEELING CUTE,', 'MIGHT DELETE LATER'], author: 'MOM', comment: 'MOM: SO PROUD OF U' },
  { caption: ['FIRST DAY ON THE JOB!', '#BLESSED'], author: 'BOSS', comment: 'BOSS: DELETE THIS' },
  { caption: ['MALL RAT? NO.', 'MALL AGENT.'], author: 'MOM', comment: 'MOM: WEAR A JACKET' },
  { caption: ['ZIPLINE WAS $0.', 'PARKING WAS $12.'], author: 'DAD', comment: 'DAD: TOLD U SO' },
  { caption: ['OUTFIT OF THE DAY:', 'TRENCHCOAT, AGAIN'], author: 'FOREVER12', comment: 'FOREVER12: 20% OFF!' },
  { caption: ['NO SPIES WERE HARMED', 'IN THIS SELFIE. YET.'], author: 'DIMITRI', comment: 'DIMITRI: :(' },
  { caption: ['ROOFTOP VIBES', '#UNDERCOVER'], author: 'HQ', comment: 'HQ: WHY IS IT PUBLIC' },
  { caption: ["DON'T TELL HQ, I'M", 'HERE FOR PRETZELS'], author: 'HQ', comment: 'HQ: WE CAN SEE THIS' },
  { caption: ['GOLDEN HOUR.', 'LICENSE TO CHILL.'], author: 'MOM', comment: 'MOM: CALL YOUR MOTHER' },
  { caption: ['SECRET MISSION.', 'PLEASE LIKE & SHARE'], author: 'HQ', comment: 'HQ: ...SERIOUSLY?' },
];

export const SPYGRAM_COMPLETE: readonly SpygramPost[] = [
  { caption: ['MISSION COMPLETE.', 'ALSO BOUGHT SOCKS.'], author: 'MOM', comment: 'MOM: WHAT COLOR?' },
  { caption: ['6 PACKAGES.', '0 RECEIPTS. #WIN'], author: 'RETURNS DESK', comment: 'RETURNS DESK: NO' },
  { caption: ['SAVED THE WORLD.', 'STILL NO PARKING.'], author: 'DAD', comment: 'DAD: TYPICAL' },
  { caption: ['SPIES: 0', 'ME: 1 #MALLRAT'], author: 'BORIS', comment: 'BORIS: REMATCH?' },
  { caption: ['GETAWAY CAR:', 'WOOD PANELING. ICONIC'], author: 'HQ', comment: 'HQ: RETURN THE CAR' },
  { caption: ['TREATED MYSELF TO A', 'CINNABOMB. EARNED IT.'], author: 'MOM', comment: 'MOM: EAT A VEGGIE' },
  { caption: ['HQ SAID KEEP IT QUIET', 'SO HERE IS A POST'], author: 'HQ', comment: "HQ: YOU'RE FIRED" },
  { caption: ['FOUND A PET ROCK.', 'HIS NAME IS KEVIN.'], author: 'KEVIN', comment: 'KEVIN: ...' },
  { caption: ['BRB, RETURNING 6', 'SUSPICIOUS PACKAGES'], author: 'MALL COP', comment: 'MALL COP: WAIT WHAT' },
  { caption: ['SEE YOU NEXT LOOP,', 'FOOD COURT'], author: 'HOT SPY', comment: 'HOT SPY: ♥♥♥' },
];

/** THE DAILY MALL front page. Each headline is pre-split into lines. */
export const HEADLINES: readonly (readonly string[])[] = [
  ['LOCAL AGENT FINDS 6', 'PACKAGES, STILL NO PARKING'],
  ['SPIES FOILED; FOOD COURT', 'SALES UP 300%'],
  ['MAN ZIPLINES ONTO ROOF.', "SECURITY 'NOT SURPRISED'"],
  ['MALL WALKERS DEMAND', "APOLOGY FOR 'HEY!'", 'INCIDENT'],
  ['GAMESTONK SHARE PRICE', 'DOWN ANOTHER 99%'],
];

export const PA_LINES: readonly (readonly string[])[] = [
  ['ATTENTION SHOPPERS:', 'CLEANUP ON 3F. AGAIN.'],
  ['FREE SAMPLES AT HOT SPY.', 'NOT POISONED. PROBABLY.'],
  ['WILL THE OWNER OF A BLACK VAN', "MARKED 'NOT SPIES'", 'PLEASE MOVE IT.'],
  ['LOST CHILD AT THE 2F KIOSK.', 'SAYS HIS NAME IS AGENT 7.'],
  ['BLOCKBLUSTER IS STILL', 'CLOSED. BE KIND, REWIND.'],
  ['THE MALL CLOSES AT 9.', 'SPIES CLOSE AT NEVER.'],
  ['A REMINDER: SECURITY IS', 'WATCHING. MOSTLY TV.'],
];

/** First-visit store lines: spoken by the guards, one line about 1 s after the other. */
export const STORE_FIRST_VISIT: Readonly<Record<string, readonly string[]>> = {
  KGB_TOYS: ["DIMITRI, HE'S HERE!", 'DA! HIDE THE TEDDIES!'],
  FOREVER12: ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
  RADIOSHOCK: ["YOU'LL NEED BATTERIES.", 'BEEP. NOT INCLUDED.'],
  HOT_SPY: ['WANT FRIES WITH THAT?'],
  FOOT_LOCKPICKER: ['THESE ARE MY GETAWAY SHOES', 'BOTH LEFT FEET, COMRADE'],
  SAM_BADDY: ['TURN IT UP, BORIS!'],
  CROOKSTONE: ['TRY THE MASSAGE CHAIR...'],
  SHARPER_IMAGINE: ["BEEP. PLEASE DON'T TOUCH."],
  SPENDERS_GIFTS: ['WHOA... THE LAVA LAMP...'],
};

export const SPY_LAST_WORDS: readonly string[] = [
  'I WAS JUST BROWSING!',
  "WHAT'S YOUR RETURN POLICY?!",
  'I HAD A COUPON!',
  'TELL MY CAT...',
  'NOT THE FACE!',
  'I WAS ON MY LUNCH BREAK!',
  'WORTH IT. 70% OFF.',
  'MY RECEIPT...',
];

export const SPY_ELEVATOR_LINES: readonly string[] = [
  '...NICE WEATHER.',
  'GOING DOWN? ME TOO.',
  '*AWKWARD COUGH*',
  'THIS IS MY FLOOR, ACTUALLY',
];

export const FLOOR_ANNOUNCE: Readonly<Record<string, string>> = {
  R: 'R - ROOF, FRESH AIR, SPIES',
  '4F': '4F - FASHION & GADGETS, SPIES',
  '3F': '3F - TOYS & MUSIC, SPIES',
  '2F': '2F - FOOD COURT, SPIES',
  '1F': '1F - SPORTS & BOOKS, SPIES',
  P: 'P - PARKING, SPIES',
};

/** Output of the GameStonk easter egg. Useless items, worth +1 point each. */
export const EASTER_EGG_ITEMS: readonly string[] = [
  'EXPIRED COUPON',
  'PRE-OWNED STRATEGY GUIDE',
  'PET ROCK',
  'MOOD RING',
  '1 SHARE (DOWN 99%)',
];
export const EASTER_EGG_LINES: readonly string[] = ["IT'S DANGEROUS TO GO", 'ALONE! TAKE THIS.'];

export const OCCUPIED_LINE = 'OCCUPIED!!';
export const WALKER_LINE = 'HEY!';
export const COP_LINE = 'HEY! STOP RIGHT THERE!';
export const DETAINED_LINE = 'DETAINED! -500';
export const TRAP_BANNER = "IT'S A TRAP!";
export const NOTHING_BANNER = 'NOTHING HERE';
export const ALARM_BANNER = 'ALARM! SECURITY ALERTED';
export const BLACK_FRIDAY_LINES = ['BLACK FRIDAY!', '70% OFF EVERYTHING'];
export const SIDE_B_BANNER = 'NOW PLAYING: SIDE B';

export const SHOP_LINES = {
  mallClosed: ['ATTENTION SHOPPERS:', 'THE MALL IS NOW CLOSED'],
  gameOver: 'GAME OVER',
  continueQ: 'CONTINUE?',
  pause: 'PAUSE',
  mapTitle: 'MALL DIRECTORY',
  pressStart: 'PRESS START',
  subtitle: 'A SHOPPING MALL ESPIONAGE',
  copyright: '(C) 2026 FLICKERSOFT',
  controlHint: 'ARROWS MOVE  Z SHOOT  X JUMP',
  presents: 'PRESENTS',
  studio: 'FLICKERSOFT',
  levelClear: 'LEVEL CLEAR',
  bonus: 'BONUS',
  loop: (n: number): string => `LOOP ${n}`,
};

export const pkgBanner = (n: number): string => `PACKAGE ${n}/6`;
export const pkgsLeftBanner = (n: number): string => `PACKAGES LEFT: ${n}`;
export const continuesLeft = (n: number): string => `CONTINUES LEFT: ${n}`;
export const youGot = (item: string): string => `YOU GOT: ${item}`;
export const crtBanner = (on: boolean): string => (on ? 'CRT ON' : 'CRT OFF');
export const soundBanner = (on: boolean): string => (on ? 'SOUND ON' : 'SOUND OFF');

/** Every line of copy, flattened, for the fit tests. */
export function allLines(): { where: string; text: string; limit: number }[] {
  const out: { where: string; text: string; limit: number }[] = [];
  const add = (where: string, text: string, limit: number): void => void out.push({ where, text, limit });
  SPYGRAM_ARRIVAL.forEach((p, i) => {
    p.caption.forEach((l) => add(`arrival ${i} caption`, l, LIMITS.spygramCaption));
    add(`arrival ${i} comment`, p.comment, LIMITS.spygramComment);
  });
  SPYGRAM_COMPLETE.forEach((p, i) => {
    p.caption.forEach((l) => add(`complete ${i} caption`, l, LIMITS.spygramCaption));
    add(`complete ${i} comment`, p.comment, LIMITS.spygramComment);
  });
  HEADLINES.forEach((h, i) => h.forEach((l) => add(`headline ${i}`, l, LIMITS.headline)));
  PA_LINES.forEach((h, i) => h.forEach((l) => add(`pa ${i}`, l, LIMITS.banner)));
  Object.entries(STORE_FIRST_VISIT).forEach(([k, lines]) => lines.forEach((l) => add(`first visit ${k}`, l, LIMITS.bubble)));
  SPY_LAST_WORDS.forEach((l, i) => add(`last words ${i}`, l, LIMITS.bubble));
  SPY_ELEVATOR_LINES.forEach((l, i) => add(`elevator line ${i}`, l, LIMITS.bubble));
  Object.entries(FLOOR_ANNOUNCE).forEach(([k, l]) => add(`floor ${k}`, l, LIMITS.banner));
  EASTER_EGG_ITEMS.forEach((l, i) => add(`egg item ${i}`, l, LIMITS.banner));
  EASTER_EGG_LINES.forEach((l, i) => add(`egg line ${i}`, l, LIMITS.bubble));
  [OCCUPIED_LINE, WALKER_LINE, COP_LINE, DETAINED_LINE, TRAP_BANNER, NOTHING_BANNER, ALARM_BANNER, SIDE_B_BANNER]
    .forEach((l, i) => add(`banner ${i}`, l, LIMITS.banner));
  BLACK_FRIDAY_LINES.forEach((l, i) => add(`black friday ${i}`, l, LIMITS.banner));
  Object.entries(SHOP_LINES).forEach(([k, v]) => {
    if (typeof v === 'string') add(`shop ${k}`, v, LIMITS.banner);
    else if (Array.isArray(v)) v.forEach((l) => add(`shop ${k}`, l, LIMITS.banner));
  });
  return out;
}
