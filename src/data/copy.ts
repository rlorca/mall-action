// EVERY line of player-facing joke copy lives here. Add jokes here, then run `npm test`:
// tests/copy.test.ts checks that every line fits on screen.
// Font is 8x8 (32 columns on a 256px screen); limits below are in characters.

export const LIMITS = {
  bubble: 28, // speech bubbles
  caption: 21, // SPYGRAM caption lines (2 lines max)
  comment: 21, // SPYGRAM comment (incl. author prefix)
  headline: 26, // newspaper headline lines
  banner: 30, // banners / PA lines (already wrapped)
} as const;

export interface Spygram {
  caption: [string, string];
  comment: string; // "AUTHOR: TEXT"
}

export const SPYGRAM_ARRIVAL: readonly Spygram[] = [
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

export const SPYGRAM_COMPLETE: readonly Spygram[] = [
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

/** First-visit lines: shown over the guards, the 2nd line ~1s after the first. who: which guard type speaks. */
export interface VisitLine {
  who: 'spy' | 'bot';
  text: string;
}
export const FIRST_VISIT: Readonly<Record<string, readonly VisitLine[]>> = {
  kgbtoys: [
    { who: 'spy', text: "DIMITRI, HE'S HERE!" },
    { who: 'spy', text: 'DA! HIDE THE TEDDIES!' },
  ],
  forever12: [
    { who: 'spy', text: "IT'S NOT A DISGUISE." },
    { who: 'spy', text: "IT'S A LOOK, SERGEI." },
  ],
  radioshock: [
    { who: 'spy', text: "YOU'LL NEED BATTERIES." },
    { who: 'bot', text: 'BEEP. NOT INCLUDED.' },
  ],
  hotspy: [{ who: 'spy', text: 'WANT FRIES WITH THAT?' }],
  footlockpicker: [
    { who: 'spy', text: 'THESE ARE MY GETAWAY SHOES' },
    { who: 'spy', text: 'BOTH LEFT FEET, COMRADE' },
  ],
  sambaddy: [{ who: 'spy', text: 'TURN IT UP, BORIS!' }],
  crookstone: [{ who: 'spy', text: 'TRY THE MASSAGE CHAIR...' }],
  sharperimagine: [{ who: 'bot', text: "BEEP. PLEASE DON'T TOUCH." }],
  spendersgifts: [{ who: 'spy', text: 'WHOA... THE LAVA LAMP...' }],
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

/** Each entry is one banner (already wrapped, <= banner limit per line). */
export const PA_ANNOUNCEMENTS: readonly (readonly string[])[] = [
  ['ATTENTION SHOPPERS:', 'CLEANUP ON 3F. AGAIN.'],
  ['FREE SAMPLES AT HOT SPY.', 'NOT POISONED. PROBABLY.'],
  ['WILL THE OWNER OF A BLACK', "VAN MARKED 'NOT SPIES'", 'PLEASE MOVE IT.'],
  ['LOST CHILD AT THE 2F KIOSK.', 'SAYS HIS NAME IS AGENT 7.'],
  ['BLOCKBLUSTER IS STILL CLOSED.', 'BE KIND, REWIND.'],
  ['THE MALL CLOSES AT 9.', 'SPIES CLOSE AT NEVER.'],
  ['A REMINDER: SECURITY IS', 'WATCHING. MOSTLY TV.'],
];

export const HEADLINES: readonly (readonly string[])[] = [
  ['LOCAL AGENT FINDS', '6 PACKAGES, STILL', 'NO PARKING'],
  ['SPIES FOILED; FOOD', 'COURT SALES UP 300%'],
  ['MAN ZIPLINES ONTO ROOF.', "SECURITY 'NOT SURPRISED'"],
  ['MALL WALKERS DEMAND', "APOLOGY FOR 'HEY!'", 'INCIDENT'],
  ['GAMESTONK SHARE PRICE', 'DOWN ANOTHER 99%'],
];

export const GAMESTONK_EGG = {
  clerk: ["IT'S DANGEROUS TO GO ALONE!", 'TAKE THIS.'],
  items: ['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)'],
  got: 'YOU GOT:',
};

export const FLOOR_ANNOUNCE: Readonly<Record<string, string>> = {
  R: 'R - ROOF. MIND THE GAP.',
  '4F': '4F - FASHION & GADGETS, SPIES',
  '3F': '3F - TOYS & GIFTS, SPIES',
  '2F': '2F - MUSIC & FOOD, SPIES',
  '1F': '1F - SPORTS & BOOKS, SPIES',
  P: 'P - PARKING. MIND THE SPIES',
};

export const MISC = {
  copen: 'HEY!',
  copWhistle: 'HEY! STOP RIGHT THERE!',
  copCaught: 'DETAINED! -500',
  walkerHey: 'HEY!',
  fitting: 'OCCUPIED!!',
  trap: "IT'S A TRAP!",
  nothing: 'NOTHING HERE',
  searching: 'SEARCHING...',
  pressSearch: 'PRESS X TO SEARCH',
  alarm: ['ALARM!', 'SECURITY ALERTED'],
  nowPlaying: 'NOW PLAYING: SIDE B',
  blackFriday: ['BLACK FRIDAY!', '70% OFF EVERYTHING'],
  paDisplayFrames: 240,
  gameOverPA: ['ATTENTION SHOPPERS:', 'THE MALL IS NOW CLOSED'],
  continueTitle: 'CONTINUE?',
  packagesLeft: (n: number) => `PACKAGES LEFT: ${n}`,
  packageGot: (n: number) => `PACKAGE ${n}/6`,
  loop: (n: number) => `LOOP ${n}`,
  continuesLeft: (n: number) => `CONTINUES LEFT: ${n}`,
  subtitle: 'A SHOPPING MALL ESPIONAGE',
  copyright: '(C) 2026 FLICKERSOFT',
  wetFloor: 'WET FLOOR',
  seventyOff: '70% OFF',
};

export const POWERUP_NAMES: Readonly<Record<string, string>> = {
  rapid: 'RAPID FIRE',
  spread: 'SPREAD SHOT',
  armor: 'ARMOR VEST',
  sneakers: 'SNEAKERS',
  radar: 'RADAR',
  oneup: '1-UP',
  cinnabomb: 'CINNABOMB',
  juice: 'ORANGE JULI-OOZE',
  pretzel: 'SOFT PRETZEL',
};
