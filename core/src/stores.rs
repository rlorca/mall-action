//! The 13 storefronts. Shared by art, audio, level setup and rendering.

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum StoreId {
    Forever12,
    RadioShock,
    Crookstone,
    GameStonk,
    KgbToys,
    BlockBlusterVideo,
    SpendersGifts,
    SamBaddy,
    SharperImagine,
    HotSpyOnAStick,
    CircuitPity,
    FootLockpicker,
    BorderlineBooks,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Target,
    PowerUp,
    Closed,
}

/// Visual theme of the top-down room (9 themes).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Theme {
    Fashion,
    Electronics,
    Toys,
    FoodCourt,
    Sports,
    Music,
    Gadgets,
    Novelty,
    Games,
}

pub const ALL_STORES: [StoreId; 13] = [
    StoreId::Forever12,
    StoreId::RadioShock,
    StoreId::Crookstone,
    StoreId::GameStonk,
    StoreId::KgbToys,
    StoreId::BlockBlusterVideo,
    StoreId::SpendersGifts,
    StoreId::SamBaddy,
    StoreId::SharperImagine,
    StoreId::HotSpyOnAStick,
    StoreId::CircuitPity,
    StoreId::FootLockpicker,
    StoreId::BorderlineBooks,
];

pub struct StoreInfo {
    pub id: StoreId,
    pub name: &'static str,
    /// Floor index: 4,3,2,1 (R = 5, P = 0 in level code).
    pub floor: u8,
    pub role: Role,
    pub theme: Theme,
}

pub const fn info(id: StoreId) -> StoreInfo {
    use Role::*;
    use StoreId::*;
    use Theme::*;
    match id {
        Forever12 => StoreInfo { id, name: "FOREVER 12", floor: 4, role: Target, theme: Fashion },
        RadioShock => StoreInfo { id, name: "RADIOSHOCK", floor: 4, role: Target, theme: Electronics },
        Crookstone => StoreInfo { id, name: "CROOKSTONE", floor: 4, role: PowerUp, theme: Gadgets },
        GameStonk => StoreInfo { id, name: "GAMESTONK", floor: 4, role: PowerUp, theme: Games },
        KgbToys => StoreInfo { id, name: "KGB TOYS", floor: 3, role: Target, theme: Toys },
        BlockBlusterVideo => StoreInfo { id, name: "BLOCKBLUSTER VIDEO", floor: 3, role: Closed, theme: Electronics },
        SpendersGifts => StoreInfo { id, name: "SPENDER'S GIFTS", floor: 3, role: PowerUp, theme: Novelty },
        SamBaddy => StoreInfo { id, name: "SAM BADDY", floor: 2, role: Target, theme: Music },
        SharperImagine => StoreInfo { id, name: "SHARPER IMAGINE", floor: 2, role: PowerUp, theme: Gadgets },
        HotSpyOnAStick => StoreInfo { id, name: "HOT SPY ON A STICK", floor: 2, role: Target, theme: FoodCourt },
        CircuitPity => StoreInfo { id, name: "CIRCUIT PITY", floor: 2, role: Closed, theme: Electronics },
        FootLockpicker => StoreInfo { id, name: "FOOT LOCKPICKER", floor: 1, role: Target, theme: Sports },
        BorderlineBooks => StoreInfo { id, name: "BORDERLINE BOOKS", floor: 1, role: Closed, theme: Fashion },
    }
}

/// Stable index 0..13 (position in ALL_STORES).
pub fn index(id: StoreId) -> usize {
    ALL_STORES.iter().position(|s| *s == id).unwrap()
}
