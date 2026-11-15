//! The screens' small labels live in content/copy.rs with all the other copy; this re-export keeps old imports working.
pub use crate::content::copy::{loop_label, SCREEN_TEXT};

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::copy::LIMITS;
    use crate::engine::font::{font_supports, FONT_MAIN};

    fn all_strings() -> Vec<&'static str> {
        let t = SCREEN_TEXT;
        let m = t.map;
        vec![
            m.legend_package,
            m.legend_cleared,
            m.legend_powerup,
            m.legend_closed,
            m.legend_you,
            m.legend_radar,
            m.legend_car,
            m.legend_getaway,
            m.legend_escalator,
            m.items,
            m.close,
            t.tally.packages,
            t.tally.time,
            t.tally.clear,
            t.tally.score,
            t.tally.thanks,
            t.chase,
            t.news.edition,
            t.news.price,
            t.news.tagline,
            t.game_over.score,
            t.game_over.hi_score,
            t.game_over.new_record,
            t.title.hi_score,
            t.garage.exit,
            t.garage.level,
            t.spygram.user,
            t.spygram.likes,
        ]
    }

    #[test]
    fn is_uppercase_and_drawable_with_the_main_font() {
        let all = all_strings();
        assert!(all.len() > 10);
        for s in all {
            assert_eq!(s, s.to_uppercase(), "{}", s);
            assert!(font_supports(&FONT_MAIN, s), "{}", s);
        }
    }

    #[test]
    fn the_chase_shout_is_a_legal_speech_bubble() {
        assert!(SCREEN_TEXT.chase.chars().count() <= LIMITS.bubble);
    }

    #[test]
    fn nothing_is_wider_than_the_screen() {
        for s in all_strings() {
            assert!(s.chars().count() * 6 <= 256, "{}", s);
        }
    }
}
