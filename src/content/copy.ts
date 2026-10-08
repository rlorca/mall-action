import type { StoreId } from './stores';

/**
 * ALL the game's copy lives here. To add a joke, add a line to the right list;
 * copy.test.ts checks that every line fits on screen (and is drawable with the
 * bitmap fonts). Keep everything UPPERCASE. Limits:
 *   speech bubbles <= 28 chars, SPYGRAM caption lines <= 21 chars (2 lines max),
 *   comments <= 21 chars, headline lines <= 26 chars (after wrapping), banners <= 40 chars.
 */
export const LIMITS = {
  bubble: 28,
  captionLine: 21,
  captionLines: 2,
  comment: 21,
  headlineLine: 26,
  banner: 40,
  paLine: 28,
} as const;

// ------------------------------------------------------------------ SPYGRAM
export interface SpygramPost {
  /** 1-2 caption lines, each <= 21 chars. */
  caption: readonly string[];
  /** Single comment line, <= 21 chars ("WHO: TEXT"). */
  comment: string;
}

/** Posted on the roof after the zip-line landing. */
export const SPYGRAM_ARRIVAL: readonly SpygramPost[] = [
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

/** Posted after the level clear. */
export const SPYGRAM_COMPLETE: readonly SpygramPost[] = [
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

// ------------------------------------------------------------------ speech bubbles
export interface BubbleLine {
  /** Who speaks: a guard spy (first spy in the room) or the security bot. */
  who: 'spy' | 'bot';
  text: string;
}

/** First-visit lines (guards hold still; the second line comes ~1 s after the first). */
export const FIRST_VISIT: Partial<Record<StoreId, readonly BubbleLine[]>> = {
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
  footlock: [
    { who: 'spy', text: 'THESE ARE MY GETAWAY SHOES' },
    { who: 'spy', text: 'BOTH LEFT FEET, COMRADE' },
  ],
  sambaddy: [{ who: 'spy', text: 'TURN IT UP, BORIS!' }],
  crookstone: [{ who: 'spy', text: 'TRY THE MASSAGE CHAIR...' }],
  sharper: [{ who: 'bot', text: "BEEP. PLEASE DON'T TOUCH." }],
  spenders: [{ who: 'spy', text: 'WHOA... THE LAVA LAMP...' }],
};

/** About 35% of spy kills in the mall. */
export const LAST_WORDS: readonly string[] = [
  'I WAS JUST BROWSING!',
  "WHAT'S YOUR RETURN POLICY?!",
  'I HAD A COUPON!',
  'TELL MY CAT...',
  'NOT THE FACE!',
  'I WAS ON MY LUNCH BREAK!',
  'WORTH IT. 70% OFF.',
  'MY RECEIPT...',
];

/** Spies stepping out of an elevator. */
export const ELEVATOR_EXIT_LINES: readonly string[] = [
  '...NICE WEATHER.',
  'GOING DOWN? ME TOO.',
  '*AWKWARD COUGH*',
  'THIS IS MY FLOOR, ACTUALLY',
];

/** Single-word shouts. */
export const SHOUTS = {
  walker: 'HEY!',
  cop: 'HEY! STOP RIGHT THERE!',
  fitting: 'OCCUPIED!!',
  detained: 'DETAINED! -500',
} as const;

// ------------------------------------------------------------------ PA + newspaper
/** Mall PA announcements (a chime + multi-line banner about once a minute). Never the same twice in a row. */
export const PA_LINES: readonly string[] = [
  'ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.',
  'FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.',
  "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
  'LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.',
  'BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.',
  'THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.',
  'A REMINDER: SECURITY IS WATCHING. MOSTLY TV.',
];

/** THE DAILY MALL front-page headlines (wrapped to <= 26 chars per line at draw time with wrapWords). */
export const HEADLINES: readonly string[] = [
  'LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING',
  'SPIES FOILED; FOOD COURT SALES UP 300%',
  "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
  "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
  'GAMESTONK SHARE PRICE DOWN ANOTHER 99%',
];

/** Greedy word wrap by character count (copy is pre-split so length tests are flat loops). */
export function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const trial = line ? `${line} ${word}` : word;
    if (line && trial.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

// ------------------------------------------------------------------ elevator floor banners
export const FLOOR_BANNERS: readonly string[] = [
  'R - ROOF ACCESS. BEWARE PIGEONS',
  '4F - FASHION & GADGETS, SPIES',
  '3F - TOYS, LAVA LAMPS, SPIES',
  '2F - MUSIC & CORN DOGS, SPIES',
  '1F - SHOES & MOPPED FLOORS',
  'P - PARKING. IT COSTS $12',
];

// ------------------------------------------------------------------ GameStonk easter egg
export const EASTER_EGG = {
  clerk: "IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
  items: ['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)'],
  youGot: 'YOU GOT: ',
} as const;

// ------------------------------------------------------------------ misc UI strings (banners, titles, prompts)
export const UI = {
  studio: 'FLICKERSOFT',
  presents: 'PRESENTS',
  title: 'MALL ACTION',
  subtitle: 'A SHOPPING MALL ESPIONAGE',
  copyright: '(C) 2026 FLICKERSOFT',
  pressStart: 'PRESS START',
  hint1: 'ARROWS MOVE  Z SHOOT  X JUMP',
  hint2: 'SHIFT MAP  ENTER PAUSE  C CRT',
  blackFriday: 'BLACK FRIDAY!',
  blackFridayOff: '70% OFF EVERYTHING',
  pause: 'PAUSE',
  directory: 'MALL DIRECTORY',
  continueQ: 'CONTINUE?',
  gameOver: 'GAME OVER',
  closedLine1: 'ATTENTION SHOPPERS:',
  closedLine2: 'THE MALL IS NOW CLOSED',
  alarmBanner: 'ALARM! SECURITY ALERTED',
  alarmHud: 'ALARM',
  trap: "IT'S A TRAP!",
  nothing: 'NOTHING HERE',
  pressToSearch: 'PRESS X TO SEARCH',
  searching: 'SEARCHING...',
  nowPlaying: 'NOW PLAYING: SIDE B',
  levelClear: 'LEVEL CLEAR',
  crtOn: 'CRT ON',
  crtOff: 'CRT OFF',
  soundOn: 'SOUND ON',
  soundOff: 'SOUND OFF',
  newspaperName: 'THE DAILY MALL',
  spygram: 'SPYGRAM',
  noGfx: 'THIS GAME NEEDS WEBGL. PLEASE USE A MODERN DESKTOP BROWSER WITH HARDWARE ACCELERATION.',
} as const;

export function packageBanner(n: number): string {
  return `PACKAGE ${n}/6`;
}
export function packagesLeft(n: number): string {
  return `PACKAGES LEFT: ${n}`;
}
export function continuesLeft(n: number): string {
  return `CONTINUES LEFT: ${n}`;
}
export function youGot(item: string): string {
  return `${EASTER_EGG.youGot}${item}`;
}
