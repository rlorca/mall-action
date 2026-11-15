//! OWNER: characters art. Defines every sprite listed for owner `characters` in manifest.rs.
//!
//! Conventions: every mall character is drawn facing RIGHT, bottom-aligned and centred in its cell.
//! In TS the sprites were assembled as "paper dolls" (`compose` stamps parts: head, coat, legs, arms... onto a blank
//! cell, `flip`, `lineRows`). That assembly is pure, deterministic string work, so here the resolved char grids
//! are emitted MECHANICALLY from the TS source (gen script: /private/tmp/claude-502/art/x/gen.ts); the frame hashes
//! are verified against the TS registry by `art::parity_tests` (fixtures/sprites-characters-items-mallprops.json).
//! Pixel ruler (16 wide):  0123456789ABCDEF

// GENERATED mechanically from the TS source (art/characters.ts) by /private/tmp/claude-502/art/x/gen.ts. Do not retype.
use super::registry::{sd, Def};
use crate::engine::palette::c;

pub fn defs() -> Vec<Def> {
    vec![
    sd("agent.stand", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "....KKKKPPPPPP..",
            ".....KKKPPPPP...",
            ".....KKKKPPP....",
            "....KRRRPPRK....",
            "...KRRKPPKRRK...",
            "...KRRRKPKRRK...",
            "...KRRRRKKRRK...",
            "....KRRRKRRK....",
            "....KKKKPKKK....",
            "...KRRRRKRRRKP..",
            "..KRRRRRKRRRRP..",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "...KKKK.KKKK....",
            "...KKKK.KKKK....",
        ],
    ]),
    sd("agent.walk", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "....KKKKPPPPPP..",
            ".....KKKPPPPP...",
            ".....KKKKPPP....",
            "....KRRRPPRK....",
            "...KRRKPPKRRK...",
            "...KRRRKPKRRK...",
            "...KRRRRKKRRK...",
            "...KKRRRKRRRK...",
            "..KRKKKKPKKRRK..",
            ".PRKRRRRKRRRKRP.",
            ".PKRRRRRKRRRRKP.",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            ".....KKKKKK.....",
            "....KKK..KKK....",
            "...KKK....KKK...",
            "..KKK......KKK..",
            "..KKKK.....KKKK.",
        ],
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "....KKKKPPPPPP..",
            ".....KKKPPPPP...",
            ".....KKKKPPP....",
            "....KRRRPPRK....",
            "...KRRKPPKRRK...",
            "...KRRRKPKRRK...",
            "...KRRRRKKRRK...",
            "....KRRRKRRK....",
            "....KKKKPKKK....",
            "...KRRRRKRRRK...",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            ".....KKKKKK.....",
            "....KKK.KKK.....",
            "...KKK..KKK.....",
            "..KKK...KKK.....",
            "..KK....KKK.....",
            "........KKKK....",
        ],
        &[
            "................",
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "....KKKKPPPPPP..",
            ".....KKKPPPPP...",
            ".....KKKKPPP....",
            "....KRRRPPRK....",
            "...KRRKPPKRRK...",
            "...KRRRKPKRRK...",
            "...KRRRRKKRRK...",
            "...KRRRRKRRKK...",
            "..KRRKKKPKKKRK..",
            ".PRKRRRRKRRRKRP.",
            ".PKRRRRRKRRRRKP.",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            ".....KKKKKK.....",
            "....KKK..KKK....",
            "...KKK....KKK...",
            "..KKK......KKK..",
            "..KKKK.....KKKK.",
        ],
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "....KKKKPPPPPP..",
            ".....KKKPPPPP...",
            ".....KKKKPPP....",
            "....KRRRPPRK....",
            "...KRRKPPKRRK...",
            "...KRRRKPKRRK...",
            "...KRRRRKKRRK...",
            "....KRRRKRRK....",
            "....KKKKPKKK....",
            "...KRRRRKRRRK...",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            ".....KKKKKK.....",
            ".....KKK.KKK....",
            ".....KKK..KKK...",
            ".....KKK..KKK...",
            ".....KKK...KKKK.",
            "....KKKK........",
        ],
    ]),
    sd("agent.jump", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            ".....KKKKKK.....",
            "....KKKKKKKKK.PP",
            "....KKKKKKPPP.PP",
            "....KKKKKPPKP.RK",
            "....KKKKPPPPPPRK",
            ".....KKKPPPPP.RK",
            ".....KKKKPPP.RRK",
            "....KRRRPPRKRRK.",
            "...KRRKPPKRRK...",
            "...KRRRKPKRRK...",
            "...KRRRRKKRRK...",
            "...KKRRRKRRK....",
            "..KRKKKKPKKK....",
            ".PRKRRRRKRRRK...",
            ".PKRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            ".....KKKKKK.....",
            "...KKKKKKKKKK...",
            "..KKK..KKKKKKK..",
            ".KKKK......KKK..",
            ".KKK.......KKKK.",
            "................",
            "................",
        ],
    ]),
    sd("agent.kick", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "...KKKKKK.......",
            "..KKKKKKKKK.....",
            "..KKKKKKPPP.....",
            "..KKKKKPPKP.....",
            "..KKKKPPPPPP....",
            "...KKKPPPPP.....",
            "...KKKKPPPK.....",
            "..KRRKPPKRRK....",
            "..KRRRKPKRRK....",
            "..KRRRRKKRRK....",
            "...KRRRKRRK.....",
            "..KRKKKPKKK.....",
            ".KRRRRRKRRRK....",
            "PRKRRRRKRRRRK...",
            "PKRRRRRKRRRRKK..",
            ".KRRRRRKRRRRKKKK",
            ".......KKKKKKKKK",
            "....KKK...KKKK..",
            "...KKK..........",
            "..KKK...........",
            ".KKKK...........",
            "................",
            "................",
            "................",
        ],
    ]),
    sd("agent.duck", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "....KKKKKK......",
            "...KKKKKKKKK....",
            "...KKKKKKPPP....",
            "...KKKKKPPKP....",
            "...KKKKPPPPPP...",
            "....KKKPPPPP....",
            "...KKKKKPPP.....",
            "..KRRKPPKRRK....",
            "..KRRRKPKRRK....",
            "..KRRRRKKRRK....",
            "..KRRRRKRRRK....",
            "...KKKKKKKKKK...",
            "...KKKK.KKKKK...",
            "...KKKK.KKKKKK..",
        ],
    ]),
    sd("agent.shoot", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "....KKKKPPPPPP..",
            ".....KKKPPPPP...",
            ".....KKKKPPP....",
            "....KRRRPPRK....",
            "...KRRKPPKRKKKKK",
            "...KRRRKPKRRRPKK",
            "...KRRRRKKKKKKK.",
            "....KRRRKRRK.K..",
            "....KKKKPKKK....",
            "...KRRRRKRRRK...",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            "..KRRRRRKRRRRK..",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "...KKKK.KKKK....",
            "...KKKK.KKKK....",
        ],
    ]),
    sd("agent.shootlow", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "....KKKKKK......",
            "...KKKKKKKKK....",
            "...KKKKKKPPP....",
            "...KKKKKPPKP....",
            "...KKKKPPPPPP...",
            "....KKKPPPPP....",
            "...KKKKKPPP.....",
            "..KRRKPPKRKKKKK.",
            "..KRRRKPKRRRPKK.",
            "..KRRRRKKKKKKK..",
            "..KRRRRKRRRKK...",
            "...KKKKKKKKKK...",
            "...KKKK.KKKKK...",
            "...KKKK.KKKKKK..",
        ],
    ]),
    sd("agent.die", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "..............PP",
            "..............PP",
            "..............RK",
            "...KKKKKK.....RK",
            "..KKKKKKKKK...RK",
            "..KKKKKKPPP..RRK",
            "..KKKKKPPKP.RRK.",
            "..KKKKPPPPPP....",
            "PK.KKKPPPPP.....",
            "KRKKKKKPPPK.....",
            ".KKRRKPPKRRK....",
            "..KRRRKPKRRK....",
            "..KRRRRKKRRK....",
            "...KRRRKRRK.....",
            "...KKKKPKKK.....",
            "..KRRRRKRRRK....",
            ".KRRRRRKRRRRK...",
            ".KRRRRRKRRRRK...",
            ".KRRRRRKRRRRK...",
            ".....KKK.KKK....",
            ".....KKK..KKK...",
            ".....KKK..KKK...",
            ".....KKK...KKKK.",
            "....KKKK........",
        ],
        &[
            "................",
            ".....KKKKKK.....",
            "PP..KKKKKKKK..PP",
            "PP..KPPPPPPK..PP",
            "KRK.KPKPPKPK.KRK",
            ".KRKKPPPPPPKKRK.",
            ".KRK.KPKKPK.KRK.",
            "..KRK.KPPK.KRK..",
            "..KKRRRPPRRRKK..",
            "..KRRKPPPPKRRK..",
            "..KRRRKKKKRRRK..",
            "..KRRRRKKRRRRK..",
            "..KRRRRKKRRRRK..",
            "..KKKKKPPKKKKK..",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            "...KKKK..KKKK...",
            "..KKKK....KKKK..",
            ".KKKK......KKKK.",
            "................",
            "................",
            "................",
        ],
        &[
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "..KKK..KKKKKKK..",
            ".KKKKKKRRRRRRRK.",
            "KKPPPKRRRRRRRRKK",
            "KPPKPKRRKRRRRRKK",
            "KPKPPKRRKRRRRKKK",
            "KPPPPKRRRRRRRKKK",
            ".KKKKKKRRRRRRKK.",
            "..KKK..KKKKKK...",
        ],
    ]),
    sd("agent.hang", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            ".KPP........PPK.",
            ".KPP........PPK.",
            ".KRR........RRK.",
            ".KRR........RRK.",
            ".KRR.KKKKKK.RRK.",
            ".KRRKKKKKKKKRRK.",
            ".KRRKPPPPPPKRRK.",
            ".KRRKPKPPKPKRRK.",
            ".KRRKPPPPPPKRRK.",
            ".KRR.KPPPPK.RRK.",
            ".KRR..KPPK..RRK.",
            ".KRKRRRPPRRRKRK.",
            "..KRRKPPPPKRRK..",
            "..KRRRKKKKRRRK..",
            "..KRRRRKKRRRRK..",
            "..KRRRRKKRRRRK..",
            "..KKKKKPPKKKKK..",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK...KKK...",
            "...KKKK...KKKK..",
            "...KKK.....KKK..",
        ],
    ]),
    sd("agent.crouch", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKKK...",
            "....KKKKKKPPP...",
            "....KKKKKPPKP...",
            "...KKKKKPPPPPP..",
            "..KRKKKKPPPPP...",
            ".PRKRKKKKPPPK...",
            ".PKKRRRKPKRRK...",
            "...KRRRRKRRRK...",
            "..KRRRRRKRRRPP..",
            "...KKKKKKKKKPPK.",
            "...KKKK..KKKKK..",
            "..KKKK...KKKKKK.",
        ],
    ]),
    sd("agent.selfie", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            "...KKKKKK....KKK",
            "..KKKKKKKKK..KPK",
            "..KKKKKKPPP..KKK",
            "..KKKKKPPKP..KKK",
            "..KKKKPPPPPP.KKK",
            "...KKKPPPPP.PP..",
            "...KKKKPPPRRKP..",
            "..KRRRPPRRRK....",
            ".KRRKPPKRRK.....",
            ".KRRRKPKRRK.....",
            ".KRRRRKKRRK.....",
            "..KRRRKRRK......",
            "..KKKKPKKK......",
            ".KRRRRKRRRK.....",
            "KRRRRRKRRRRK....",
            "KRRRRRKRRRRK....",
            "KRRRRRKRRRRK....",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            ".KKKK.KKKK......",
            ".KKKK.KKKK......",
        ],
        &[
            ".............P.P",
            "...KKKKKK....KPK",
            "..KKKKKKKKK..PPP",
            "..KKKKKKPPP..KPK",
            "..KKKKKPPKP..KKK",
            "..KKKKPPPPPP.KKK",
            "...KKKPPPPP.PP..",
            "...KKKKPPPRRKP..",
            "..KRRRPPRRRK....",
            ".KRRKPPKRRK.....",
            ".KRRRKPKRRK.....",
            ".KRRRRKKRRK.....",
            "..KRRRKRRK......",
            "..KKKKPKKK......",
            ".KRRRRKRRRK.....",
            "KRRRRRKRRRRK....",
            "KRRRRRKRRRRK....",
            "KRRRRRKRRRRK....",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            ".KKKK.KKKK......",
            ".KKKK.KKKK......",
        ],
    ]),
    sd("agent.ride", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KPPPPPPK....",
            "....KPKPPKPK....",
            "....KPPPPPPK....",
            ".....KPPPPK.....",
            "......KPPK......",
            "...KRRRPPRRRK...",
            "..KRRKPPPPKRRK..",
            "..KRRRKKKKRRRK..",
            "..KRRKRKKRKRRK..",
            "..KRRKRKKRKRRK..",
            "..KRRKKPPKKRRK..",
            "..KPPKRKKRKPPK..",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "...KKKK..KKKK...",
            "...KKKK..KKKK...",
        ],
    ]),
    sd("agent.hold", 16, 24, &[('K', c::BLACK), ('R', c::RED), ('P', c::PEACH)], &[
        &[
            ".KPP........PPK.",
            ".KPP........PPK.",
            ".KRR.KKKKKK.RRK.",
            ".KRRKKKKKKKKRRK.",
            ".KRRKPPPPPPKRRK.",
            ".KRRKPKPPKPKRRK.",
            ".KRRKPPPPPPKRRK.",
            ".KRR.KPPPPK.RRK.",
            ".KRR..KPPK..RRK.",
            ".KRKRRRPPRRRKRK.",
            ".KKRRKPPPPKRRKK.",
            ".KKRRRKKKKRRRKK.",
            "..KRRRRKKRRRRK..",
            "..KRRRRKKRRRRK..",
            "..KKKKKPPKKKKK..",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            ".KRRRRRKKRRRRRK.",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "...KKKK..KKKK...",
            "...KKKK..KKKK...",
        ],
    ]),
    sd("spy.stand", 16, 24, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KWWWWWWK....",
            "..KKKKKKKKKKKK..",
            "....KKKKKKKWKK..",
            "....KKKKPPPPPP..",
            "....KKKKPPPPK...",
            ".....KKKKPPP....",
            ".....KWWWWK.....",
            "...KKKKWWKKKK...",
            "...KKKKKWKKKK...",
            "...KKWKKKKKWKK..",
            "...KKKKKKKKKK...",
            "...KKWKKKKKWKK..",
            "...KKKKKKKKPP...",
            "....KKKKKKKK....",
            "....KKKKKKKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "....KKK..KKK....",
            "...KKKK.KKKK....",
            "...KKKK.KKKK....",
        ],
    ]),
    sd("spy.walk", 16, 24, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KWWWWWWK....",
            "..KKKKKKKKKKKK..",
            "....KKKKKKKWKK..",
            "....KKKKPPPPPP..",
            "....KKKKPPPPK...",
            ".....KKKKPPP....",
            ".....KWWWWK.....",
            "...KKKKWWKKKK...",
            "...KKKKKWKKKK...",
            "...KKWKKKKKKKK..",
            "..KKKKKKKKKKKK..",
            ".PWKKWKKKKKWKWP.",
            ".PKKKKKKKKKPPKP.",
            "....KKKKKKKK....",
            "....KKKKKKKK....",
            ".....KKKKKK.....",
            "....KKK..KKK....",
            "...KKK....KKK...",
            "..KKK......KKK..",
            "..KKKK.....KKKK.",
        ],
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KWWWWWWK....",
            "..KKKKKKKKKKKK..",
            "....KKKKKKKWKK..",
            "....KKKKPPPPPP..",
            "....KKKKPPPPK...",
            ".....KKKKPPP....",
            ".....KWWWWK.....",
            "...KKKKWWKKKK...",
            "...KKKKKWKKKK...",
            "...KKWKKKKKWKK..",
            "...KKKKKKKKKK...",
            "...KKWKKKKKWKK..",
            "...KKKKKKKKPP...",
            "....KKKKKKKK....",
            "....KKKKKKKK....",
            ".....KKKKKK.....",
            "....KKK.KKK.....",
            "...KKK..KKK.....",
            "..KKK...KKK.....",
            "..KK....KKK.....",
            "........KKKK....",
        ],
        &[
            "................",
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KWWWWWWK....",
            "..KKKKKKKKKKKK..",
            "....KKKKKKKWKK..",
            "....KKKKPPPPPP..",
            "....KKKKPPPPK...",
            ".....KKKKPPP....",
            ".....KWWWWK.....",
            "...KKKKWWKKKK...",
            "...KKKKKWKKKK...",
            "...KKWKKKKKWKK..",
            "..KKKKKKKKKKKK..",
            ".PWKKWKKKKKWKKP.",
            ".PKKKKKKKKKPPKP.",
            "....KKKKKKKK....",
            "....KKKKKKKK....",
            ".....KKKKKK.....",
            "....KKK..KKK....",
            "...KKK....KKK...",
            "..KKK......KKK..",
            "..KKKK.....KKKK.",
        ],
        &[
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KWWWWWWK....",
            "..KKKKKKKKKKKK..",
            "....KKKKKKKWKK..",
            "....KKKKPPPPPP..",
            "....KKKKPPPPK...",
            ".....KKKKPPP....",
            ".....KWWWWK.....",
            "...KKKKWWKKKK...",
            "...KKKKKWKKKK...",
            "...KKWKKKKKWKK..",
            "...KKKKKKKKKK...",
            "...KKWKKKKKWKK..",
            "...KKKKKKKKPP...",
            "....KKKKKKKK....",
            "....KKKKKKKK....",
            ".....KKKKKK.....",
            ".....KKK.KKK....",
            ".....KKK..KKK...",
            ".....KKK..KKK...",
            ".....KKK...KKKK.",
            "....KKKK........",
        ],
    ]),
    sd("spy.aimhigh", 16, 24, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "................",
            "...KKKKKK.......",
            "..KKKKKKKK......",
            "..KWWWWWWK......",
            "KKKKKKKKKKKK....",
            "..KKKKKKKWKK....",
            "..KKKKPPPPPP....",
            "..KKKKPPPPK.....",
            "...KKKKPPP...KKK",
            "...KWWWWK..KKWPK",
            ".KKKKWWKKKKKKWP.",
            ".KKKKKWKKKK.....",
            ".KKWKKKKKWKK....",
            ".KKKKKKKKKK.....",
            ".KKWKKKKKWKK....",
            ".KKKKKKKKPP.....",
            "..KKKKKKKK......",
            "..KKKKKKKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            ".KKKK.KKKK......",
            ".KKKK.KKKK......",
        ],
    ]),
    sd("spy.aimlow", 16, 24, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "................",
            "...KKKKKK.......",
            "..KKKKKKKK......",
            "..KWWWWWWK......",
            "KKKKKKKKKKKK....",
            "..KKKKKKKWKK....",
            "..KKKKPPPPPP....",
            "..KKKKPPPPK.....",
            "...KKKKPPP......",
            "...KWWWWK.......",
            ".KKKKWWKKKK.....",
            ".KKKKKWKKKKK....",
            ".KKWKKKKKWKKK...",
            ".KKKKKKKKKK.KK..",
            ".KKWKKKKKWKK.KK.",
            ".KKKKKKKKPP..WW.",
            "..KKKKKKKK...PPK",
            "..KKKKKKKK...KKK",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            "..KKK..KKK......",
            ".KKKK.KKKK......",
            ".KKKK.KKKK......",
        ],
    ]),
    sd("spy.duck", 16, 24, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            ".....KKKKKK.....",
            "....KKKKKKKK....",
            "....KWWWWWWK....",
            "..KKKKKKKKKKKK..",
            "....KKKKKKKWKK..",
            "....KKKKPPPPPP..",
            "....KKKKPPPPK...",
            ".....KKKKPPP....",
            ".....KWWWWK.....",
            "...KKKKWWKKKK...",
            "...KKKKKWKKKK...",
            "....KKKKKKKKKK..",
            "....KKKK.KKKKK..",
            "....KKKK.KKKKKK.",
        ],
    ]),
    sd("spy.die", 16, 24, &[('K', c::BLACK), ('W', c::WHITE), ('P', c::PEACH)], &[
        &[
            "...KKKKKK.......",
            "..KKKKKKKK......",
            "..KWWWWWWK......",
            "KKKKKKKKKKKK....",
            "................",
            "................",
            "...KKKKKKKWKKKP.",
            "...KKKKPPPPPKKP.",
            "...KKKKPPPPKKK..",
            "PK..KKKKPPP.....",
            "KKK.KWWWWK......",
            ".KKKKKWWKKKK....",
            "..KKKKKWKKKK....",
            "..KKWKKKKKWKK...",
            "..KKKKKKKKKK....",
            "..KKWKKKKKWKK...",
            "..KKKKKKKKPP....",
            "...KKKKKKKK.....",
            "...KKKKKKKK.....",
            ".....KKK.KKK....",
            ".....KKK..KKK...",
            ".....KKK..KKK...",
            ".....KKK...KKKK.",
            "....KKKK........",
        ],
        &[
            "................",
            ".....KKKKKK.....",
            "PP..KKKKKKKK..PP",
            "PP..KWWWWWWK..PP",
            "WWKKKKKKKKKKKKWW",
            ".KKKKKWKKKKKKKK.",
            ".KKK.PPPPPP.KKK.",
            "..KKKPPKKPPKKK..",
            "..KKK.PPPP.KKK..",
            "...KKKWWWWKKK...",
            "..KKKKWKKWKKKK..",
            "..KKKKKWWKKKKK..",
            "..KKWKKKKKKWKK..",
            "..KKKKKKKKKKKK..",
            "..KKWKKKKKKWKK..",
            "...KKKKKKKKKK...",
            "...KKKKKKKKKK...",
            "................",
            "...KKKK..KKKK...",
            "..KKKK....KKKK..",
            ".KKKK......KKKK.",
            "................",
            "................",
            "................",
        ],
        &[
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "................",
            "..KKKK..........",
            ".KWWWWK.KKKKKKK.",
            "KKKKKKKKKKKKKKKK",
            "KKPPKKKKWWKKKKKK",
            "KPPKKWKKKWKKKKKK",
            "KPPPPPKKKKKKKKKK",
            ".KKKKKKKKKKKKKK.",
            "..KKK...KKKKK...",
        ],
    ]),
    sd("cop.segway", 24, 24, &[('K', c::BLACK), ('U', c::SKY), ('P', c::PEACH)], &[
        &[
            ".........KKKKK..........",
            "........KUUUUUUK........",
            ".......KUUUUUUUUK.......",
            ".......KUUKUUKUUUK......",
            ".......KKKKKKKKKKKKK....",
            "........KPPPPPPP........",
            "........KPPPPKPPP.......",
            "........KPPPPPPPPP......",
            ".........KPPPKKKP.......",
            "......KUUUUUUUUUUKK.....",
            "......KUUUUUUUPUUUUPP...",
            "......KKKKKKKKKKKKKKKK..",
            ".......KUUUUUUUUK.KK....",
            "........KUUUUUUK..KK....",
            "........KKKKKKKKKKKK....",
            ".....KKKKKKKKKKKKKKKK...",
            "..........KKKK..........",
            ".........KKUKKK.........",
            "........KKKKKKKU........",
            "........KKKKKKKK........",
            "........KUKKKKKK........",
            "........KKKKKKKK........",
            ".........KKKUKK.........",
            "..........KKKK..........",
        ],
        &[
            "........................",
            ".........KKKKK..........",
            "........KUUUUUUK........",
            ".......KUUUUUUUUK.......",
            ".......KUUKUUKUUUK......",
            ".......KKKKKKKKKKKKK....",
            "........KPPPPPPP........",
            "........KPPPPKPPP.......",
            "........KPPPPPPPPP......",
            ".........KPPPKKKP.......",
            "......KUUUUUUUUUUKK.....",
            "......KUUUUUUUPUUUUPPK..",
            "......KKKKKKKKKKKKKK....",
            ".......KUUUUUUUUK.KK....",
            "........KUUUUUUKKKKK....",
            ".....KKKKKKKKKKKKKKKK...",
            "..........KKKK..........",
            ".........KUKKUK.........",
            "........KKKKKKKK........",
            "........KKKKKKKK........",
            "........KKKKKKKK........",
            "........KKKKKKKK........",
            ".........KUKKUK.........",
            "..........KKKK..........",
        ],
    ]),
    sd("cop.whistle", 24, 24, &[('K', c::BLACK), ('U', c::SKY), ('P', c::PEACH)], &[
        &[
            ".........KKKKK..........",
            "........KUUUUUUK........",
            ".......KUUUUUUUUK.......",
            ".......KUUKUUKUUUK..K..K",
            ".......KKKKKKKKKKKKK.K.K",
            "........KPPPPPPP....KKK.",
            "........KPPPPKPPP....K.K",
            "........KPPPPPPPPPPPK..K",
            ".........KPPPKKKPUPKK...",
            "......KUUUUUUUUUUU......",
            "......KUUUUUUUPUUK......",
            "......KKKKKKKKKKKKKKKK..",
            ".......KUUUUUUUUK.KK....",
            "........KUUUUUUK..KK....",
            "........KKKKKKKKKKKK....",
            ".....KKKKKKKKKKKKKKKK...",
            "..........KKKK..........",
            ".........KKUKKK.........",
            "........KKKKKKKU........",
            "........KKKKKKKK........",
            "........KUKKKKKK........",
            "........KKKKKKKK........",
            ".........KKKUKK.........",
            "..........KKKK..........",
        ],
    ]),
    sd("janitor.walk", 16, 24, &[('K', c::BLACK), ('T', c::TEAL), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "................",
            ".....TTTTTT...K.",
            "....TTTTTTTT..K.",
            "....KKKKKKKKKKK.",
            "....KPPPPPPP..K.",
            "....KPPPPKPP..K.",
            ".....PPPPPPPP.K.",
            ".....KPKKKPP..K.",
            "....KTTTTTTK..K.",
            "...KTTTTTTTTK.K.",
            "...KTTTTTTTTTPK.",
            "...KTTTTTTTTPPK.",
            "...KTTTTTTTTK.K.",
            "..KKKKKKKKKKK.K.",
            ".K.KTTTTTTTTK.K.",
            "KKKKTTTTTTTTK.K.",
            "KTTTKTTTTTTK..K.",
            ".KTTTKTTTTT...K.",
            "..KKKTT..TTT.KKK",
            "...TTT....TTPPPP",
            "..KKK......KPKPP",
            "..KKKK....KKPKPP",
        ],
        &[
            "................",
            "................",
            ".....TTTTTT.....",
            "....TTTTTTTT..K.",
            "....KKKKKKKKKKK.",
            "....KPPPPPPP..K.",
            "....KPPPPKPP..K.",
            ".....PPPPPPPP.K.",
            ".....KPKKKPP..K.",
            "....KTTTTTTK..K.",
            "...KTTTTTTTTK.K.",
            "...KTTTTTTTTTPK.",
            "...KTTTTTTTTPPK.",
            "...KTTTTTTTTK.K.",
            "..KKKKKKKKKKK.K.",
            ".K.KTTTTTTTTK.K.",
            "KKKKTTTTTTTTK.K.",
            "KTTTKTTTTTTK..K.",
            ".KTTTKT..TTT..K.",
            "..KKKTT..TTT..K.",
            "....TTT..TTT.KKK",
            "....TTT..TTTPPPP",
            "...KKKK..KKKPKPP",
            "...KKKK..KKKP.PP",
        ],
    ]),
    sd("janitor.mop", 16, 24, &[('K', c::BLACK), ('T', c::TEAL), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "................",
            ".......TTTTTT...",
            "......TTTTTTTT..",
            "......KKKKKKKKKK",
            "......KPPPPPPP..",
            "......KPPPPKPP..",
            ".......PPPPPPPP.",
            "......KKPKKKPP..",
            ".....KTTTTTTTTK.",
            ".....KTTTTTKTTK.",
            ".....KTTTTTPPTK.",
            "....KTTTTTTPPK..",
            "....KKKKKKKKKK..",
            "....KTTTTTTTKK..",
            "....KTTTTTTTPK..",
            ".....KTTTTTTKK..",
            ".............K..",
            "......TTTTTT.K..",
            ".....TTT..TTT.K.",
            "....TTT....TKKKK",
            "...KKK......PPPP",
            "...KKKK....KPKPP",
        ],
        &[
            "................",
            "................",
            "................",
            ".......TTTTTT...",
            "......TTTTTTTT..",
            "......KKKKKKKKKK",
            "......KPPPPPPP..",
            "......KPPPPKPP..",
            ".......PPPPPPPP.",
            "......KKPKKKPP..",
            ".....KTTTTTTTTK.",
            ".....KTTTTTKTTK.",
            ".....KTTTTTPPTK.",
            "....KTTTTTTPPK..",
            "....KKKKKKKKKK..",
            "....KTTTTTTTKK..",
            "....KTTTTTTKPK..",
            ".....KTTTTTKK...",
            "...........K....",
            "......TTTTTK....",
            ".....TTT..KTT...",
            "....TTT.KKKKTT..",
            "...KKK..PPPPKKK.",
            "...KKKK.PKPPKKK.",
        ],
    ]),
    sd("walker.walk", 16, 24, &[('K', c::BLACK), ('T', c::TEAL), ('P', c::PEACH)], &[
        &[
            "................",
            "................",
            "......PPPP......",
            ".....PPPPPP.....",
            "....KTTTTTTTTT..",
            "....KPPPPPPP....",
            "....KPPPPKPP....",
            ".....PPPPPPPP...",
            "......KPPPK.....",
            "....KTTTTKTTK...",
            "...KTTTTKTTKTP..",
            ".KTKTTTTTKKKPPP.",
            "PPTKTTTTTTKK....",
            "PP.KTTTTTTKK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "..KTTTTTTTTTK...",
            "..KTTTTTTTTTK...",
            ".....TTTTTT.....",
            "....TTT..TTT....",
            "...TTT....TTT...",
            "..KKK......KKK..",
            "..KKKK.....KKKK.",
        ],
        &[
            "................",
            "......PPPP......",
            ".....PPPPPP.....",
            "....KTTTTTTTTT..",
            "....KPPPPPPP....",
            "....KPPPPKPP....",
            ".....PPPPPPPP...",
            "......KPPPK.....",
            "....KTTTTTK.....",
            "...KTTTTTTTK....",
            "...KTTTTTTKK....",
            "...KTTTTTTKK....",
            "...KTTTTTTKK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "..KTTTTTTTTTK...",
            "..KTTTTTTTTTK...",
            ".....TTTTTT.....",
            "....TTT.TTT.....",
            "...TTT..TTT.....",
            "..TTT...TTT.....",
            "..KK....KKK.....",
            "........KKKK....",
        ],
        &[
            "................",
            "................",
            "......PPPP......",
            ".....PPPPPP.....",
            "....KTTTTTTTTT..",
            "....KPPPPPPP....",
            "....KPPPPKPP....",
            ".....PPPPPPPP...",
            "......KPPPK.....",
            "....KTTTTTKTK...",
            "...KTTTTTTTKTP..",
            ".KTTKTTTTTKKPPP.",
            "PPTTKTTTTTKK....",
            "PP.KTTTTTTKK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "..KTTTTTTTTTK...",
            "..KTTTTTTTTTK...",
            ".....TTTTTT.....",
            "....TTT..TTT....",
            "...TTT....TTT...",
            "..KKK......KKK..",
            "..KKKK.....KKKK.",
        ],
        &[
            "................",
            "......PPPP......",
            ".....PPPPPP.....",
            "....KTTTTTTTTT..",
            "....KPPPPPPP....",
            "....KPPPPKPP....",
            ".....PPPPPPPP...",
            "......KPPPK.....",
            "....KTTTTTK.....",
            "...KTTTTTTTK....",
            "...KTTTTTTKK....",
            "...KTTTTTTKK....",
            "...KTTTTTTKK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "...KTTTTTTTK....",
            "..KTTTTTTTTTK...",
            "..KTTTTTTTTTK...",
            ".....TTTTTT.....",
            ".....TTT.TTT....",
            ".....TTT..TTT...",
            ".....TTT..TTT...",
            ".....KKK...KKKK.",
            "....KKKK........",
        ],
    ]),
    sd("sign.wet", 8, 12, &[('K', c::BLACK), ('Y', c::YELLOW), ('O', c::ORANGE)], &[
        &[
            "...KK...",
            "..KYYK..",
            ".KYYYYK.",
            ".KYKKYK.",
            ".KYKKYK.",
            ".KYKKYK.",
            "KYYYYYYK",
            "KYYKKYYK",
            "KYYYYYYK",
            "KOOOOOOK",
            "KOO..OOK",
            "KK....KK",
        ],
    ]),
    ]
}

