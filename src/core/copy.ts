/**
 * EVERY line of player-facing joke copy lives here. One file, easy to edit.
 *
 * The limits below are enforced by tests/copy.test.ts. If you add a line that
 * is too long the test suite fails rather than the text running off a 256px
 * screen. Keep it that way.
 */

export const LIMITS = {
  /** Speech bubbles over actors. */
  bubble: 28,
  /** SPYGRAM caption lines (max 2 lines). */
  spygramCaption: 21,
  spygramCaptionLines: 2,
  /** The single SPYGRAM comment under a post. */
  spygramComment: 21,
  /** THE DAILY MALL headline lines. */
  headline: 26,
} as const;

export interface SpygramPost {
  /** 1-2 lines, each <= LIMITS.spygramCaption. */
  caption: readonly string[];
  /** <= LIMITS.spygramComment. */
  comment: string;
}

// ---------------------------------------------------------------------------
// SPYGRAM - a parody photo app. Never the real brand.
// ---------------------------------------------------------------------------

export const SPYGRAM_ARRIVAL: readonly SpygramPost[] = [
  { caption: ['FEELING CUTE,', 'MIGHT DELETE LATER'], comment: 'MOM: SO PROUD OF U' },
  { caption: ['FIRST DAY ON THE JOB!', '#BLESSED'], comment: 'BOSS: DELETE THIS' },
  { caption: ['MALL RAT? NO.', 'MALL AGENT.'], comment: 'MOM: WEAR A JACKET' },
  { caption: ['ZIPLINE WAS $0.', 'PARKING WAS $12.'], comment: 'DAD: TOLD U SO' },
  { caption: ['OUTFIT OF THE DAY:', 'TRENCHCOAT, AGAIN'], comment: 'FOREVER12: 20% OFF!' },
  { caption: ['NO SPIES WERE HARMED', 'IN THIS SELFIE. YET.'], comment: 'DIMITRI: :(' },
  { caption: ['ROOFTOP VIBES', '#UNDERCOVER'], comment: 'HQ: WHY IS IT PUBLIC' },
  { caption: ["DON'T TELL HQ, I'M", 'HERE FOR PRETZELS'], comment: 'HQ: WE CAN SEE THIS' },
  { caption: ['GOLDEN HOUR.', 'LICENSE TO CHILL.'], comment: 'MOM: CALL YOUR MOM' },
  { caption: ['SECRET MISSION.', 'PLEASE LIKE & SHARE'], comment: 'HQ: ...SERIOUSLY?' },
];

export const SPYGRAM_COMPLETE: readonly SpygramPost[] = [
  { caption: ['MISSION COMPLETE.', 'ALSO BOUGHT SOCKS.'], comment: 'MOM: WHAT COLOR?' },
  { caption: ['6 PACKAGES.', '0 RECEIPTS. #WIN'], comment: 'RETURNS DESK: NO' },
  { caption: ['SAVED THE WORLD.', 'STILL NO PARKING.'], comment: 'DAD: TYPICAL' },
  { caption: ['SPIES: 0', 'ME: 1 #MALLRAT'], comment: 'BORIS: REMATCH?' },
  { caption: ['GETAWAY CAR: WOOD', 'PANELING. ICONIC'], comment: 'HQ: RETURN THE CAR' },
  { caption: ['TREATED MYSELF TO A', 'CINNABOMB. EARNED IT.'], comment: 'MOM: EAT A VEGGIE' },
  { caption: ['HQ SAID KEEP IT QUIET', 'SO HERE IS A POST'], comment: "HQ: YOU'RE FIRED" },
  { caption: ['FOUND A PET ROCK.', 'HIS NAME IS KEVIN.'], comment: 'KEVIN: ...' },
  { caption: ['BRB, RETURNING 6', 'SUSPICIOUS PACKAGES'], comment: 'MALL COP: WAIT WHAT' },
  { caption: ['SEE YOU NEXT LOOP,', 'FOOD COURT'], comment: 'HOT SPY: <3 <3 <3' },
];

