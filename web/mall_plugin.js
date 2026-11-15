// MALL ACTION browser glue (miniquad plugin): gamepad, URL options, localStorage, focus, debug hooks.
// Everything is integer/float based so the Rust side needs no string passing.
(function () {
    var qs = new URLSearchParams(window.location.search);
    var focusLost = 0;
    window.addEventListener("blur", function () { focusLost++; });
    document.addEventListener("visibilitychange", function () { if (document.hidden) focusLost++; });

    function pad(b, k) { return b[k] && (b[k].pressed || b[k].value > 0.5); }
    function gamepadMask() {
        var m = 0;
        var pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (var i = 0; i < pads.length; i++) {
            var p = pads[i];
            if (!p || !p.connected) continue;
            var b = p.buttons, ax = p.axes;
            if (pad(b, 12)) m |= 1;
            if (pad(b, 13)) m |= 2;
            if (pad(b, 14)) m |= 4;
            if (pad(b, 15)) m |= 8;
            if (ax.length > 1) {
                if (ax[0] < -0.5) m |= 4;
                if (ax[0] > 0.5) m |= 8;
                if (ax[1] < -0.5) m |= 1;
                if (ax[1] > 0.5) m |= 2;
            }
            if (pad(b, 0)) m |= 16;   // A: shoot
            if (pad(b, 1)) m |= 32;   // B: jump / search
            if (pad(b, 8)) m |= 64;   // Select: map
            if (pad(b, 9)) m |= 128;  // Start: pause / confirm
        }
        return m;
    }
    function storageKey(i) { return "mall-action-" + i; }

    miniquad_add_plugin({
        name: "mall_plugin",
        version: 1,
        register_plugin: function (importObject) {
            importObject.env.mall_gamepad_mask = gamepadMask;
            importObject.env.mall_focus_lost = function () { return focusLost; };
            importObject.env.mall_param_seed = function () {
                var s = qs.get("seed");
                if (s === null || s === "" || isNaN(Number(s))) return -1;
                return Number(s);
            };
            importObject.env.mall_param_flag = function (i) {
                var names = ["debug", "gallery"];
                return qs.get(names[i]) === "1" ? 1 : 0;
            };
            importObject.env.mall_storage_get = function (i) {
                try { var v = window.localStorage.getItem(storageKey(i)); return v === null ? -1 : parseInt(v, 10); }
                catch (e) { return -1; }
            };
            importObject.env.mall_storage_set = function (i, v) {
                try { window.localStorage.setItem(storageKey(i), String(v)); } catch (e) { }
            };
        },
        on_init: function () {
            if (qs.get("debug") === "1" && wasm_exports.mall_debug_step) {
                // ?debug=1: step the game N frames with the given buttons held (bitmask: U1 D2 L4 R8 A16 B32 SEL64 START128)
                window.mallDebug = {
                    step: function (n, mask) { wasm_exports.mall_debug_step(n | 0, (mask | 0) >>> 0); },
                    get: function (i) { return wasm_exports.mall_debug_get(i | 0); },
                    fields: ["scene", "score", "lives", "packages", "loop", "x", "floor", "y", "overlay", "frame", "mallT", "spies", "alarm", "storeId", "crt", "muted"],
                };
            }
        },
    });
})();