// Tests of characters.test.ts (character art + item art; the TS file covers both modules).
#[cfg(test)]
mod tests {
    use crate::art::registry::get_sprite;
    use crate::engine::palette::{c, TRANSPARENT};
    use crate::engine::sprite::{make_recolor, Sprite};
    use std::collections::HashSet;

    /// Bounding box of the opaque pixels of one frame.
    struct BBox {
        x0: i32,
        x1: i32,
        y0: i32,
        y1: i32,
        count: i32,
    }
    fn bbox(s: &Sprite, f: usize) -> BBox {
        let (mut x0, mut x1, mut y0, mut y1, mut count) = (i32::MAX, -1, i32::MAX, -1, 0);
        for y in 0..s.h {
            for x in 0..s.w {
                if s.frames[f][(y * s.w + x) as usize] == TRANSPARENT {
                    continue;
                }
                count += 1;
                x0 = x0.min(x);
                x1 = x1.max(x);
                y0 = y0.min(y);
                y1 = y1.max(y);
            }
        }
        BBox { x0, x1, y0, y1, count }
    }
    fn frame(s: &Sprite, f: usize) -> Vec<u8> {
        s.frames[f].clone()
    }
    fn colors_of(s: &Sprite) -> HashSet<u8> {
        s.colors.iter().copied().collect()
    }

