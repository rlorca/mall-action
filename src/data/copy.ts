export const MAX_LENGTHS = {
  speechBubble: 28,
  spygramCaption: 21,
  spygramCaptionLines: 2,
  comment: 21,
  headline: 26,
};

export const SPYGRAM_ARRIVAL_POSTS: { caption: string[]; comment: string }[] = [
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

export const SPYGRAM_COMPLETE_POSTS: { caption: string[]; comment: string }[] = [
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

export const STORE_FIRST_VISIT_LINES: Record<string, string[]> = {
  kgb_toys: ["DIMITRI, HE'S HERE!", 'DA! HIDE THE TEDDIES!'],
  forever12: ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
  radioshock: ["YOU'LL NEED BATTERIES.", 'BEEP. NOT INCLUDED.'],
  hot_spy: ['WANT FRIES WITH THAT?'],
  foot_lockpicker: ['THESE ARE MY GETAWAY SHOES', 'BOTH LEFT FEET, COMRADE'],
  sam_baddy: ['TURN IT UP, BORIS!'],
  crookstone: ['TRY THE MASSAGE CHAIR...'],
  sharper_imagine: ["BEEP. PLEASE DON'T TOUCH."],
  spenders: ['WHOA... THE LAVA LAMP...'],
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

export const MALL_PA_LINES: string[][] = [
  ['ATTENTION SHOPPERS:', 'CLEANUP ON 3F. AGAIN.'],
  ['FREE SAMPLES AT HOT SPY.', 'NOT POISONED. PROBABLY.'],
  ["WILL THE OWNER OF A BLACK", "VAN MARKED 'NOT SPIES'", 'PLEASE MOVE IT.'],
  ['LOST CHILD AT THE 2F KIOSK.', 'SAYS HIS NAME IS AGENT 7.'],
  ['BLOCKBLUSTER IS STILL CLOSED.', 'BE KIND, REWIND.'],
  ['THE MALL CLOSES AT 9.', 'SPIES CLOSE AT NEVER.'],
  ['A REMINDER:', 'SECURITY IS WATCHING.', 'MOSTLY TV.'],
];

export const DAILY_MALL_HEADLINES: string[] = [
  'LOCAL AGENT FINDS 6\nPACKAGES, STILL NO PARKING',
  'SPIES FOILED; FOOD COURT\nSALES UP 300%',
  'MAN ZIPLINES ONTO ROOF.\nSECURITY \'NOT SURPRISED\'',
  'MALL WALKERS DEMAND\nAPOLOGY FOR HEY INCIDENT',
  'GAMESTONK SHARE PRICE\nDOWN ANOTHER 99%',
];

export const KONAMI_TEXT = {
  title: 'BLACK FRIDAY!',
  subtitle: "70% OFF EVERYTHING",
};

export const GAMESTONK_ITEMS: string[] = [
  'EXPIRED COUPON',
  'PRE-OWNED STRATEGY GUIDE',
  'PET ROCK',
  'MOOD RING',
  '1 SHARE (DOWN 99%)',
];

export const GAMESTONK_DIALOG = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";

export const GAME_OVER_LINES: string[] = [
  'ATTENTION SHOPPERS:',
  'THE MALL IS NOW CLOSED',
];

export const FLOOR_ANNOUNCEMENTS: Record<string, string> = {
  R: 'R - ROOFTOP',
  '4F': '4F - FASHION & GADGETS',
  '3F': '3F - TOYS & NOVELTIES',
  '2F': '2F - MUSIC & FOOD',
  '1F': '1F - SPORTS & BOOKS',
  P: 'P - PARKING',
};

export const MALL_COP_LINE = 'HEY! STOP RIGHT THERE!';
export const MALL_WALKER_LINE = 'HEY!';
export const FITTING_ROOM_LINE = 'OCCUPIED!!';
export const DETAINED_LINE = 'DETAINED! -500';
export const PACKAGES_LEFT_LINE = 'PACKAGES LEFT:';
