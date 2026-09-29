export interface SpygramPost {
  lines: string[];
  comment: string;
}

export const COPY = {
  SPYGRAM_ARRIVAL: [
    { lines: ["FEELING CUTE,", "MIGHT DELETE LATER"], comment: "(MOM: SO PROUD OF U)" },
    { lines: ["FIRST DAY ON THE JOB!", "#BLESSED"], comment: "(BOSS: DELETE THIS)" },
    { lines: ["MALL RAT? NO.", "MALL AGENT."], comment: "(MOM: WEAR A JACKET)" },
    { lines: ["ZIPLINE WAS $0.", "PARKING WAS $12."], comment: "(DAD: TOLD U SO)" },
    { lines: ["OUTFIT OF THE DAY:", "TRENCHCOAT, AGAIN"], comment: "(FOREVER12: 20% OFF!)" },
    { lines: ["NO SPIES WERE HARMED", "IN THIS SELFIE. YET."], comment: "(DIMITRI: :( )" },
    { lines: ["ROOFTOP VIBES", "#UNDERCOVER"], comment: "(HQ: WHY SO PUBLIC?)" },
    { lines: ["DON'T TELL HQ, I'M", "HERE FOR PRETZELS"], comment: "(HQ: WE CAN SEE THIS)" },
    { lines: ["GOLDEN HOUR.", "LICENSE TO CHILL."], comment: "(MOM: CALL YOUR MOM)" },
    { lines: ["SECRET MISSION.", "PLEASE LIKE & SHARE"], comment: "(HQ: ...SERIOUSLY?)" }
  ] as SpygramPost[],

  SPYGRAM_COMPLETE: [
    { lines: ["MISSION COMPLETE.", "ALSO BOUGHT SOCKS."], comment: "(MOM: WHAT COLOR?)" },
    { lines: ["6 PACKAGES.", "0 RECEIPTS. #WIN"], comment: "(RETURNS DESK: NO)" },
    { lines: ["SAVED THE WORLD.", "STILL NO PARKING."], comment: "(DAD: TYPICAL)" },
    { lines: ["SPIES: 0", "ME: 1 #MALLRAT"], comment: "(BORIS: REMATCH?)" },
    { lines: ["GETAWAY CAR:", "WOOD PANELING. ICONIC"], comment: "(HQ: RETURN THE CAR)" },
    { lines: ["TREATED MYSELF TO A", "CINNABOMB. EARNED IT."], comment: "(MOM: EAT A VEGGIE)" },
    { lines: ["HQ SAID KEEP IT QUIET", "SO HERE IS A POST"], comment: "(HQ: YOU'RE FIRED)" },
    { lines: ["FOUND A PET ROCK.", "HIS NAME IS KEVIN."], comment: "(KEVIN: ...)" },
    { lines: ["BRB, RETURNING 6", "SUSPICIOUS PACKAGES"], comment: "(MALL COP: WAIT WHAT)" },
    { lines: ["SEE YOU NEXT LOOP,", "FOOD COURT"], comment: "(HOT SPY: ♥♥♥)" }
  ] as SpygramPost[],

  FIRST_VISIT_STORE_LINES: {
    "KGB TOYS": ["DIMITRI, HE'S HERE!", "DA! HIDE THE TEDDIES!"],
    "FOREVER 12": ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
    "RADIOSHOCK": ["YOU'LL NEED BATTERIES.", "BEEP. NOT INCLUDED."],
    "HOT SPY ON A STICK": ["WANT FRIES WITH THAT?"],
    "FOOT LOCKPICKER": ["THESE ARE MY GETAWAY SHOES", "BOTH LEFT FEET, COMRADE"],
    "SAM BADDY": ["TURN IT UP, BORIS!"],
    "CROOKSTONE": ["TRY THE MASSAGE CHAIR..."],
    "SHARPER IMAGINE": ["BEEP. PLEASE DON'T TOUCH."],
    "SPENDER'S GIFTS": ["WHOA... THE LAVA LAMP..."]
  } as Record<string, string[]>,

  SPY_LAST_WORDS: [
    "I WAS JUST BROWSING!",
    "WHAT'S YOUR RETURN POLICY?!",
    "I HAD A COUPON!",
    "TELL MY CAT...",
    "NOT THE FACE!",
    "I WAS ON MY LUNCH BREAK!",
    "WORTH IT. 70% OFF.",
    "MY RECEIPT..."
  ],

  ELEVATOR_SPY_LINES: [
    "...NICE WEATHER.",
    "GOING DOWN? ME TOO.",
    "*AWKWARD COUGH*",
    "THIS IS MY FLOOR, ACTUALLY"
  ],

  MALL_PA: [
    "ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.",
    "FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.",
    "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
    "LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.",
    "BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.",
    "THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.",
    "A REMINDER: SECURITY IS WATCHING. MOSTLY TV."
  ],

  DAILY_MALL_HEADLINES: [
    "LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING",
    "SPIES FOILED; FOOD COURT SALES UP 300%",
    "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
    "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
    "GAMESTONK SHARE PRICE DOWN ANOTHER 99%"
  ],

  GAMESTONK_TEXT: "IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
  FITTING_ROOM_SHRIEK: "OCCUPIED!!",
  WALKER_HEY: "HEY!",
  COP_WHISTLE: "HEY! STOP RIGHT THERE!",
  COP_DETAIN: "DETAINED! -500",
  MALL_CLOSED: "ATTENTION SHOPPERS: / THE MALL IS NOW CLOSED",
  BLACK_FRIDAY: "BLACK FRIDAY! 70% OFF EVERYTHING",
};

/**
 * Validates text string lengths according to section 9 rules.
 */
export function validateCopyLimits(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Speech bubbles <= 28 chars
  const validateBubble = (str: string, label: string) => {
    if (str.length > 28) {
      errors.push(`Bubble too long (${str.length} > 28) [${label}]: "${str}"`);
    }
  };

  for (const [store, lines] of Object.entries(COPY.FIRST_VISIT_STORE_LINES)) {
    lines.forEach((l, i) => validateBubble(l, `Store ${store} L${i}`));
  }

  COPY.SPY_LAST_WORDS.forEach((l, i) => validateBubble(l, `Spy last word ${i}`));
  COPY.ELEVATOR_SPY_LINES.forEach((l, i) => validateBubble(l, `Elevator spy line ${i}`));
  validateBubble(COPY.FITTING_ROOM_SHRIEK, "Fitting room");
  validateBubble(COPY.WALKER_HEY, "Walker hey");

  // SPYGRAM captions: <= 21 chars, max 2 lines. Comments <= 21 chars
  const validatePost = (post: SpygramPost, label: string) => {
    if (post.lines.length > 2) {
      errors.push(`SPYGRAM post has >2 lines [${label}]`);
    }
    post.lines.forEach((l, i) => {
      if (l.length > 21) {
        errors.push(`SPYGRAM line too long (${l.length} > 21) [${label} L${i}]: "${l}"`);
      }
    });
    if (post.comment.length > 21) {
      errors.push(`SPYGRAM comment too long (${post.comment.length} > 21) [${label}]: "${post.comment}"`);
    }
  };

  COPY.SPYGRAM_ARRIVAL.forEach((p, i) => validatePost(p, `Arrival ${i}`));
  COPY.SPYGRAM_COMPLETE.forEach((p, i) => validatePost(p, `Complete ${i}`));

  // Headline lines <= 26 chars (when wrapped or formatted)
  // Let's check headlines (they may wrap, but each full line in single line or wrapped parts must be manageable)
  // Headlines are rendered across max 26 chars per line.

  return { valid: errors.length === 0, errors };
}