    #[test]
    fn animation_frames_are_pairwise_different_walk_cycles_rolling_mopping() {
        for name in ["agent.walk", "spy.walk", "walker.walk", "cop.segway", "janitor.walk", "janitor.mop", "agent.selfie", "agent.die", "spy.die"] {
            let s = get_sprite(name);
            let mut seen: Vec<Vec<u8>> = Vec::new();
            for f in 0..s.frames.len() {
                let fr = frame(s, f);
                if !seen.contains(&fr) {
                    seen.push(fr);
                }
            }
            assert_eq!(seen.len(), s.frames.len(), "{} has duplicate frames", name);
        }
    }

    #[test]
    fn the_agent_wears_a_red_trench_coat_with_dark_hair_and_boots_the_spy_has_no_red_at_all() {
        for name in ["agent.stand", "agent.walk", "agent.jump", "agent.kick", "agent.shoot", "agent.ride"] {
            let s = get_sprite(name);
            for f in 0..s.frames.len() {
                let red = s.frames[f].iter().filter(|&&v| v == c::RED).count();
                assert!(red > 30, "{} frame {} should be mostly coat", name, f);
            }
            assert!(colors_of(s).contains(&c::BLACK), "{} black hair/boots", name);
            assert!(colors_of(s).contains(&c::PEACH), "{} skin", name);
        }
        for name in ["spy.stand", "spy.walk", "spy.aimhigh", "spy.aimlow", "spy.duck", "spy.die"] {
            let s = get_sprite(name);
            assert!(!colors_of(s).contains(&c::RED), "{} must not use the agent's red", name);
            assert!(colors_of(s).contains(&c::BLACK), "{} black suit", name);
            assert!(colors_of(s).contains(&c::WHITE), "{} white shirt", name);
        }
    }

