//! ALL the jokes and on-screen copy live here. Add a line to an array and the tests
//! (bottom of this file) check that it fits on screen.
//!
//! Limits: speech bubbles <= 28 chars, SPYGRAM caption lines <= 21 (2 lines), comments <= 21,
//! headline lines <= 26, PA lines <= 30, banners <= 36.

pub const BUBBLE_MAX: usize = 28;
pub const CAPTION_MAX: usize = 21;
pub const COMMENT_MAX: usize = 21;
pub const HEADLINE_MAX: usize = 26;
pub const PA_MAX: usize = 30;
pub const BANNER_MAX: usize = 36;

/// A SPYGRAM post: two caption lines and one comment.
pub struct Post {
    pub caption: [&'static str; 2],
    pub comment: &'static str,
}

const fn post(a: &'static str, b: &'static str, c: &'static str) -> Post {
    Post { caption: [a, b], comment: c }
}

pub const ARRIVAL_POSTS: [Post; 10] = [
    post("FEELING CUTE,", "MIGHT DELETE LATER", "MOM: SO PROUD OF U"),
    post("FIRST DAY ON THE JOB!", "#BLESSED", "BOSS: DELETE THIS"),
    post("MALL RAT? NO.", "MALL AGENT.", "MOM: WEAR A JACKET"),
    post("ZIPLINE WAS $0.", "PARKING WAS $12.", "DAD: TOLD U SO"),
    post("OUTFIT OF THE DAY:", "TRENCHCOAT, AGAIN", "FOREVER12: 20% OFF!"),
    post("NO SPIES WERE HARMED", "IN THIS SELFIE. YET.", "DIMITRI: :("),
    post("ROOFTOP VIBES", "#UNDERCOVER", "HQ: WHY IS IT PUBLIC"),
    post("DON'T TELL HQ, I'M", "HERE FOR PRETZELS", "HQ: WE CAN SEE THIS"),
    post("GOLDEN HOUR.", "LICENSE TO CHILL.", "MOM: CALL YOUR MOTHER"),
    post("SECRET MISSION.", "PLEASE LIKE & SHARE", "HQ: ...SERIOUSLY?"),
];

pub const CLEAR_POSTS: [Post; 10] = [
    post("MISSION COMPLETE.", "ALSO BOUGHT SOCKS.", "MOM: WHAT COLOR?"),
    post("6 PACKAGES.", "0 RECEIPTS. #WIN", "RETURNS DESK: NO"),
    post("SAVED THE WORLD.", "STILL NO PARKING.", "DAD: TYPICAL"),
    post("SPIES: 0", "ME: 1 #MALLRAT", "BORIS: REMATCH?"),
    post("GETAWAY CAR:", "WOOD PANELING. ICONIC", "HQ: RETURN THE CAR"),
    post("TREATED MYSELF TO A", "CINNABOMB. EARNED IT.", "MOM: EAT A VEGGIE"),
    post("HQ SAID KEEP IT QUIET", "SO HERE IS A POST", "HQ: YOU'RE FIRED"),
    post("FOUND A PET ROCK.", "HIS NAME IS KEVIN.", "KEVIN: ..."),
    post("BRB, RETURNING 6", "SUSPICIOUS PACKAGES", "MALL COP: WAIT WHAT"),
    post("SEE YOU NEXT LOOP,", "FOOD COURT", "HOT SPY: ^^^"),
];

/// Newspaper headlines, pre-wrapped (each line <= 26 chars).
pub const HEADLINES: [&[&str]; 5] = [
    &["LOCAL AGENT FINDS 6", "PACKAGES, STILL NO", "PARKING"],
    &["SPIES FOILED; FOOD", "COURT SALES UP 300%"],
    &["MAN ZIPLINES ONTO ROOF.", "SECURITY 'NOT SURPRISED'"],
    &["MALL WALKERS DEMAND", "APOLOGY FOR 'HEY!'", "INCIDENT"],
    &["GAMESTONK SHARE PRICE", "DOWN ANOTHER 99%"],
];

/// Mall PA announcements (multi-line banners, each line <= 30).
pub const PA_LINES: [&[&str]; 7] = [
    &["ATTENTION SHOPPERS:", "CLEANUP ON 3F. AGAIN."],
    &["FREE SAMPLES AT HOT SPY.", "NOT POISONED. PROBABLY."],
    &["WILL THE OWNER OF A BLACK", "VAN MARKED 'NOT SPIES'", "PLEASE MOVE IT."],
    &["LOST CHILD AT THE 2F KIOSK.", "SAYS HIS NAME IS AGENT 7."],
    &["BLOCKBLUSTER IS STILL", "CLOSED. BE KIND, REWIND."],
    &["THE MALL CLOSES AT 9.", "SPIES CLOSE AT NEVER."],
    &["A REMINDER: SECURITY IS", "WATCHING. MOSTLY TV."],
];

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

pub const ELEVATOR_EXIT: [&str; 4] = ["...NICE WEATHER.", "GOING DOWN? ME TOO.", "*AWKWARD COUGH*", "THIS IS MY FLOOR, ACTUALLY"];

/// First-visit lines: (store index in `stores::ALL_STORES`, speaker (0 = first guard, 1 = second/other, 2 = bot), text).
pub const FIRST_VISIT: &[(usize, u8, &str)] = &[
    (4, 0, "DIMITRI, HE'S HERE!"),
    (4, 1, "DA! HIDE THE TEDDIES!"),
    (0, 0, "IT'S NOT A DISGUISE."),
    (0, 1, "IT'S A LOOK, SERGEI."),
    (1, 0, "YOU'LL NEED BATTERIES."),
    (1, 2, "BEEP. NOT INCLUDED."),
    (9, 0, "WANT FRIES WITH THAT?"),
    (11, 0, "THESE ARE MY GETAWAY SHOES"),
    (11, 1, "BOTH LEFT FEET, COMRADE"),
    (7, 0, "TURN IT UP, BORIS!"),
    (2, 0, "TRY THE MASSAGE CHAIR..."),
    (8, 2, "BEEP. PLEASE DON'T TOUCH."),
    (6, 0, "WHOA... THE LAVA LAMP..."),
];

pub const FLOORS: [&str; 6] = [
    "P - PARKING, GETAWAY",
    "1F - SHOES & BOOKS, SPIES",
    "2F - MUSIC & FOOD, SPIES",
    "3F - TOYS & VIDEO, SPIES",
    "4F - FASHION & GADGETS, SPIES",
    "R - ROOF DECK, ZIPLINES",
];

pub const ZELDA: &str = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";
pub const ZELDA_ITEMS: [&str; 5] =
    ["EXPIRED COUPON", "PRE-OWNED STRATEGY GUIDE", "PET ROCK", "MOOD RING", "1 SHARE (DOWN 99%)"];

pub const POWERUP_NAMES: [&str; 9] = [
    "RAPID FIRE",
    "SPREAD SHOT",
    "ARMOR VEST",
    "SNEAKERS",
    "RADAR",
    "1-UP",
    "CINNABOMB",
    "ORANGE JULI-OOZE",
    "SOFT PRETZEL",
];

pub const TRAP: &str = "IT'S A TRAP!";
pub const NOTHING: &str = "NOTHING HERE";
pub const OCCUPIED: &str = "OCCUPIED!!";
pub const HEY: &str = "HEY!";
pub const COP_HEY: &str = "HEY! STOP RIGHT THERE!";
pub const DETAINED: &str = "DETAINED! -500";
pub const ALARM_BANNER: &str = "ALARM! SECURITY ALERTED";
pub const NOW_PLAYING: &str = "NOW PLAYING: SIDE B";
pub const GAME_OVER_TYPE: [&str; 2] = ["ATTENTION SHOPPERS:", "THE MALL IS NOW CLOSED"];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::font::text_width;

