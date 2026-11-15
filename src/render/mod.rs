//! Screen-level renderers: pure functions drawing immutable state into a `Framebuffer`.
//! (hud, mall_view, mall_actors_view, store_view and game_view are added by other agents.)
pub mod continue_view;
pub mod game_over_view;
pub mod game_view;
pub mod hud;
pub mod gallery;
pub mod level_clear_view;
pub mod mall_actors_view;
pub mod mall_view;
pub mod map_view;
pub mod newspaper_view;
pub mod osd;
pub mod pause_view;
pub mod screen_fx;
pub mod spygram_view;
pub mod store_view;
pub mod title_view;
pub mod widgets;

#[cfg(test)]
mod parity_tests;
#[cfg(test)]
mod screens_tests;