    #[test]
    fn standing_and_walking_sprites_are_bottom_aligned_and_horizontally_centred_in_their_cell() {
        let groups: [(&str, i32); 7] =
            [("agent.stand", 16), ("agent.walk", 16), ("spy.stand", 16), ("spy.walk", 16), ("walker.walk", 16), ("janitor.walk", 16), ("cop.segway", 24)];
        for (name, w) in groups {
            let s = get_sprite(name);
            for f in 0..s.frames.len() {
                let b = bbox(s, f);
                assert_eq!(b.y1, s.h - 1, "{} frame {} should touch the bottom row", name, f);
                let centre = (b.x0 + b.x1) as f64 / 2.0;
                let target = (w - 1) as f64 / 2.0;
                // the Segway's handlebar sticks out to the right, so allow it more slack
                let slack = if name == "cop.segway" { 2.5 } else { 1.25 };
                assert!((centre - target).abs() <= slack, "{} frame {} centre {}", name, f, centre);
            }
        }
    }

    #[test]
    fn crouched_poses_are_bottom_aligned_and_only_fill_the_lower_part_of_the_cell() {
        for name in ["agent.duck", "agent.shootlow", "spy.duck", "agent.crouch"] {
            let b = bbox(get_sprite(name), 0);
            assert_eq!(b.y1, 23, "{} bottom", name);
            assert!(b.y0 >= 8, "{} should leave the top of the cell empty", name);
        }
        // hanging: hands at the very top of the cell
        assert_eq!(bbox(get_sprite("agent.hang"), 0).y0, 0);
        assert_eq!(bbox(get_sprite("agent.hold"), 0).y0, 0);
    }

