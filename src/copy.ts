// Every line of copy lives here, in one easy-to-edit place.
// Length limits (enforced by tests):
//   speech bubbles: 28 chars, SPYGRAM caption: 21 chars x 2 lines,
//   comments: 21 chars, headlines: 26 chars.

export interface SpygramPost {
  caption: [string, string];
  comment: string;
}

export const SPYGRAM_ARRIVAL: SpygramPost[] = [
  { caption: ["FEELING CUTE,", "MIGHT DELETE LATER"], comment: "MOM: SO PROUD OF U" },
  { caption: ["FIRST DAY ON THE JOB!", "#BLESSED"], comment: "BOSS: DELETE THIS" },
  { caption: ["MALL RAT? NO.", "MALL AGENT."], comment: "MOM: WEAR A JACKET" },
  { caption: ["ZIPLINE WAS $0.", "PARKING WAS $12."], comment: "DAD: TOLD U SO" },
  { caption: ["OUTFIT OF THE DAY:", "TRENCHCOAT, AGAIN"], comment: "FOREVER12: 20% OFF!" },
  { caption: ["NO SPIES WERE HARMED", "IN THIS SELFIE. YET."], comment: "DIMITRI: :(" },
  { caption: ["ROOFTOP VIBES", "#UNDERCOVER"], comment: "HQ: WHY IS IT PUBLIC" },
  { caption: ["DON'T TELL HQ, I'M", "HERE FOR PRETZELS"], comment: "HQ: WE CAN SEE THIS" },
  { caption: ["GOLDEN HOUR.", "LICENSE TO CHILL."], comment: "MOM: CALL YOUR MOTHER" },
  { caption: ["SECRET MISSION.", "PLEASE LIKE & SHARE"], comment: "HQ: ...SERIOUSLY?" },
];

export const SPYGRAM_COMPLETE: SpygramPost[] = [
  { caption: ["MISSION COMPLETE.", "ALSO BOUGHT SOCKS."], comment: "MOM: WHAT COLOR?" },
  { caption: ["6 PACKAGES.", "0 RECEIPTS. #WIN"], comment: "RETURNS DESK: NO" },
  { caption: ["SAVED THE WORLD.", "STILL NO PARKING."], comment: "DAD: TYPICAL" },
  { caption: ["SPIES: 0", "ME: 1 #MALLRAT"], comment: "BORIS: REMATCH?" },
  { caption: ["GETAWAY CAR:", "WOOD PANELING. ICONIC"], comment: "HQ: RETURN THE CAR" },
  { caption: ["TREATED MYSELF TO A", "CINNABOMB. EARNED IT."], comment: "MOM: EAT A VEGGIE" },
  { caption: ["HQ SAID KEEP IT QUIET", "SO HERE IS A POST"], comment: "HQ: YOU'RE FIRED" },
  { caption: ["FOUND A PET ROCK.", "HIS NAME IS KEVIN."], comment: "KEVIN: ..." },
  { caption: ["BRB, RETURNING 6", "SUSPICIOUS PACKAGES"], comment: "MALL COP: WAIT WHAT" },
  { caption: ["SEE YOU NEXT LOOP,", "FOOD COURT"], comment: "HOT SPY: ♥♥♥" },
];

// First-visit store lines: [first line, second line (optional)].
export const STORE_LINES: Record<string, [string, string?]> = {
  "KGB TOYS": ["DIMITRI, HE'S HERE!", "DA! HIDE THE TEDDIES!"],
  "FOREVER 12": ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
  RADIOSHOCK: ["YOU'LL NEED BATTERIES.", "BEEP. NOT INCLUDED."],
  "HOT SPY ON A STICK": ["WANT FRIES WITH THAT?"],
  "FOOT LOCKPICKER": ["THESE ARE MY GETAWAY SHOES", "BOTH LEFT FEET, COMRADE"],
  "SAM BADDY": ["TURN IT UP, BORIS!"],
  CROOKSTONE: ["TRY THE MASSAGE CHAIR..."],
  "SHARPER IMAGINE": ["BEEP. PLEASE DON'T TOUCH."],
  "SPENDER'S GIFTS": ["WHOA... THE LAVA LAMP..."],
};

export const SPY_LAST_WORDS: string[] = [
  "I WAS JUST BROWSING!",
  "WHAT'S YOUR RETURN POLICY?!",
  "I HAD A COUPON!",
  "TELL MY CAT...",
  "NOT THE FACE!",
  "I WAS ON MY LUNCH BREAK!",
  "WORTH IT. 70% OFF.",
  "MY RECEIPT...",
];

export const SPY_ELEVATOR_LINES: string[] = [
  "...NICE WEATHER.",
  "GOING DOWN? ME TOO.",
  "*AWKWARD COUGH*",
  "THIS IS MY FLOOR, ACTUALLY",
];

export const PA_LINES: string[] = [
  "ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.",
  "FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.",
  "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
  "LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.",
  "BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.",
  "THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.",
  "A REMINDER: SECURITY IS WATCHING. MOSTLY TV.",
];

export const HEADLINES: string[] = [
  "LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING",
  "SPIES FOILED; FOOD COURT SALES UP 300%",
  "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
  "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
  "GAMESTONK SHARE PRICE DOWN ANOTHER 99%",
];

export const GAMESTONK_ITEMS: string[] = [
  "EXPIRED COUPON",
  "PRE-OWNED STRATEGY GUIDE",
  "PET ROCK",
  "MOOD RING",
  "1 SHARE (DOWN 99%)",
];

export const FLOOR_NAMES: Record<string, string> = {
  R: "ROOFTOP",
  "4F": "FASHION & GADGETS",
  "3F": "TOYS & NOVELTY",
  "2F": "MUSIC & FOOD",
  "1F": "SPORTS & BOOKS",
  P: "PARKING",
};

export const FLOOR_ORDER = ["R", "4F", "3F", "2F", "1F", "P"] as const;
export type FloorId = (typeof FLOOR_ORDER)[number];