// ---------------------------------------------------------------------------
// First-visit store lines. Keyed by store id; shown over the guards.
// The second line appears ~1s after the first.
// ---------------------------------------------------------------------------

export const FIRST_VISIT_LINES: Record<string, readonly string[]> = {
  kgbtoys: ["DIMITRI, HE'S HERE!", 'DA! HIDE THE TEDDIES!'],
  forever12: ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
  radioshock: ["YOU'LL NEED BATTERIES.", 'BEEP. NOT INCLUDED.'],
  hotspy: ['WANT FRIES WITH THAT?'],
  footlockpicker: ['THESE ARE MY GETAWAY SHOES', 'BOTH LEFT FEET, COMRADE'],
  sambaddy: ['TURN IT UP, BORIS!'],
  crookstone: ['TRY THE MASSAGE CHAIR...'],
  sharperimagine: ["BEEP. PLEASE DON'T TOUCH."],
  spendersgifts: ['WHOA... THE LAVA LAMP...'],
};

// ---------------------------------------------------------------------------
// Spy chatter
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mall PA. Multi-line banners; each line must fit the bubble limit.
// ---------------------------------------------------------------------------

export const PA_LINES: readonly (readonly string[])[] = [
  ['ATTENTION SHOPPERS:', 'CLEANUP ON 3F. AGAIN.'],
  ['FREE SAMPLES AT HOT SPY.', 'NOT POISONED. PROBABLY.'],
  ['WILL THE OWNER OF A BLACK', "VAN MARKED 'NOT SPIES'", 'PLEASE MOVE IT.'],
  ['LOST CHILD AT THE 2F KIOSK.', 'SAYS HIS NAME IS AGENT 7.'],
  ['BLOCKBLUSTER IS STILL', 'CLOSED. BE KIND, REWIND.'],
  ['THE MALL CLOSES AT 9.', 'SPIES CLOSE AT NEVER.'],
  ['A REMINDER: SECURITY IS', 'WATCHING. MOSTLY TV.'],
];

// ---------------------------------------------------------------------------
// THE DAILY MALL
// ---------------------------------------------------------------------------

export const HEADLINES: readonly (readonly string[])[] = [
  ['LOCAL AGENT FINDS 6', 'PACKAGES, STILL NO PARKING'],
  ['SPIES FOILED; FOOD', 'COURT SALES UP 300%'],
  ['MAN ZIPLINES ONTO ROOF.', "SECURITY 'NOT SURPRISED'"],
  ['MALL WALKERS DEMAND', "APOLOGY FOR 'HEY!'", 'INCIDENT'],
  ['GAMESTONK SHARE PRICE', 'DOWN ANOTHER 99%'],
];

// ---------------------------------------------------------------------------
// Misc one-liners
// ---------------------------------------------------------------------------

export const WALKER_BUBBLE = 'HEY!';
export const COP_BUBBLE = 'HEY! STOP RIGHT THERE!';
export const COP_CAUGHT = 'DETAINED! -500';
export const FITTING_ROOM_BUBBLE = 'OCCUPIED!!';
export const TRAP_BANNER = "IT'S A TRAP!";
export const NOTHING_BANNER = 'NOTHING HERE';
export const SEARCH_HINT = 'PRESS X TO SEARCH';
export const SEARCHING_LABEL = 'SEARCHING...';
export const LISTENING_BOOTH = 'NOW PLAYING: SIDE B';
export const GAMEOVER_PA: readonly string[] = ['ATTENTION SHOPPERS:', 'THE MALL IS NOW CLOSED'];
export const ZELDA_CAVE_LINES: readonly string[] = ["IT'S DANGEROUS TO GO", 'ALONE! TAKE THIS.'];

/** Useless joke items from the GameStonk easter egg. Worth 1 point each. */
export const JOKE_ITEMS: readonly string[] = [
  'EXPIRED COUPON',
  'PRE-OWNED STRATEGY GUIDE',
  'PET ROCK',
  'MOOD RING',
  '1 SHARE (DOWN 99%)',
];

export const BLACK_FRIDAY_LINES: readonly string[] = ['BLACK FRIDAY!', '70% OFF EVERYTHING'];
