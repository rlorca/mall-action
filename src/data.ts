// Game data: stores, palettes, copy, music, etc.

import { Floor } from './types';

export const PALETTE = [
  '#000000', // 0: black
  '#ffffff', // 1: white
  '#ff0000', // 2: red
  '#00ff00', // 3: green
  '#0000ff', // 4: blue
  '#ffff00', // 5: yellow
  '#ff00ff', // 6: magenta
  '#00ffff', // 7: cyan
  '#888888', // 8: gray
  '#ff8800', // 9: orange
  '#ff0088', // 10: pink
  '#8800ff', // 11: purple
  '#008888', // 12: teal
  '#880088', // 13: dark magenta
  '#888800', // 14: olive
  '#008800', // 15: dark green
];

export interface Store {
  name: string;
  shortName: string;
  floor: Floor;
  x: number; // pixel position in mall
  role: 'target' | 'powerup' | 'closed';
  hasPackage: boolean;
  theme: string;
  displayItems: string[];
}

export const STORES: Store[] = [
  {
    name: 'FOREVER 12',
    shortName: 'F12',
    floor: Floor.Floor4,
    x: 80,
    role: 'target',
    hasPackage: true,
    theme: 'fashion',
    displayItems: ['mannequins', 'rack'],
  },
  {
    name: 'RADIOSHOCK',
    shortName: 'RS',
    floor: Floor.Floor4,
    x: 160,
    role: 'target',
    hasPackage: true,
    theme: 'electronics',
    displayItems: ['tvs', 'walkie'],
  },
  {
    name: 'CROOKSTONE',
    shortName: 'CR',
    floor: Floor.Floor4,
    x: 240,
    role: 'powerup',
    hasPackage: false,
    theme: 'gadgets',
    displayItems: ['chair', 'gadgets'],
  },
  {
    name: 'GAMESTONK',
    shortName: 'GS',
    floor: Floor.Floor4,
    x: 320,
    role: 'powerup',
    hasPackage: false,
    theme: 'games',
    displayItems: ['console', 'poster'],
  },
  {
    name: 'KGB TOYS',
    shortName: 'KT',
    floor: Floor.Floor3,
    x: 80,
    role: 'target',
    hasPackage: true,
    theme: 'toys',
    displayItems: ['bears', 'robot'],
  },
  {
    name: 'BLOCKBLUSTER',
    shortName: 'BB',
    floor: Floor.Floor3,
    x: 160,
    role: 'closed',
    hasPackage: false,
    theme: 'video',
    displayItems: ['shutter'],
  },
  {
    name: "SPENDER'S GIFTS",
    shortName: 'SG',
    floor: Floor.Floor3,
    x: 240,
    role: 'powerup',
    hasPackage: false,
    theme: 'novelty',
    displayItems: ['lava', 'plasma'],
  },
  {
    name: 'SAM BADDY',
    shortName: 'SB',
    floor: Floor.Floor2,
    x: 80,
    role: 'target',
    hasPackage: true,
    theme: 'music',
    displayItems: ['vinyl', 'boombox'],
  },
  {
    name: 'SHARPER IMAGINE',
    shortName: 'SI',
    floor: Floor.Floor2,
    x: 160,
    role: 'powerup',
    hasPackage: false,
    theme: 'gadgets',
    displayItems: ['robot', 'orb'],
  },
  {
    name: 'HOT SPY ON A STICK',
    shortName: 'HS',
    floor: Floor.Floor2,
    x: 240,
    role: 'target',
    hasPackage: true,
    theme: 'food',
    displayItems: ['tub', 'corn'],
  },
  {
    name: 'CIRCUIT PITY',
    shortName: 'CP',
    floor: Floor.Floor2,
    x: 320,
    role: 'closed',
    hasPackage: false,
    theme: 'electronics',
    displayItems: ['shutter'],
  },
  {
    name: 'FOOT LOCKPICKER',
    shortName: 'FL',
    floor: Floor.Floor1,
    x: 80,
    role: 'target',
    hasPackage: true,
    theme: 'sports',
    displayItems: ['shoes', 'ball'],
  },
  {
    name: 'BORDERLINE BOOKS',
    shortName: 'BB2',
    floor: Floor.Floor1,
    x: 160,
    role: 'closed',
    hasPackage: false,
    theme: 'books',
    displayItems: ['shutter'],
  },
];

