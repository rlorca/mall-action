/**
 * ALL player-facing copy lives here: jokes, banners, names. Edit freely;
 * tests/copy.test.ts checks every line still fits on screen.
 *
 * Limits: speech bubbles <= 28 chars, SPYGRAM caption lines <= 21 chars (2 lines max),
 * comments <= 21 chars, headline lines <= 26 chars.
 */
export const LIMITS = { bubble: 28, caption: 21, comment: 21, headline: 26, banner: 40 } as const;

export interface SpygramPost {
  caption: [string, string] | [string];
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

export const SPYGRAM_COMPLETE: SpygramPost[] = [
  { caption: ['MISSION COMPLETE.', 'ALSO BOUGHT SOCKS.'], comment: 'MOM: WHAT COLOR?' },
  { caption: ['6 PACKAGES.', '0 RECEIPTS. #WIN'], comment: 'RETURNS DESK: NO' },
  { caption: ['SAVED THE WORLD.', 'STILL NO PARKING.'], comment: 'DAD: TYPICAL' },
  { caption: ['SPIES: 0', 'ME: 1 #MALLRAT'], comment: 'BORIS: REMATCH?' },
  { caption: ['GETAWAY CAR:', 'WOOD PANELING. ICONIC'], comment: 'HQ: RETURN THE CAR' },
  { caption: ['TREATED MYSELF TO A', 'CINNABOMB. EARNED IT.'], comment: 'MOM: EAT A VEGGIE' },
  { caption: ['HQ SAID KEEP IT QUIET', 'SO HERE IS A POST'], comment: "HQ: YOU'RE FIRED" },
  { caption: ['FOUND A PET ROCK.', 'HIS NAME IS KEVIN.'], comment: 'KEVIN: ...' },
  { caption: ['BRB, RETURNING 6', 'SUSPICIOUS PACKAGES'], comment: 'MALL COP: WAIT WHAT' },
  { caption: ['SEE YOU NEXT LOOP,', 'FOOD COURT'], comment: 'HOT SPY: ♥♥♥' },
];

/** A speaker is 'spy' (first spy guard), 'spy2' (second spy guard) or 'bot'. */
export interface StoreLine {
  who: 'spy' | 'spy2' | 'bot';
  text: string;
}

export const FIRST_VISIT_LINES: Record<string, StoreLine[]> = {
  kgbtoys: [{ who: 'spy', text: "DIMITRI, HE'S HERE!" }, { who: 'spy2', text: 'DA! HIDE THE TEDDIES!' }],
  forever12: [{ who: 'spy', text: "IT'S NOT A DISGUISE." }, { who: 'spy2', text: "IT'S A LOOK, SERGEI." }],
  radioshock: [{ who: 'spy', text: "YOU'LL NEED BATTERIES." }, { who: 'bot', text: 'BEEP. NOT INCLUDED.' }],
  hotspy: [{ who: 'spy', text: 'WANT FRIES WITH THAT?' }],
  footlock: [{ who: 'spy', text: 'THESE ARE MY GETAWAY SHOES' }, { who: 'spy2', text: 'BOTH LEFT FEET, COMRADE' }],
  sambaddy: [{ who: 'spy', text: 'TURN IT UP, BORIS!' }],
  crookstone: [{ who: 'spy', text: 'TRY THE MASSAGE CHAIR...' }],
  sharper: [{ who: 'bot', text: "BEEP. PLEASE DON'T TOUCH." }],
  spenders: [{ who: 'spy', text: 'WHOA... THE LAVA LAMP...' }],
};

export const SPY_LAST_WORDS: string[] = [
  'I WAS JUST BROWSING!',
  "WHAT'S YOUR RETURN POLICY?!",
  'I HAD A COUPON!',
  'TELL MY CAT...',
  'NOT THE FACE!',
  'I WAS ON MY LUNCH BREAK!',
  'WORTH IT. 70% OFF.',
  'MY RECEIPT...',
];

export const SPY_ELEVATOR_LINES: string[] = [
  '...NICE WEATHER.',
  'GOING DOWN? ME TOO.',
  '*AWKWARD COUGH*',
  'THIS IS MY FLOOR, ACTUALLY',
];

export const PA_LINES: string[] = [
  'ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.',
  'FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.',
  "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
  'LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.',
  'BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.',
  'THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.',
  'A REMINDER: SECURITY IS WATCHING. MOSTLY TV.',
];
/** PA banners are word-wrapped to this many characters per line. */
export const PA_WRAP = 28;

export const HEADLINES: string[] = [
  'LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING',
  'SPIES FOILED; FOOD COURT SALES UP 300%',
  "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
  "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
  'GAMESTONK SHARE PRICE DOWN ANOTHER 99%',
];

export const JOKE_ITEMS = ['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)'] as const;
export const JOKE_ITEM_SPRITES: Record<string, string> = {
  'EXPIRED COUPON': 'joke_coupon',
  'PRE-OWNED STRATEGY GUIDE': 'joke_guide',
  'PET ROCK': 'joke_rock',
  'MOOD RING': 'joke_ring',
  '1 SHARE (DOWN 99%)': 'joke_share',
};

export const EASTER_EGG_TEXT = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";

/** Floor announcements when an elevator stops with the player inside. */
export const FLOOR_ANNOUNCE: string[] = [
  'ROOF - HELIPAD, NO HELICOPTER',
  '4F - FASHION & GADGETS, SPIES',
  '3F - TOYS, GIFTS & FOUNTAIN',
  '2F - MUSIC, FOOD & DISCO',
  '1F - SPORTS & SAD CLOSINGS',
  'P - PARKING, GETAWAY CARS',
];

export const BANNERS = {
  alarm: 'ALARM! SECURITY ALERTED',
  trap: "IT'S A TRAP!",
  nothing: 'NOTHING HERE',
  occupied: 'OCCUPIED!!',
  sideB: 'NOW PLAYING: SIDE B',
  copShout: 'HEY! STOP RIGHT THERE!',
  detained: 'DETAINED! -500',
  hey: 'HEY!',
  packagesLeft: (n: number) => `PACKAGES LEFT: ${n}`,
  package: (n: number) => `PACKAGE ${n}/6`,
  youGot: (item: string) => `YOU GOT: ${item}`,
  closed: 'SORRY, WE\'RE CLOSED',
  cleared: 'NOTHING LEFT TO FIND',
  kioskCool: 'DIRECTORY REBOOTING...',
  blackFriday: 'BLACK FRIDAY!',
  seventyOff: '70% OFF EVERYTHING',
  extraLife: '1UP!',
  crtOn: 'CRT ON',
  crtOff: 'CRT OFF',
  soundOn: 'SOUND ON',
  soundOff: 'SOUND OFF',
  searchHint: 'PRESS X TO SEARCH',
  searching: 'SEARCHING…',
  subtitle: 'A SHOPPING MALL ESPIONAGE',
  copyright: '(C) 2026 FLICKERSOFT',
  pressStart: 'PRESS START',
  controlHint: 'ARROWS MOVE  Z SHOOT  X JUMP',
  controlHint2: 'SHIFT MAP  ENTER PAUSE',
  continue: 'CONTINUE?',
  continuesLeft: (n: number) => `CONTINUES LEFT: ${n}`,
  gameOver: 'GAME OVER',
  mallClosed: ['ATTENTION SHOPPERS:', 'THE MALL IS NOW CLOSED'],
  pause: 'PAUSE',
  mapTitle: 'MALL DIRECTORY',
  loop: (n: number) => `LOOP ${n}`,
  dailyMall: 'THE DAILY MALL',
  spygram: 'SPYGRAM',
  photoStrip: 'PHOTO STRIP ADDED!',
  wetFloor: 'CAUTION: WET',
} as const;

export const POWERUP_NAMES: Record<string, string> = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  armor: 'ARMOR VEST',
  sneakers: 'SNEAKERS',
  radar: 'RADAR',
  oneup: '1-UP',
  cinnabomb: 'CINNABOMB',
  ooze: 'ORANGE JULI-OOZE',
  pretzel: 'SOFT PRETZEL',
};
