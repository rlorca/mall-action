//! Page query-string options: `?seed=N`, `?debug=1`, `?gallery=1`.

#[derive(Clone, Debug)]
pub struct Params {
    pub seed: Option<u64>,
    pub debug: bool,
    pub gallery: bool,
}

pub fn parse_query(q: &str) -> Params {
    let mut p = Params { seed: None, debug: false, gallery: false };
    for pair in q.trim_start_matches('?').split('&') {
        let mut it = pair.splitn(2, '=');
        let k = it.next().unwrap_or("");
        let v = it.next().unwrap_or("");
        match k {
            "seed" => p.seed = v.parse().ok(),
            "debug" => p.debug = v != "0" && v != "false",
            "gallery" => p.gallery = v != "0" && v != "false",
            _ => {}
        }
    }
    p
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_parsing() {
        let p = parse_query("?seed=42&debug=1&gallery=1");
        assert_eq!((p.seed, p.debug, p.gallery), (Some(42), true, true));
        let p = parse_query("");
        assert_eq!((p.seed, p.debug, p.gallery), (None, false, false));
        let p = parse_query("?debug=0&seed=x");
        assert!(!p.debug && p.seed.is_none());
        let p = parse_query("?foo=bar&seed=7");
        assert_eq!(p.seed, Some(7));
    }
}
