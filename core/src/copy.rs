//! ALL the jokes and in-game copy live here, in one place. Add lines to the arrays; the tests at the bottom
//! check that every line fits on screen (bubbles 28 chars, SPYGRAM captions 21 x 2 lines, comments 21,
//! headline lines 26).

use crate::types::{Floor, StoreId};

pub const BUBBLE_MAX: usize = 28;
pub const CAPTION_LINE_MAX: usize = 21;
pub const COMMENT_MAX: usize = 21;
pub const HEADLINE_LINE_MAX: usize = 26;
pub const BANNER_LINE_MAX: usize = 38;

/// Greedy word wrap.
pub fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut cur = String::new();
    for word in text.split_whitespace() {
        if cur.is_empty() {
            cur = word.to_string();
        } else if cur.chars().count() + 1 + word.chars().count() <= width {
            cur.push(' ');
            cur.push_str(word);
        } else {
            lines.push(std::mem::take(&mut cur));
            cur = word.to_string();
        }
    }
    if !cur.is_empty() {
        lines.push(cur);
    }
    lines
}

// ---------------------------------------------------------------------------------------------------------
// SPYGRAM
// ---------------------------------------------------------------------------------------------------------

pub struct Post {
    /// Two caption lines.
    pub caption: [&'static str; 2],
    /// Commenter name.
    pub who: &'static str,
    /// Comment text.
    pub comment: &'static str,
}

const fn post(a: &'static str, b: &'static str, who: &'static str, comment: &'static str) -> Post {
    Post { caption: [a, b], who, comment }
}

/// Posted after the zip-line landing.
pub const ARRIVAL_POSTS: [Post; 10] = [
    post("FEELING CUTE,", "MIGHT DELETE LATER", "MOM", "SO PROUD OF U"),
    post("FIRST DAY ON THE JOB!", "#BLESSED", "BOSS", "DELETE THIS"),
    post("MALL RAT? NO.", "MALL AGENT.", "MOM", "WEAR A JACKET"),
    post("ZIPLINE WAS $0.", "PARKING WAS $12.", "DAD", "TOLD U SO"),
    post("OUTFIT OF THE DAY:", "TRENCHCOAT, AGAIN", "FOREVER12", "20% OFF!"),
    post("NO SPIES WERE HARMED", "IN THIS SELFIE. YET.", "DIMITRI", ":("),
    post("ROOFTOP VIBES", "#UNDERCOVER", "HQ", "WHY IS IT PUBLIC"),
    post("DON'T TELL HQ, I'M", "HERE FOR PRETZELS", "HQ", "WE CAN SEE THIS"),
    post("GOLDEN HOUR.", "LICENSE TO CHILL.", "MOM", "CALL YOUR MOTHER"),
    post("SECRET MISSION.", "PLEASE LIKE & SHARE", "HQ", "...SERIOUSLY?"),
];

/// Posted at level clear.
pub const CLEAR_POSTS: [Post; 10] = [
    post("MISSION COMPLETE.", "ALSO BOUGHT SOCKS.", "MOM", "WHAT COLOR?"),
    post("6 PACKAGES.", "0 RECEIPTS. #WIN", "RETURNS DESK", "NO"),
    post("SAVED THE WORLD.", "STILL NO PARKING.", "DAD", "TYPICAL"),
    post("SPIES: 0", "ME: 1 #MALLRAT", "BORIS", "REMATCH?"),
    post("GETAWAY CAR:", "WOOD PANELING. ICONIC", "HQ", "RETURN THE CAR"),
    post("TREATED MYSELF TO A", "CINNABOMB. EARNED IT.", "MOM", "EAT A VEGGIE"),
    post("HQ SAID KEEP IT QUIET", "SO HERE IS A POST", "HQ", "YOU'RE FIRED"),
    post("FOUND A PET ROCK.", "HIS NAME IS KEVIN.", "KEVIN", "..."),
    post("BRB, RETURNING 6", "SUSPICIOUS PACKAGES", "MALL COP", "WAIT WHAT"),
    post("SEE YOU NEXT LOOP,", "FOOD COURT", "HOT SPY", "♥♥♥"),
];

// ---------------------------------------------------------------------------------------------------------
// Speech bubbles
// ---------------------------------------------------------------------------------------------------------

pub struct StoreLines {
    pub store: StoreId,
    /// Spoken by the first spy.
    pub first: &'static str,
    /// Spoken about a second later (by the second spy / the bot), if any.
    pub second: Option<&'static str>,
    /// True if the second line is spoken by a security bot instead of a spy.
    pub second_is_bot: bool,
}

pub const STORE_LINES: [StoreLines; 9] = [
    StoreLines { store: StoreId::KgbToys, first: "DIMITRI, HE'S HERE!", second: Some("DA! HIDE THE TEDDIES!"), second_is_bot: false },
    StoreLines { store: StoreId::Forever12, first: "IT'S NOT A DISGUISE.", second: Some("IT'S A LOOK, SERGEI."), second_is_bot: false },
    StoreLines { store: StoreId::RadioShock, first: "YOU'LL NEED BATTERIES.", second: Some("BEEP. NOT INCLUDED."), second_is_bot: true },
    StoreLines { store: StoreId::HotSpyOnAStick, first: "WANT FRIES WITH THAT?", second: None, second_is_bot: false },
    StoreLines { store: StoreId::FootLockpicker, first: "THESE ARE MY GETAWAY SHOES", second: Some("BOTH LEFT FEET, COMRADE"), second_is_bot: false },
    StoreLines { store: StoreId::SamBaddy, first: "TURN IT UP, BORIS!", second: None, second_is_bot: false },
    StoreLines { store: StoreId::Crookstone, first: "TRY THE MASSAGE CHAIR...", second: None, second_is_bot: false },
    StoreLines { store: StoreId::SharperImagine, first: "BEEP. PLEASE DON'T TOUCH.", second: None, second_is_bot: true },
    StoreLines { store: StoreId::SpendersGifts, first: "WHOA... THE LAVA LAMP...", second: None, second_is_bot: false },
];

pub fn store_lines(id: StoreId) -> Option<&'static StoreLines> {
    STORE_LINES.iter().find(|l| l.store == id)
}