export const COPY = {
  // SPYGRAM posts (arrival)
  spygramArrival: [
    { caption: 'FEELING CUTE,\nMIGHT DELETE LATER', comment: 'MOM: SO PROUD OF U' },
    { caption: 'FIRST DAY ON THE JOB!\n#BLESSED', comment: 'BOSS: DELETE THIS' },
    { caption: 'MALL RAT? NO.\nMALL AGENT.', comment: 'MOM: WEAR A JACKET' },
    { caption: 'ZIPLINE WAS $0.\nPARKING WAS $12.', comment: 'DAD: TOLD U SO' },
    { caption: 'OUTFIT OF THE DAY:\nTRENCHCOAT, AGAIN', comment: 'FOREVER12: 20% OFF!' },
    { caption: 'NO SPIES WERE HARMED\nIN THIS SELFIE. YET.', comment: 'DIMITRI: :( ' },
    { caption: 'ROOFTOP VIBES\n#UNDERCOVER', comment: 'HQ: WHY IS IT PUBLIC' },
    { caption: "DON'T TELL HQ, I'M\nHERE FOR PRETZELS", comment: 'HQ: WE CAN SEE THIS' },
    { caption: 'GOLDEN HOUR.\nLICENSE TO CHILL.', comment: 'MOM: CALL YOUR MOTHER' },
    { caption: 'SECRET MISSION.\nPLEASE LIKE & SHARE', comment: 'HQ: ...SERIOUSLY?' },
  ],

  // SPYGRAM posts (mission complete)
  spygramComplete: [
    { caption: 'MISSION COMPLETE.\nALSO BOUGHT SOCKS.', comment: 'MOM: WHAT COLOR?' },
    { caption: '6 PACKAGES.\n0 RECEIPTS. #WIN', comment: 'RETURNS DESK: NO' },
    { caption: 'SAVED THE WORLD.\nSTILL NO PARKING.', comment: 'DAD: TYPICAL' },
    { caption: 'SPIES: 0 / ME: 1 #MALLRAT', comment: 'BORIS: REMATCH?' },
    { caption: 'GETAWAY CAR:\nWOOD PANELING. ICONIC', comment: 'HQ: RETURN THE CAR' },
    { caption: 'TREATED MYSELF TO A\nCINNABOMB. EARNED IT.', comment: 'MOM: EAT A VEGGIE' },
    { caption: 'HQ SAID KEEP IT QUIET\nSO HERE IS A POST', comment: "HQ: YOU'RE FIRED" },
    { caption: 'FOUND A PET ROCK.\nHIS NAME IS KEVIN.', comment: 'KEVIN: ...' },
    { caption: 'BRB, RETURNING 6\nSUSPICIOUS PACKAGES', comment: 'MALL COP: WAIT WHAT' },
    { caption: 'SEE YOU NEXT LOOP,\nFOOD COURT', comment: 'HOT SPY: ♥♥♥' },
  ],

  // Store first-visit lines
  storeLines: {
    'KGB TOYS': ['DIMITRI, HE\'S HERE!', 'DA! HIDE THE TEDDIES!'],
    'FOREVER 12': ['IT\'S NOT A DISGUISE.', 'IT\'S A LOOK, SERGEI.'],
    'RADIOSHOCK': ['YOU\'LL NEED BATTERIES.', 'BEEP. NOT INCLUDED.'],
    'HOT SPY ON A STICK': ['WANT FRIES WITH THAT?', ''],
    'FOOT LOCKPICKER': ['THESE ARE MY GETAWAY SHOES', 'BOTH LEFT FEET, COMRADE'],
    'SAM BADDY': ['TURN IT UP, BORIS!', ''],
    'CROOKSTONE': ['TRY THE MASSAGE CHAIR...', ''],
    'SHARPER IMAGINE': ['BEEP. PLEASE DON\'T TOUCH.', ''],
    "SPENDER'S GIFTS": ['WHOA... THE LAVA LAMP...', ''],
  },

  // Spy last words
  spyLastWords: [
    'I WAS JUST BROWSING!',
    "WHAT'S YOUR RETURN POLICY?!",
    'I HAD A COUPON!',
    'TELL MY CAT...',
    'NOT THE FACE!',
    'I WAS ON MY LUNCH BREAK!',
    'WORTH IT. 70% OFF.',
    'MY RECEIPT...',
  ],

  // Spy elevator lines
  spyElevatorLines: [
    '...NICE WEATHER.',
    'GOING DOWN? ME TOO.',
    '*AWKWARD COUGH*',
    'THIS IS MY FLOOR, ACTUALLY',
  ],

  // PA announcements
  paAnnouncements: [
    'ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.',
    'FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.',
    "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
    'LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.',
    'BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.',
    'THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.',
    'A REMINDER: SECURITY IS WATCHING. MOSTLY TV.',
  ],

  // Headlines
  headlines: [
    'LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING',
    'SPIES FOILED; FOOD COURT SALES UP 300%',
    'MAN ZIPLINES ONTO ROOF. SECURITY "NOT SURPRISED"',
    'MALL WALKERS DEMAND APOLOGY FOR "HEY!" INCIDENT',
    'GAMESTONK SHARE PRICE DOWN ANOTHER 99%',
  ],
};

export const SCORES = {
  spyShot: 100,
  spyCrushed: 300,
  spyLamp: 300,
  spyDiscoBall: 300,
  package: 500,
  powerUp: 50,
  levelClear: 1000,
  timeBonus: 10,
  coin: 50,
  mallWalkerPenalty: -200,
  copPenalty: -500,
  jokeItem: 1,
};

export const PHYSICS = {
  playerWalkSpeed: 1,
  playerJumpForce: 8,
  playerGravity: 0.5,
  playerMaxFall: 10,
  spyWalkSpeed: 1,
  bulletSpeed: 4,
  spyBulletSpeed: 2,
  maxPlayerBullets: 2,
  elevatorSpeed: 1,
};

export const TIMINGS = {
  spyFirstShotDelay: 120, // frames
  spyShotCooldown: 150,
  spyDuckChance: 0.1,
  spySpawnDelay: 300,
  alarmTriggerTime: 9000, // 150 seconds
  invulnerabilityFrames: 120,
  lampDropped: 24,
  photoBoothDuration: 300,
  kioskCooldown: 1200,
  fountainCooldown: 900,
  levelClearScreenDuration: 300,
};