    #[test]
    fn death_sequences_end_lying_down_on_the_floor_flatter_than_they_started() {
        for name in ["agent.die", "spy.die"] {
            let s = get_sprite(name);
            let first = bbox(s, 0);
            let last = bbox(s, s.frames.len() - 1);
            assert!(last.y1 - last.y0 < first.y1 - first.y0, "{} lying frame height", name);
            assert!(last.y1 >= 22, "{} lying frame rests on the floor", name);
        }
    }

    #[test]
    fn the_mall_walker_is_a_single_recolourable_tracksuit_colour_plus_black_and_skin() {
        let s = get_sprite("walker.walk");
        let want: HashSet<u8> = [c::BLACK, c::TEAL, c::PEACH].into_iter().collect();
        assert_eq!(colors_of(s), want);
        let lut = make_recolor(&[(c::TEAL, c::HOTPINK)]);
        for f in 0..s.frames.len() {
            let before = bbox(s, f).count;
            let mut after: HashSet<u8> = HashSet::new();
            for i in 0..(s.w * s.h) as usize {
                let v = s.frames[f][i];
                if v != TRANSPARENT {
                    after.insert(lut[v as usize]);
                }
            }
            assert!(after.contains(&c::HOTPINK) && !after.contains(&c::TEAL), "recolour swaps the whole tracksuit");
            assert!(before > 80);
        }
    }

