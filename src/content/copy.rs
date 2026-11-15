//! ALL the game's copy lives here. To add a joke, add a line to the right list;
//! the content tests check that every line fits on screen (and is drawable with
//! the bitmap fonts). Keep everything UPPERCASE. Limits:
//!   speech bubbles <= 28 chars, SPYGRAM caption lines <= 21 chars (2 lines max),
//!   comments <= 21 chars, headline lines <= 26 chars (after wrapping), banners <= 40 chars.
use super::stores::StoreId;

#[derive(Clone, Copy, Debug)]
pub struct SpygramPost {
    /// 1-2 caption lines, each <= 21 chars.
    pub caption: &'static [&'static str],
    /// Single comment line, <= 21 chars ("WHO: TEXT").
    pub comment: &'static str,
}

/// Who speaks: a guard spy (first spy in the room) or the security bot.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BubbleWho {
    Spy,
    Bot,
}

impl BubbleWho {
    pub const fn as_str(self) -> &'static str {
        match self {
            BubbleWho::Spy => "spy",
            BubbleWho::Bot => "bot",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct BubbleLine {
    pub who: BubbleWho,
    pub text: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub bubble: usize,
    pub caption_line: usize,
    pub caption_lines: usize,
    pub comment: usize,
    pub headline_line: usize,
    pub banner: usize,
    pub pa_line: usize,
}

#[derive(Clone, Copy, Debug)]
pub struct Shouts {
    pub walker: &'static str,
    pub cop: &'static str,
    pub fitting: &'static str,
    pub detained: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct EasterEgg {
    pub clerk: &'static str,
    pub items: &'static [&'static str],
    pub you_got: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct Ui {
    pub studio: &'static str,
    pub presents: &'static str,
    pub title: &'static str,
    pub subtitle: &'static str,
    pub copyright: &'static str,
    pub press_start: &'static str,
    pub hint1: &'static str,
    pub hint2: &'static str,
    pub black_friday: &'static str,
    pub black_friday_off: &'static str,
    pub pause: &'static str,
    pub directory: &'static str,
    pub continue_q: &'static str,
    pub game_over: &'static str,
    pub closed_line1: &'static str,
    pub closed_line2: &'static str,
    pub alarm_banner: &'static str,
    pub mission: &'static str,
    pub alarm_hud: &'static str,
    pub trap: &'static str,
    pub nothing: &'static str,
    pub press_to_search: &'static str,
    pub searching: &'static str,
    pub now_playing: &'static str,
    pub level_clear: &'static str,
    pub crt_on: &'static str,
    pub crt_off: &'static str,
    pub sound_on: &'static str,
    pub sound_off: &'static str,
    pub newspaper_name: &'static str,
    pub spygram: &'static str,
    pub no_gfx: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct MapText {
    pub legend_package: &'static str,
    pub legend_cleared: &'static str,
    pub legend_powerup: &'static str,
    pub legend_closed: &'static str,
    pub legend_you: &'static str,
    pub legend_radar: &'static str,
    pub legend_car: &'static str,
    pub legend_getaway: &'static str,
    pub legend_escalator: &'static str,
    pub items: &'static str,
    pub close: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct TallyText {
    pub packages: &'static str,
    pub time: &'static str,
    pub clear: &'static str,
    pub score: &'static str,
    pub thanks: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct NewsText {
    pub edition: &'static str,
    pub price: &'static str,
    pub tagline: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct GameOverText {
    pub score: &'static str,
    pub hi_score: &'static str,
    pub new_record: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct TitleText {
    pub hi_score: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct GarageText {
    pub exit: &'static str,
    pub level: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct SpygramText {
    pub user: &'static str,
    pub likes: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct ScreenText {
    pub map: MapText,
    pub tally: TallyText,
    pub chase: &'static str,
    pub news: NewsText,
    pub game_over: GameOverText,
    pub title: TitleText,
    pub garage: GarageText,
    pub spygram: SpygramText,
}

pub const LIMITS: Limits = Limits {
        bubble: 28,
        caption_line: 21,
        caption_lines: 2,
        comment: 21,
        headline_line: 26,
        banner: 40,
        pa_line: 28,
    };

/// Posted on the roof after the zip-line landing.
pub const SPYGRAM_ARRIVAL: &[SpygramPost] = &[
    SpygramPost { caption: &["FEELING CUTE,", "MIGHT DELETE LATER"], comment: "MOM: SO PROUD OF U" },
    SpygramPost { caption: &["FIRST DAY ON THE JOB!", "#BLESSED"], comment: "BOSS: DELETE THIS" },
    SpygramPost { caption: &["MALL RAT? NO.", "MALL AGENT."], comment: "MOM: WEAR A JACKET" },
    SpygramPost { caption: &["ZIPLINE WAS $0.", "PARKING WAS $12."], comment: "DAD: TOLD U SO" },
    SpygramPost { caption: &["OUTFIT OF THE DAY:", "TRENCHCOAT, AGAIN"], comment: "FOREVER12: 20% OFF!" },
    SpygramPost { caption: &["NO SPIES WERE HARMED", "IN THIS SELFIE. YET."], comment: "DIMITRI: :(" },
    SpygramPost { caption: &["ROOFTOP VIBES", "#UNDERCOVER"], comment: "HQ: WHY IS IT PUBLIC" },
    SpygramPost { caption: &["DON'T TELL HQ, I'M", "HERE FOR PRETZELS"], comment: "HQ: WE CAN SEE THIS" },
    SpygramPost { caption: &["GOLDEN HOUR.", "LICENSE TO CHILL."], comment: "MOM: CALL YOUR MOTHER" },
    SpygramPost { caption: &["SECRET MISSION.", "PLEASE LIKE & SHARE"], comment: "HQ: ...SERIOUSLY?" },
];

/// Posted after the level clear.
pub const SPYGRAM_COMPLETE: &[SpygramPost] = &[
    SpygramPost { caption: &["MISSION COMPLETE.", "ALSO BOUGHT SOCKS."], comment: "MOM: WHAT COLOR?" },
    SpygramPost { caption: &["6 PACKAGES.", "0 RECEIPTS. #WIN"], comment: "RETURNS DESK: NO" },
    SpygramPost { caption: &["SAVED THE WORLD.", "STILL NO PARKING."], comment: "DAD: TYPICAL" },
    SpygramPost { caption: &["SPIES: 0", "ME: 1 #MALLRAT"], comment: "BORIS: REMATCH?" },
    SpygramPost { caption: &["GETAWAY CAR:", "WOOD PANELING. ICONIC"], comment: "HQ: RETURN THE CAR" },
    SpygramPost { caption: &["TREATED MYSELF TO A", "CINNABOMB. EARNED IT."], comment: "MOM: EAT A VEGGIE" },
    SpygramPost { caption: &["HQ SAID KEEP IT QUIET", "SO HERE IS A POST"], comment: "HQ: YOU'RE FIRED" },
    SpygramPost { caption: &["FOUND A PET ROCK.", "HIS NAME IS KEVIN."], comment: "KEVIN: ..." },
    SpygramPost { caption: &["BRB, RETURNING 6", "SUSPICIOUS PACKAGES"], comment: "MALL COP: WAIT WHAT" },
    SpygramPost { caption: &["SEE YOU NEXT LOOP,", "FOOD COURT"], comment: "HOT SPY: ♥♥♥" },
];

/// First-visit lines (guards hold still; the second line comes ~1 s after the first). Only 9 stores have them;
/// look up with `first_visit(id)`.
pub const FIRST_VISIT: &[(StoreId, &[BubbleLine])] = &[
    (StoreId::Kgbtoys, &[BubbleLine { who: BubbleWho::Spy, text: "DIMITRI, HE'S HERE!" }, BubbleLine { who: BubbleWho::Spy, text: "DA! HIDE THE TEDDIES!" }]),
    (StoreId::Forever12, &[BubbleLine { who: BubbleWho::Spy, text: "IT'S NOT A DISGUISE." }, BubbleLine { who: BubbleWho::Spy, text: "IT'S A LOOK, SERGEI." }]),
    (StoreId::Radioshock, &[BubbleLine { who: BubbleWho::Spy, text: "YOU'LL NEED BATTERIES." }, BubbleLine { who: BubbleWho::Bot, text: "BEEP. NOT INCLUDED." }]),
    (StoreId::Hotspy, &[BubbleLine { who: BubbleWho::Spy, text: "WANT FRIES WITH THAT?" }]),
    (StoreId::Footlock, &[BubbleLine { who: BubbleWho::Spy, text: "THESE ARE MY GETAWAY SHOES" }, BubbleLine { who: BubbleWho::Spy, text: "BOTH LEFT FEET, COMRADE" }]),
    (StoreId::Sambaddy, &[BubbleLine { who: BubbleWho::Spy, text: "TURN IT UP, BORIS!" }]),
    (StoreId::Crookstone, &[BubbleLine { who: BubbleWho::Spy, text: "TRY THE MASSAGE CHAIR..." }]),
    (StoreId::Sharper, &[BubbleLine { who: BubbleWho::Bot, text: "BEEP. PLEASE DON'T TOUCH." }]),
    (StoreId::Spenders, &[BubbleLine { who: BubbleWho::Spy, text: "WHOA... THE LAVA LAMP..." }]),
];

/// About 35% of spy kills in the mall.
pub const LAST_WORDS: &[&str] = &["I WAS JUST BROWSING!", "WHAT'S YOUR RETURN POLICY?!", "I HAD A COUPON!", "TELL MY CAT...", "NOT THE FACE!", "I WAS ON MY LUNCH BREAK!", "WORTH IT. 70% OFF.", "MY RECEIPT..."];

/// Spies stepping out of an elevator.
pub const ELEVATOR_EXIT_LINES: &[&str] = &["...NICE WEATHER.", "GOING DOWN? ME TOO.", "*AWKWARD COUGH*", "THIS IS MY FLOOR, ACTUALLY"];

/// Single-word shouts.
pub const SHOUTS: Shouts = Shouts {
        walker: "HEY!",
        cop: "HEY! STOP RIGHT THERE!",
        fitting: "OCCUPIED!!",
        detained: "DETAINED! -500",
    };

/// Mall PA announcements (a chime + multi-line banner about once a minute). Never the same twice in a row.
pub const PA_LINES: &[&str] = &[
    "ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.",
    "FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.",
    "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
    "LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.",
    "BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.",
    "THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.",
    "A REMINDER: SECURITY IS WATCHING. MOSTLY TV.",
];

/// THE DAILY MALL front-page headlines (wrapped to <= 26 chars per line at draw time with wrap_words).
pub const HEADLINES: &[&str] = &[
    "LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING",
    "SPIES FOILED; FOOD COURT SALES UP 300%",
    "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
    "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
    "GAMESTONK SHARE PRICE DOWN ANOTHER 99%",
];

// elevator floor banners
pub const FLOOR_BANNERS: &[&str] = &[
    "R - ROOF ACCESS. BEWARE PIGEONS",
    "4F - FASHION & GADGETS, SPIES",
    "3F - TOYS, LAVA LAMPS, SPIES",
    "2F - MUSIC & CORN DOGS, SPIES",
    "1F - SHOES & MOPPED FLOORS",
    "P - PARKING. IT COSTS $12",
];

// GameStop easter egg
pub const EASTER_EGG: EasterEgg = EasterEgg {
        clerk: "IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
        items: &["EXPIRED COUPON", "PRE-OWNED STRATEGY GUIDE", "PET ROCK", "MOOD RING", "1 SHARE (DOWN 99%)"],
        you_got: "YOU GOT: ",
    };

/// misc UI strings (banners, titles, prompts)
pub const UI: Ui = Ui {
        studio: "FLICKERSOFT",
        presents: "PRESENTS",
        title: "MALL ACTION",
        subtitle: "A SHOPPING MALL ESPIONAGE",
        copyright: "(C) 2026 FLICKERSOFT",
        press_start: "PRESS START",
        hint1: "ARROWS MOVE  Z SHOOT  X JUMP",
        hint2: "SHIFT MAP  ENTER PAUSE  C CRT",
        black_friday: "BLACK FRIDAY!",
        black_friday_off: "70% OFF EVERYTHING",
        pause: "PAUSE",
        directory: "MALL DIRECTORY",
        continue_q: "CONTINUE?",
        game_over: "GAME OVER",
        closed_line1: "ATTENTION SHOPPERS:",
        closed_line2: "THE MALL IS NOW CLOSED",
        alarm_banner: "ALARM! SECURITY ALERTED",
        mission: "FIND 6 PACKAGES. LOOK FOR RED DOORS!",
        alarm_hud: "ALARM",
        trap: "IT'S A TRAP!",
        nothing: "NOTHING HERE",
        press_to_search: "PRESS X TO SEARCH",
        searching: "SEARCHING...",
        now_playing: "NOW PLAYING: SIDE B",
        level_clear: "LEVEL CLEAR",
        crt_on: "CRT ON",
        crt_off: "CRT OFF",
        sound_on: "SOUND ON",
        sound_off: "SOUND OFF",
        newspaper_name: "THE DAILY MALL",
        spygram: "SPYGRAM",
        no_gfx: "THIS GAME NEEDS WEBGL. PLEASE USE A MODERN DESKTOP BROWSER WITH HARDWARE ACCELERATION.",
    };

/// Small UI labels of the screens: map legend, bonus tally, newspaper furniture, game-over labels.
/// `chase` is the spy chasing the getaway car (<= 28 chars, a speech bubble).
pub const SCREEN_TEXT: ScreenText = ScreenText {
        map: MapText {
        legend_package: "PACKAGE",
        legend_cleared: "CLEARED",
        legend_powerup: "POWER-UP",
        legend_closed: "CLOSED",
        legend_you: "YOU",
        legend_radar: "PACKAGE HERE",
        legend_car: "ELEVATOR",
        legend_getaway: "GETAWAY CAR",
        legend_escalator: "ESCALATOR",
        items: "ITEMS:",
        close: "SELECT: CLOSE",
    },
        tally: TallyText {
        packages: "PACKAGES",
        time: "TIME BONUS",
        clear: "CLEAR BONUS",
        score: "SCORE",
        thanks: "THANK YOU, COME AGAIN",
    },
        chase: "SIR! YOUR RECEIPT!",
        news: NewsText {
        edition: "LATE EDITION",
        price: "25 CENTS",
        tagline: "ALL THE NEWS THAT FITS IN A MALL",
    },
        game_over: GameOverText {
        score: "SCORE",
        hi_score: "HI-SCORE",
        new_record: "NEW HIGH SCORE!",
    },
        title: TitleText {
        hi_score: "HI-SCORE",
    },
        garage: GarageText {
        exit: "EXIT",
        level: "P",
    },
        spygram: SpygramText {
        user: "AGENT 7",
        likes: "LIKES",
    },
    };


/// First-visit speech bubble lines for a store (None for the 4 stores without any).
pub fn first_visit(id: StoreId) -> Option<&'static [BubbleLine]> {
    FIRST_VISIT.iter().find(|(s, _)| *s == id).map(|(_, l)| *l)
}

/// Greedy word wrap by character count (copy is pre-split so length tests are flat loops).
/// Counts `char`s (TS counted UTF-16 units; identical for the copy, which is ASCII apart from one U+2665).
pub fn wrap_words(text: &str, max_chars: usize) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut line = String::new();
    for word in text.split(' ') {
        let trial = if !line.is_empty() { format!("{} {}", line, word) } else { word.to_string() };
        if !line.is_empty() && trial.chars().count() > max_chars {
            lines.push(line);
            line = word.to_string();
        } else {
            line = trial;
        }
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
}

pub fn package_banner(n: i32) -> String {
    format!("PACKAGE {}/6", n)
}
pub fn packages_left(n: i32) -> String {
    format!("PACKAGES LEFT: {}", n)
}
pub fn continues_left(n: i32) -> String {
    format!("CONTINUES LEFT: {}", n)
}
pub fn you_got(item: &str) -> String {
    format!("{}{}", EASTER_EGG.you_got, item)
}
pub fn loop_label(n: i32) -> String {
    format!("LOOP {}", n)
}
