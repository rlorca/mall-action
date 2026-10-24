// All player-facing jokes live here. Tests enforce their pixel-safe lengths.
export const ARRIVAL_POSTS = [
  { caption: ["FEELING CUTE,", "MIGHT DELETE LATER"], comment: "MOM: SO PROUD OF U" },
  { caption: ["FIRST DAY ON THE JOB!", "#BLESSED"], comment: "BOSS: DELETE THIS" },
  { caption: ["MALL RAT? NO.", "MALL AGENT."], comment: "MOM: WEAR A JACKET" },
  { caption: ["ZIPLINE WAS $0.", "PARKING WAS $12."], comment: "DAD: TOLD U SO" },
  { caption: ["OUTFIT OF THE DAY:", "TRENCHCOAT, AGAIN"], comment: "FOREVER12: 20% OFF!" },
  { caption: ["NO SPIES WERE HARMED", "IN THIS SELFIE. YET."], comment: "DIMITRI: :( " },
  { caption: ["ROOFTOP VIBES", "#UNDERCOVER"], comment: "HQ: WHY IS IT PUBLIC" },
  { caption: ["DON'T TELL HQ, I'M", "HERE FOR PRETZELS"], comment: "HQ: WE CAN SEE THIS" },
  { caption: ["GOLDEN HOUR.", "LICENSE TO CHILL."], comment: "MOM: CALL YOUR MOTHER" },
  { caption: ["SECRET MISSION.", "PLEASE LIKE & SHARE"], comment: "HQ: ...SERIOUSLY?" },
];

export const COMPLETE_POSTS = [
  { caption: ["MISSION COMPLETE.", "ALSO BOUGHT SOCKS."], comment: "MOM: WHAT COLOR?" },
  { caption: ["6 PACKAGES.", "0 RECEIPTS. #WIN"], comment: "RETURNS DESK: NO" },
  { caption: ["SAVED THE WORLD.", "STILL NO PARKING."], comment: "DAD: TYPICAL" },
  { caption: ["SPIES: 0", "ME: 1 #MALLRAT"], comment: "BORIS: REMATCH?" },
  { caption: ["GETAWAY CAR:", "WOOD PANELING. ICONIC"], comment: "HQ: RETURN THE CAR" },
  { caption: ["TREATED MYSELF TO A", "CINNABOMB. EARNED IT."], comment: "MOM: EAT A VEGGIE" },
  { caption: ["HQ SAID KEEP IT QUIET", "SO HERE IS A POST"], comment: "HQ: YOU'RE FIRED" },
  { caption: ["FOUND A PET ROCK.", "HIS NAME IS KEVIN."], comment: "KEVIN: ..." },
  { caption: ["BRB, RETURNING 6", "SUSPICIOUS PACKAGES"], comment: "MALL COP: WAIT WHAT" },
  { caption: ["SEE YOU NEXT LOOP,", "FOOD COURT"], comment: "HOT SPY: <3<3<3" },
];

export const STORE_LINES = {
  kgb: ["DIMITRI, HE'S HERE!", "DA! HIDE THE TEDDIES!"],
  forever: ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
  radio: ["YOU'LL NEED BATTERIES.", "BEEP. NOT INCLUDED."],
  hotspy: ["WANT FRIES WITH THAT?"],
  foot: ["THESE ARE MY GETAWAY SHOES", "BOTH LEFT FEET, COMRADE"],
  sam: ["TURN IT UP, BORIS!"],
  crook: ["TRY THE MASSAGE CHAIR..."],
  sharper: ["BEEP. PLEASE DON'T TOUCH."],
  spender: ["WHOA... THE LAVA LAMP..."],
};

export const LAST_WORDS = [
  "I WAS JUST BROWSING!", "WHAT'S YOUR RETURN POLICY?!", "I HAD A COUPON!",
  "TELL MY CAT...", "NOT THE FACE!", "I WAS ON MY LUNCH BREAK!",
  "WORTH IT. 70% OFF.", "MY RECEIPT...",
];
export const ELEVATOR_LINES = ["...NICE WEATHER.", "GOING DOWN? ME TOO.", "*AWKWARD COUGH*", "THIS IS MY FLOOR, ACTUALLY"];
export const PA_LINES = [
  "ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.",
  "FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.",
  "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
  "LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.",
  "BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.",
  "THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.",
  "A REMINDER: SECURITY IS WATCHING. MOSTLY TV.",
];
export const HEADLINES = [
  ["LOCAL AGENT FINDS 6", "PACKAGES, STILL NO PARKING"],
  ["SPIES FOILED; FOOD COURT", "SALES UP 300%"],
  ["MAN ZIPLINES ONTO ROOF.", "SECURITY 'NOT SURPRISED'"],
  ["MALL WALKERS DEMAND", "APOLOGY FOR 'HEY!'", "INCIDENT"],
  ["GAMESTONK SHARE PRICE", "DOWN ANOTHER 99%"],
];
export const JOKE_ITEMS = ["EXPIRED COUPON", "PRE-OWNED STRATEGY GUIDE", "PET ROCK", "MOOD RING", "1 SHARE (DOWN 99%)"];
export const FLOOR_BANNERS = {
  R: "R - ROOFTOP & ZIPLINES", "4F": "4F - FASHION & GADGETS, SPIES",
  "3F": "3F - TOYS, TUNES & TROUBLE", "2F": "2F - SNACKS & SNEAKERS",
  "1F": "1F - SHOES & LAST CHANCES", P: "P - PARKING & FREEDOM",
};

export function wrapText(text, max = 30) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}
