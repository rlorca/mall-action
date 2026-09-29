// All the jokes in one place. Lines shown in speech bubbles must stay ≤ 28 chars.

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
export const LAST_WORDS_CHANCE = 0.35;
export const BUBBLE_FRAMES = 70;

// Mall PA: one announcement every PA_FRAMES, never the same twice in a row. '\n' breaks banner lines.
export const PA_FRAMES = 3600;
export const PA_LINES = [
  'ATTENTION SHOPPERS:\nCLEANUP ON 3F. AGAIN.',
  'FREE SAMPLES AT HOT SPY.\nNOT POISONED. PROBABLY.',
  'WILL THE OWNER OF A BLACK VAN\nMARKED "NOT SPIES"\nPLEASE MOVE IT.',
  'LOST CHILD AT THE 2F KIOSK.\nSAYS HIS NAME IS AGENT 7.',
  'BLOCKBLUSTER IS STILL CLOSED.\nBE KIND, REWIND.',
  'THE MALL CLOSES AT 9.\nSPIES CLOSE AT NEVER.',
  'A REMINDER: SECURITY\nIS WATCHING. MOSTLY TV.',
];

// said by a spy stepping out of an elevator car
export const LIFT_LINES = ['...NICE WEATHER.', 'GOING DOWN? ME TOO.', '*AWKWARD COUGH*', 'THIS IS MY FLOOR, ACTUALLY'];

export const HEADLINES = [
  'LOCAL AGENT FINDS\n6 PACKAGES, STILL\nNO PARKING',
  'SPIES FOILED; FOOD COURT\nSALES UP 300%',
  'MAN ZIPLINES ONTO ROOF.\nSECURITY "NOT SURPRISED"',
  'MALL WALKERS DEMAND\nAPOLOGY FOR "HEY!"\nINCIDENT',
  'GAMESTONK SHARE PRICE\nDOWN ANOTHER 99%',
];
export const pickHeadline = (rng) => rng.pick(HEADLINES);

export function pickPA(world, rng) {
  const options = PA_LINES.filter((l) => l !== world.lastPA);
  world.lastPA = rng.pick(options);
  return world.lastPA;
}

// Speech bubble attached to an entity (or a fixed spot) in the mall.
export function say(world, target, text, frames = BUBBLE_FRAMES) {
  world.bubbles.push({ target, text, t: frames });
}
export const tickBubbles = (world) => { world.bubbles = world.bubbles.filter((b) => --b.t > 0); };

// SPYGRAM posts: caption (≤ 2 lines of 21 chars, '\n' breaks) + one comment (≤ 21 chars).
export const ARRIVAL_POSTS = [
  { caption: 'FEELING CUTE,\nMIGHT DELETE LATER', comment: 'MOM: SO PROUD OF U' },
  { caption: 'FIRST DAY ON THE JOB!\n#BLESSED', comment: 'BOSS: DELETE THIS' },
  { caption: 'MALL RAT? NO.\nMALL AGENT.', comment: 'MOM: WEAR A JACKET' },
  { caption: 'ZIPLINE WAS $0.\nPARKING WAS $12.', comment: 'DAD: TOLD U SO' },
  { caption: 'OUTFIT OF THE DAY:\nTRENCHCOAT, AGAIN', comment: 'FOREVER12: 20% OFF!' },
  { caption: 'NO SPIES WERE HARMED\nIN THIS SELFIE. YET.', comment: 'DIMITRI: :(' },
  { caption: 'ROOFTOP VIBES\n#UNDERCOVER', comment: 'HQ: WHY IS IT PUBLIC' },
  { caption: "DON'T TELL HQ, I'M\nHERE FOR PRETZELS", comment: 'HQ: WE CAN SEE THIS' },
  { caption: 'GOLDEN HOUR.\nLICENSE TO CHILL.', comment: 'MOM: CALL YOUR MOTHER' },
  { caption: 'SECRET MISSION.\nPLEASE LIKE & SHARE', comment: 'HQ: ...SERIOUSLY?' },
];

export const MISSION_POSTS = [
  { caption: 'MISSION COMPLETE.\nALSO BOUGHT SOCKS.', comment: 'MOM: WHAT COLOR?' },
  { caption: '6 PACKAGES.\n0 RECEIPTS. #WIN', comment: 'RETURNS DESK: NO' },
  { caption: 'SAVED THE WORLD.\nSTILL NO PARKING.', comment: 'DAD: TYPICAL' },
  { caption: 'SPIES: 0\nME: 1  #MALLRAT', comment: 'BORIS: REMATCH?' },
  { caption: 'GETAWAY CAR:\nWOOD PANELING. ICONIC', comment: 'HQ: RETURN THE CAR' },
  { caption: 'TREATED MYSELF TO A\nCINNABOMB. EARNED IT.', comment: 'MOM: EAT A VEGGIE' },
  { caption: 'HQ SAID KEEP IT QUIET\nSO HERE IS A POST', comment: "HQ: YOU'RE FIRED" },
  { caption: 'FOUND A PET ROCK.\nHIS NAME IS KEVIN.', comment: 'KEVIN: ...' },
  { caption: 'BRB, RETURNING 6\nSUSPICIOUS PACKAGES', comment: 'MALL COP: WAIT WHAT' },
  { caption: 'SEE YOU NEXT LOOP,\nFOOD COURT', comment: 'HOT SPY: ♥♥♥' },
];
export const pickPost = (rng, posts) => rng.pick(posts);
