//! Per-level state of the store contents. Generated at level start by
//! `generate_level` (src/game/store/levelgen.rs) from a seeded Rng. Port of `game/levelstate.ts`.

use crate::content::powerups::PowerId;
use crate::content::stores::{store_def, StoreId, StoreRole};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FixtureContent {
    Package,
    Powerup(PowerId),
    Trap,
    Nothing,
}

impl FixtureContent {
    /// The TS `kind` string: 'package' | 'powerup' | 'trap' | 'nothing'.
    pub const fn kind_str(self) -> &'static str {
        match self {
            FixtureContent::Package => "package",
            FixtureContent::Powerup(_) => "powerup",
            FixtureContent::Trap => "trap",
            FixtureContent::Nothing => "nothing",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct FixtureState {
    pub content: FixtureContent,
    /// Searched fixtures stay open for the rest of the level (even after leaving and re-entering).
    pub opened: bool,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct StoreState {
    pub id: StoreId,
    /// In the order of the room template's searchable fixtures (reading order: rows top->bottom, left->right).
    pub fixtures: Vec<FixtureState>,
    /// Target stores: the package has been taken (store is now cleared and cannot be entered).
    pub package_taken: bool,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct LevelState {
    pub seed: u32,
    pub loop_: i32,
    pub black_friday: bool,
    /// Open stores only (6 targets + 4 power-up shops). Indexed by `StoreId as usize` (13 slots; closed stores are
    /// `None`) - TS `Partial<Record<StoreId, StoreState>>`. Prefer `store(id)` / `store_mut(id)` / `set_store`.
    pub stores: Vec<Option<StoreState>>,
}

impl LevelState {
    /// A level with no store state yet (TS `{ seed, loop, blackFriday, stores: {} }`).
    pub fn new(seed: u32, loop_: i32, black_friday: bool) -> LevelState {
        LevelState { seed, loop_, black_friday, stores: (0..StoreId::ALL.len()).map(|_| None).collect() }
    }
    /// TS `level.stores[id]`.
    pub fn store(&self, id: StoreId) -> Option<&StoreState> {
        self.stores[id as usize].as_ref()
    }
    /// TS `level.stores[id]!` (mutable).
    pub fn store_mut(&mut self, id: StoreId) -> Option<&mut StoreState> {
        self.stores[id as usize].as_mut()
    }
    /// TS `level.stores[id] = state`.
    pub fn set_store(&mut self, id: StoreId, state: StoreState) {
        self.stores[id as usize] = Some(state);
    }
    /// Present stores in `StoreId` order (TS `Object.values(level.stores)`; TS order was insertion order = OPEN_STORES order,
    /// which is the same as `StoreId` order filtered to open stores).
    pub fn iter_stores(&self) -> impl Iterator<Item = &StoreState> {
        self.stores.iter().filter_map(|s| s.as_ref())
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum StoreStatus {
    Package,
    Cleared,
    Powerup,
    Closed,
}

impl StoreStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            StoreStatus::Package => "package",
            StoreStatus::Cleared => "cleared",
            StoreStatus::Powerup => "powerup",
            StoreStatus::Closed => "closed",
        }
    }
}

pub fn store_status(level: &LevelState, id: StoreId) -> StoreStatus {
    let def = store_def(id);
    match def.role {
        StoreRole::Closed => StoreStatus::Closed,
        StoreRole::Powerup => StoreStatus::Powerup,
        StoreRole::Target => {
            if level.store(id).map_or(false, |s| s.package_taken) {
                StoreStatus::Cleared
            } else {
                StoreStatus::Package
            }
        }
    }
}

/// Can the agent walk into this store right now?
pub fn can_enter_store(level: &LevelState, id: StoreId) -> bool {
    let s = store_status(level, id);
    s == StoreStatus::Package || s == StoreStatus::Powerup
}

/// Number of packages already taken this level.
pub fn packages_taken(level: &LevelState) -> i32 {
    let mut n = 0;
    for s in level.iter_stores() {
        if s.package_taken {
            n += 1;
        }
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_store_status_and_entry_rules() {
        let mut lvl = LevelState::new(1, 1, false);
        assert_eq!(store_status(&lvl, StoreId::Forever12), StoreStatus::Package);
        assert_eq!(store_status(&lvl, StoreId::Crookstone), StoreStatus::Powerup);
        assert_eq!(store_status(&lvl, StoreId::Blockbluster), StoreStatus::Closed);
        assert!(!can_enter_store(&lvl, StoreId::Blockbluster));
        lvl.set_store(StoreId::Forever12, StoreState { id: StoreId::Forever12, fixtures: vec![], package_taken: true });
        assert_eq!(store_status(&lvl, StoreId::Forever12), StoreStatus::Cleared);
        assert!(!can_enter_store(&lvl, StoreId::Forever12));
        assert_eq!(packages_taken(&lvl), 1);
    }
}
