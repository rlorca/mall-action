pub mod characters;
pub mod items;
pub mod mallprops;
pub mod manifest;
pub mod registry;
pub use registry::init;
pub mod storeart;
pub mod storefront;
pub mod storefronts;

/// Every art module's sprite defs in TS import order (characters, items, mallprops, storefronts, storeart);
/// the registry is built from this list.
pub fn all_defs() -> Vec<registry::Def> {
    let mut v = Vec::new();
    v.extend(characters::defs());
    v.extend(items::defs());
    v.extend(mallprops::defs());
    v.extend(storefronts::defs());
    v.extend(storeart::defs());
    v
}

#[cfg(test)]
mod parity_tests;
