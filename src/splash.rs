//! Reusable deterministic studio splash timing, independent of rendering.
pub const DURATION: u32 = 180;
pub fn letter_visible(frame: u32, index: usize) -> bool {
    frame >= 60 || (frame + index as u32) % 2 == 0
}
pub fn settled(frame: u32) -> bool {
    frame >= 60
}
pub fn presents(frame: u32) -> bool {
    frame >= 100
}
#[test]
fn flicker() {
    for f in 0..60 {
        assert_ne!(letter_visible(f, 0), letter_visible(f, 1));
        assert_ne!(letter_visible(f, 0), letter_visible(f + 1, 0));
    }
    assert!(letter_visible(60, 0));
    assert!(presents(100));
}
