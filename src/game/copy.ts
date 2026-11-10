/**
 * ALL the copy lives here. Add jokes in this file.
 * Limits (enforced by tests/copy.test.ts):
 *   speech bubbles <= 28 chars, SPYGRAM caption lines <= 21 chars (max 2 lines),
 *   comments <= 21 chars, headline lines <= 26 chars, banner lines <= 30 chars.
 */
export const LIMITS = { bubble: 28, caption: 21, comment: 21, headline: 26, banner: 30 };

export interface Post {
  caption: [string, string];
  comment: string;
}

export const ARRIVAL_POSTS: Post[] = [
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

export const CLEAR_POSTS: Post[] = [
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

/** First-visit store lines. who: 'spy' = first spy guard, 'spy2' = second spy, 'bot' = the security bot. */
export interface StoreLine {
  who: 'spy' | 'spy2' | 'bot';
  text: string;
}
export const STORE_LINES: Record<string, StoreLine[]> = {
  kgb: [
    { who: 'spy', text: "DIMITRI, HE'S HERE!" },
    { who: 'spy2', text: 'DA! HIDE THE TEDDIES!' },
  ],
  forever: [
    { who: 'spy', text: "IT'S NOT A DISGUISE." },
    { who: 'spy2', text: "IT'S A LOOK, SERGEI." },
  ],
  radio: [
    { who: 'spy', text: "YOU'LL NEED BATTERIES." },
    { who: 'bot', text: 'BEEP. NOT INCLUDED.' },
  ],
  hotspy: [{ who: 'spy', text: 'WANT FRIES WITH THAT?' }],
  foot: [
    { who: 'spy', text: 'THESE ARE MY GETAWAY SHOES' },
    { who: 'spy2', text: 'BOTH LEFT FEET, COMRADE' },
  ],
  sam: [{ who: 'spy', text: 'TURN IT UP, BORIS!' }],
  crook: [{ who: 'spy', text: 'TRY THE MASSAGE CHAIR...' }],
  sharper: [{ who: 'bot', text: "BEEP. PLEASE DON'T TOUCH." }],
  spender: [{ who: 'spy', text: 'WHOA... THE LAVA LAMP...' }],
};

export const LAST_WORDS = [
  'I WAS JUST BROWSING!',
  "WHAT'S YOUR RETURN POLICY?!",
  'I HAD A COUPON!',
  'TELL MY CAT...',
  'NOT THE FACE!',
  'I WAS ON MY LUNCH BREAK!',
  'WORTH IT. 70% OFF.',
  'MY RECEIPT...',
];

export const ELEVATOR_LINES = ['...NICE WEATHER.', 'GOING DOWN? ME TOO.', '*AWKWARD COUGH*', 'THIS IS MY FLOOR, ACTUALLY'];

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

export const JOKE_ITEMS = ['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)'];

export const FLOOR_ANNOUNCE = [
  'R - ROOF. MIND THE ZIP LINE',
  '4F - FASHION & GADGETS, SPIES',
  '3F - TOYS, GIFTS, SPIES',
  '2F - MUSIC, FOOD COURT, SPIES',
  '1F - SHOES, BOOKS, SPIES',
  'P - PARKING. NO REFUNDS',
];

export const TEXT = {
  studio: 'FLICKERSOFT',
  presents: 'PRESENTS',
  title1: 'MALL',
  title2: 'ACTION',
  subtitle: 'A SHOPPING MALL ESPIONAGE',
  copyright: '(C) 2026 FLICKERSOFT',
  pressStart: 'PRESS START',
  controls1: 'ARROWS:MOVE Z:SHOOT X:JUMP',
  controls2: 'ENTER:START SHIFT:MAP C:CRT',
  blackFriday: 'BLACK FRIDAY!',
  blackFriday2: '70% OFF EVERYTHING',
  pause: 'PAUSE',
  mapTitle: 'MALL DIRECTORY',
  trap: "IT'S A TRAP!",
  nothing: 'NOTHING HERE',
  pressSearch: 'PRESS X TO SEARCH',
  searching: 'SEARCHING…',
  occupied: 'OCCUPIED!!',
  hey: 'HEY!',
  copStop: 'HEY! STOP RIGHT THERE!',
  detained: 'DETAINED! -500',
  alarm1: 'ALARM!',
  alarm2: 'SECURITY ALERTED',
  sideB: 'NOW PLAYING: SIDE B',
  egg1: "IT'S DANGEROUS TO GO ALONE!",
  egg2: 'TAKE THIS.',
  youGot: 'YOU GOT:',
  packagesLeft: 'PACKAGES LEFT:',
  continueQ: 'CONTINUE?',
  continuesLeft: 'CONTINUES LEFT:',
  closed1: 'ATTENTION SHOPPERS:',
  closed2: 'THE MALL IS NOW CLOSED',
  gameOver: 'GAME OVER',
  paper: 'THE DAILY MALL',
  spygram: 'SPYGRAM',
  forLease: 'FOR LEASE',
  closingSale: 'CLOSING SALE',
  toTheMoon: 'TO THE MOON',
  off70: '70% OFF',
  wetFloor: 'WET',
  extraLife: 'EXTRA LIFE!',
  armorSaved: 'ARMOR SAVED YOU!',
  cleared: 'ALL 6! GO TO PARKING (P)',
  storeCleared: 'STORE CLEARED',
};

export type PowerKind = 'rapid' | 'spread' | 'armor' | 'sneakers' | 'radar' | 'oneup' | 'cinnabomb' | 'juliooze' | 'pretzel';
export const POWER_NAMES: Record<PowerKind, string> = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  armor: 'ARMOR VEST',
  sneakers: 'SNEAKERS',
  radar: 'RADAR',
  oneup: '1-UP',
  cinnabomb: 'CINNABOMB',
  juliooze: 'ORANGE JULI-OOZE',
  pretzel: 'SOFT PRETZEL',
};