    fn fits(s: &str, max: usize) {
        assert!(s.chars().count() <= max, "too long ({}>{}): {s}", s.chars().count(), max);
        assert!(text_width(s) <= 250, "overflows screen: {s}");
        assert!(s.chars().all(|c| !c.is_lowercase()), "use upper case: {s}");
    }
    #[test]
    fn posts_fit() {
        for p in ARRIVAL_POSTS.iter().chain(CLEAR_POSTS.iter()) {
            assert!(p.caption.len() <= 2);
            for l in p.caption {
                fits(l, CAPTION_MAX);
            }
            fits(p.comment, COMMENT_MAX);
        }
    }
    #[test]
    fn headlines_fit() {
        for h in HEADLINES {
            for l in h {
                fits(l, HEADLINE_MAX);
            }
        }
    }
    #[test]
    fn bubbles_fit() {
        for w in LAST_WORDS.iter().chain(ELEVATOR_EXIT.iter()) {
            fits(w, BUBBLE_MAX);
        }
        for (_, _, t) in FIRST_VISIT {
            fits(t, BUBBLE_MAX);
        }
        fits(HEY, BUBBLE_MAX);
        fits(COP_HEY, BUBBLE_MAX);
    }
    #[test]
    fn banners_fit() {
        for h in PA_LINES {
            for l in h {
                fits(l, PA_MAX);
            }
        }
        for f in FLOORS {
            fits(f, BANNER_MAX);
        }
        for t in ZELDA_ITEMS.iter().chain(POWERUP_NAMES.iter()) {
            fits(&format!("YOU GOT: {t}"), BANNER_MAX);
        }
        for s in [TRAP, NOTHING, OCCUPIED, DETAINED, ALARM_BANNER, NOW_PLAYING] {
            fits(s, BANNER_MAX);
        }
    }
    #[test]
    fn first_visit_store_indices_valid() {
        for (i, _, _) in FIRST_VISIT {
            assert!(*i < 13);
        }
    }
}