pub const LAST_WORDS: [&str; 8] = [
    "I WAS JUST BROWSING!",
    "WHAT'S YOUR RETURN POLICY?!",
    "I HAD A COUPON!",
    "TELL MY CAT...",
    "NOT THE FACE!",
    "I WAS ON MY LUNCH BREAK!",
    "WORTH IT. 70% OFF.",
    "MY RECEIPT...",
];

pub const ELEVATOR_LINES: [&str; 4] = ["...NICE WEATHER.", "GOING DOWN? ME TOO.", "*AWKWARD COUGH*", "THIS IS MY FLOOR, ACTUALLY"];

pub const HEY: &str = "HEY!";
pub const COP_WHISTLE: &str = "HEY! STOP RIGHT THERE!";
pub const OCCUPIED: &str = "OCCUPIED!!";
pub const DETAINED: &str = "DETAINED! -500";

// ---------------------------------------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------------------------------------

pub const PA_LINES: [&str; 7] = [
    "ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.",
    "FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.",
    "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",
    "LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.",
    "BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.",
    "THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.",
    "A REMINDER: SECURITY IS WATCHING. MOSTLY TV.",
];

pub const HEADLINES: [&str; 5] = [
    "LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING",
    "SPIES FOILED; FOOD COURT SALES UP 300%",
    "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'",
    "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT",
    "GAMESTONK SHARE PRICE DOWN ANOTHER 99%",
];

pub const ALARM_BANNER: &str = "ALARM! SECURITY ALERTED";
pub const BLACK_FRIDAY_1: &str = "BLACK FRIDAY!";
pub const BLACK_FRIDAY_2: &str = "70% OFF EVERYTHING";
pub const GAME_OVER_TYPED: [&str; 2] = ["ATTENTION SHOPPERS:", "THE MALL IS NOW CLOSED"];
pub const EASTER_EGG_TEXT: &str = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";
pub const EGG_ITEMS: [&str; 5] = ["EXPIRED COUPON", "PRE-OWNED STRATEGY GUIDE", "PET ROCK", "MOOD RING", "1 SHARE (DOWN 99%)"];
pub const SEARCH_PROMPT: &str = "PRESS X TO SEARCH";
pub const SEARCHING: &str = "SEARCHING...";
pub const TRAP_TEXT: &str = "IT'S A TRAP!";
pub const NOTHING_TEXT: &str = "NOTHING HERE";
pub const FITTING_ROOM_SHRIEK: &str = "OCCUPIED!!";
pub const BOOTH_NOW_PLAYING: &str = "NOW PLAYING: SIDE B";

pub fn package_banner(n: u32) -> String {
    format!("PACKAGE {n}/6")
}

pub fn packages_left_banner(n: u32) -> String {
    format!("PACKAGES LEFT: {n}")
}

pub fn you_got(item: &str) -> String {
    format!("YOU GOT: {item}")
}