    #[test]
    fn the_cop_has_a_helmet_blue_dome_above_the_face_and_rolls_on_a_wheel_at_the_bottom() {
        let s = get_sprite("cop.segway");
        let b = bbox(s, 0);
        assert!(b.y0 <= 1);
        // wheel: the bottom row has black pixels
        let mut bottom_black = 0;
        for x in 0..s.w {
            if s.frames[0][((s.h - 1) * s.w + x) as usize] == c::BLACK {
                bottom_black += 1;
            }
        }
        assert!(bottom_black >= 2);
    }

    // ---- item art
    const POWER_UPS: [&str; 9] = ["rapid", "spread", "armor", "sneakers", "radar", "oneup", "cinnabomb", "ooze", "pretzel"];

    #[test]
    fn every_power_up_icon_is_distinct_and_fills_most_of_its_12x12_cell() {
        let mut seen: Vec<(Vec<u8>, &str)> = Vec::new();
        for id in POWER_UPS {
            let s = get_sprite(&format!("item.{}", id));
            let b = bbox(s, 0);
            assert!(b.x1 - b.x0 + 1 >= 9, "{} width", id);
            assert!(b.y1 - b.y0 + 1 >= 9, "{} height", id);
            assert!(b.count >= 45, "{} pixel count", id);
            let key = frame(s, 0);
            if let Some((_, other)) = seen.iter().find(|(k, _)| *k == key) {
                panic!("{} duplicates {}", id, other);
            }
            seen.push((key, id));
        }
    }

