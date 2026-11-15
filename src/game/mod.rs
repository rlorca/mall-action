//! The rules. Mirrors `src/game/` of the TypeScript source.
pub mod bot;
pub mod debug;
pub mod difficulty;
pub mod game;
pub mod hud;
pub mod level;
pub mod levelstate;
pub mod mall;
pub mod run;
pub mod screens;
pub mod store;
pub mod types;

#[cfg(test)]
mod playthrough_tests;
