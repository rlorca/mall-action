/// The 9 visual themes of the top-down store rooms. `gadgets` is used by two shops (different layouts).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ThemeId {
    Fashion,
    Electronics,
    Toys,
    Food,
    Sports,
    Music,
    Gadgets,
    Novelty,
    Games,
}

impl ThemeId {
    pub const ALL: [ThemeId; 9] = [
        ThemeId::Fashion,
        ThemeId::Electronics,
        ThemeId::Toys,
        ThemeId::Food,
        ThemeId::Sports,
        ThemeId::Music,
        ThemeId::Gadgets,
        ThemeId::Novelty,
        ThemeId::Games,
    ];
    pub const fn as_str(self) -> &'static str {
        match self {
            ThemeId::Fashion => "fashion",
            ThemeId::Electronics => "electronics",
            ThemeId::Toys => "toys",
            ThemeId::Food => "food",
            ThemeId::Sports => "sports",
            ThemeId::Music => "music",
            ThemeId::Gadgets => "gadgets",
            ThemeId::Novelty => "novelty",
            ThemeId::Games => "games",
        }
    }
}

/// TS `THEMES`.
pub const THEMES: [ThemeId; 9] = ThemeId::ALL;