    #[test]
    fn power_up_icons_have_a_black_outline_share_of_at_least_15_percent() {
        // A cheap readability check: at least 15% of each icon's pixels are black outline.
        let mut ids: Vec<&str> = POWER_UPS.to_vec();
        ids.push("package");
        for id in ids {
            let s = get_sprite(&format!("item.{}", id));
            let (mut black, mut all) = (0, 0);
            for i in 0..(s.w * s.h) as usize {
                let v = s.frames[0][i];
                if v == TRANSPARENT {
                    continue;
                }
                all += 1;
                if v == c::BLACK {
                    black += 1;
                }
            }
            assert!(black as f64 / all as f64 > 0.15, "{} outline share", id);
        }
    }

    #[test]
    fn spinning_coins_have_four_different_frames_the_edge_on_frame_is_the_narrowest() {
        for name in ["item.coin", "item.goldcoin"] {
            let s = get_sprite(name);
            assert_eq!(s.frames.len(), 4);
            let mut seen: Vec<Vec<u8>> = Vec::new();
            let mut widths: Vec<i32> = Vec::new();
            for f in 0..4 {
                let fr = frame(s, f);
                if !seen.contains(&fr) {
                    seen.push(fr);
                }
                let b = bbox(s, f);
                widths.push(b.x1 - b.x0 + 1);
            }
            assert_eq!(seen.len(), 4);
            assert_eq!(widths[2], *widths.iter().min().unwrap());
            assert_eq!(widths[0], *widths.iter().max().unwrap());
        }
    }