/// Floor announcement when an elevator stops with the player inside.
pub fn floor_announcement(f: Floor) -> &'static str {
    match f {
        Floor::Roof => "R - ROOF ACCESS, ZIPLINES",
        Floor::F4 => "4F - FASHION & GADGETS, SPIES",
        Floor::F3 => "3F - TOYS, VIDEO & KITSCH",
        Floor::F2 => "2F - MUSIC, SNACKS & DISCO",
        Floor::F1 => "1F - SPORTS & BOOKS",
        Floor::Parking => "P - PARKING. GOOD LUCK.",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn len(s: &str) -> usize {
        s.chars().count()
    }

    #[test]
    fn spygram_captions_fit() {
        for p in ARRIVAL_POSTS.iter().chain(CLEAR_POSTS.iter()) {
            for line in p.caption {
                assert!(len(line) <= CAPTION_LINE_MAX, "caption too long: {line:?} ({})", len(line));
            }
            assert!(len(p.comment) <= COMMENT_MAX, "comment too long: {:?}", p.comment);
            assert!(len(p.who) + 2 + len(p.comment) > 0);
        }
        assert_eq!(ARRIVAL_POSTS.len(), 10);
        assert_eq!(CLEAR_POSTS.len(), 10);
    }

    #[test]
    fn commenter_plus_comment_fits_a_card_line() {
        // the card is ~29 chars wide at 6px; "WHO: comment" must fit on at most two lines of 21
        for p in ARRIVAL_POSTS.iter().chain(CLEAR_POSTS.iter()) {
            let full = format!("{}: {}", p.who, p.comment);
            assert!(wrap(&full, COMMENT_MAX).len() <= 2, "{full}");
        }
    }

    #[test]
    fn bubbles_fit() {
        for l in STORE_LINES.iter() {
            assert!(len(l.first) <= BUBBLE_MAX, "{}", l.first);
            if let Some(s) = l.second {
                assert!(len(s) <= BUBBLE_MAX, "{s}");
            }
        }
        for s in LAST_WORDS.iter().chain(ELEVATOR_LINES.iter()) {
            assert!(len(s) <= BUBBLE_MAX, "{s}");
        }
        for s in [HEY, COP_WHISTLE, OCCUPIED, DETAINED] {
            assert!(len(s) <= BUBBLE_MAX, "{s}");
        }
    }

    #[test]
    fn headlines_wrap_to_26() {
        for h in HEADLINES.iter() {
            let lines = wrap(h, HEADLINE_LINE_MAX);
            assert!(!lines.is_empty() && lines.len() <= 4, "{h}");
            for l in lines {
                assert!(len(&l) <= HEADLINE_LINE_MAX, "{l}");
            }
        }
    }

    #[test]
    fn pa_lines_wrap_inside_the_banner() {
        for p in PA_LINES.iter() {
            let lines = wrap(p, BANNER_LINE_MAX);
            assert!(lines.len() <= 3, "{p} wraps to {} lines", lines.len());
            for l in lines {
                assert!(len(&l) <= BANNER_LINE_MAX, "{l}");
            }
        }
    }

    #[test]
    fn floor_announcements_fit_a_banner() {
        for f in Floor::ALL {
            assert!(len(floor_announcement(f)) <= BANNER_LINE_MAX, "{}", floor_announcement(f));
        }
    }

    #[test]
    fn short_banners_fit() {
        for s in [ALARM_BANNER, BLACK_FRIDAY_2, SEARCH_PROMPT, TRAP_TEXT, NOTHING_TEXT, BOOTH_NOW_PLAYING, EASTER_EGG_TEXT] {
            assert!(wrap(s, BANNER_LINE_MAX).len() <= 2, "{s}");
        }
        for s in EGG_ITEMS {
            assert!(len(&you_got(s)) <= BANNER_LINE_MAX, "{}", you_got(s));
        }
        assert!(len(&packages_left_banner(6)) <= BANNER_LINE_MAX);
    }

    #[test]
    fn counts_match_the_brief() {
        assert_eq!(LAST_WORDS.len(), 8);
        assert_eq!(ELEVATOR_LINES.len(), 4);
        assert_eq!(PA_LINES.len(), 7);
        assert_eq!(HEADLINES.len(), 5);
        assert_eq!(EGG_ITEMS.len(), 5);
    }

    #[test]
    fn wrap_basics() {
        assert_eq!(wrap("A B C", 3), vec!["A B", "C"]);
        assert_eq!(wrap("", 5), Vec::<String>::new());
        assert_eq!(wrap("LONGWORD", 3), vec!["LONGWORD"]);
    }

    #[test]
    fn all_stores_with_lines_are_open_stores() {
        for l in STORE_LINES.iter() {
            assert!(l.store.is_open());
        }
        assert!(store_lines(StoreId::KgbToys).is_some());
        assert!(store_lines(StoreId::BorderlineBooks).is_none());
    }

    #[test]
    fn only_printable_font_characters_are_used() {
        // everything we draw must exist in the pixel font (or be the heart glyph)
        use crate::pixel::{FontKind, HEART};
        let _ = FontKind::Normal; // glyph() is private; check via rendering
        let mut fb = crate::pixel::Fb::new();
        let check = |s: &str, fb: &mut crate::pixel::Fb| {
            for c in s.chars() {
                if c == ' ' || c == HEART {
                    continue;
                }
                fb.clear(0x0F);
                fb.text(0, 0, &c.to_string(), 0x30);
                assert!(fb.px.iter().any(|p| *p == 0x30), "font cannot draw {c:?} in {s:?}");
            }
        };
        for p in ARRIVAL_POSTS.iter().chain(CLEAR_POSTS.iter()) {
            for l in p.caption {
                check(l, &mut fb);
            }
            check(p.who, &mut fb);
            check(p.comment, &mut fb);
        }
        for s in LAST_WORDS.iter().chain(PA_LINES.iter()).chain(HEADLINES.iter()).chain(ELEVATOR_LINES.iter()) {
            check(s, &mut fb);
        }
        for l in STORE_LINES.iter() {
            check(l.first, &mut fb);
            check(l.second.unwrap_or(""), &mut fb);
        }
    }
}