    #[test]
    fn the_smoke_puff_expands_over_its_first_frames_and_thins_out_at_the_end() {
        let s = get_sprite("fx.puff");
        let sizes: Vec<i32> = (0..s.frames.len())
            .map(|f| {
                let b = bbox(s, f);
                (b.x1 - b.x0).max(b.y1 - b.y0) + 1
            })
            .collect();
        assert!(sizes[1] > sizes[0]);
        assert!(sizes[2] > sizes[1]);
        let counts: Vec<i32> = (0..s.frames.len()).map(|f| bbox(s, f).count).collect();
        assert!(counts[3] < counts[2]);
    }

    #[test]
    fn player_and_enemy_bullets_read_differently_colour_and_both_point_right_bright_tip_on_the_right() {
        let p = get_sprite("bullet.player");
        let e = get_sprite("bullet.enemy");
        assert_ne!(frame(p, 0), frame(e, 0));
        assert!(colors_of(p).contains(&c::WHITE) || colors_of(p).contains(&c::YELLOW));
        assert!(colors_of(e).contains(&c::RED));
        assert_ne!(p.frames[0][(1 * p.w + 4) as usize], TRANSPARENT);
        assert_ne!(e.frames[0][(1 * e.w + 4) as usize], TRANSPARENT);
    }
}
