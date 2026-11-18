// Each track supplies its own note pattern, tempo, root, bass motion and voicing.
globalThis.Synth = () => {
  const songs = {
    title: [
      10,
      52,
      [0, 7, 12, 14, 15, 14, 12, 7, 3, 10, 15, 17, 19, 17, 15, 10],
      0.047,
    ],
    mall: [
      33,
      46,
      [12, -1, -1, -1, 7, -1, -1, -1, -1, -1, 15, -1, -1, -1, -1, -1],
      0.013,
    ],
    alarm: [7, 45, [0, 1, 7, 1, 12, 1, 7, 1, 0, 3, 9, 3, 15, 3, 9, 3], 0.033],
    lift: [
      16,
      54,
      [4, -1, 7, 9, -1, 7, 4, 2, 5, -1, 9, 11, -1, 9, 5, 4],
      0.026,
    ],
    side: [9, 56, [0, 5, 7, 12, 10, 7, 5, 3, 2, 7, 9, 14, 12, 9, 7, 5], 0.038],
    0: [9, 52, [0, 7, 10, 12, -1, 10, 7, 3], 0.037],
    1: [7, 50, [0, 3, 7, 12, 15, 7, 3, 12], 0.03],
    2: [15, 48, [4, -1, 7, 11, -1, 9, 7, -1, 5, 9, -1, 7], 0.032],
    3: [6, 57, [0, 4, 7, 12, 16, 12, 7, 4, 2, 5, 9, 14, 17, 14, 9, 5], 0.03],
    4: [17, 65, [0, 7, 12, 3, 7, 15, 5, 9, 17, 7, 11, 19], 0.025],
    6: [10, 51, [0, 0, 3, 5, 7, 5, 3, -1, 0, 3, 7, 10, 12, 7, 3, -1], 0.032],
    7: [9, 45, [0, 0, 3, 0, 5, 3, 7, -1, 0, 0, 3, 0, 10, 7, 5, 3], 0.037],
    8: [23, 54, [0, -1, 7, 11, -1, 14, 12, -1], 0.025],
    9: [12, 60, [0, 7, 4, 7, 2, 9, 5, 9, 4, 10, 7, 10], 0.031],
    11: [
      11,
      53,
      [0, 0, 7, 7, 12, 7, 4, -1, 5, 5, 12, 12, 17, 12, 9, -1],
      0.033,
    ],
  };
  const effects = {
    shot: [85, 37, 0.07],
    enemy: [66, 42, 0.12],
    jump: [48, 77, 0.18],
    ding: [91, 91, 0.22],
    hum: [29, 30, 0.6],
    crush: [40, 20, 0.23],
    fall: [74, 37, 0.23],
    glass: [86, 40, 0.22],
    tick: [67, 71, 0.04],
    package: [72, 79, 84, 91],
    item: [69, 76, 81],
    hurt: [56, 36, 0.2],
    death: [62, 55, 48, 36],
    door: [45, 58, 0.12],
    text: [76, 78, 0.025],
    whistle: [91, 94, 0.32],
    ping: [96, 88, 0.09],
    coins: [88, 92, 0.13],
    zip: [76, 40, 0.6],
    pa: [72, 79, 76],
    smoke: [54, 33, 0.15],
    shriek: [81, 99, 0.28],
    buzz: [37, 32, 0.18],
    pause: [62, 67, 0.09],
    clear: [60, 64, 67, 72, 79],
    over: [55, 52, 48, 43],
    studio: [64, 71, 76, 83],
    thud: [43, 25, 0.1],
    photo: [94, 33, 0.06],
  };
  let ac,
    master,
    noise,
    pulse25,
    mute = false,
    last = "",
    tick = 0,
    n = 0;
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  function unlock() {
    try {
      if (!ac) {
        ac = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        master = ac.createGain();
        master.connect(ac.destination);
        const real = new Float32Array(32),
          imag = new Float32Array(32);
        for (let k = 1; k < 32; k++) {
          real[k] = Math.sin((k * Math.PI) / 2) / (k * Math.PI);
          imag[k] = (1 - Math.cos((k * Math.PI) / 2)) / (k * Math.PI);
        }
        pulse25 = ac.createPeriodicWave(real, imag);
        noise = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
        let a = noise.getChannelData(0),
          q = 1;
        for (let i = 0; i < a.length; i++) {
          q = (Math.imul(q, 1664525) + 1013904223) >>> 0;
          a[i] = q / 2147483648 - 1;
        }
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch {}
  }
  function tone(p, dur, vol, type = "square", end = p, delay = 0) {
    if (!ac || ac.state !== "running" || mute) return;
    const at = ac.currentTime + delay,
      v = ac.createGain(),
      o = type === "noise" ? ac.createBufferSource() : ac.createOscillator();
    if (type === "noise") o.buffer = noise;
    else {
      if (type === "pulse25") o.setPeriodicWave(pulse25);
      else o.type = type;
      o.frequency.setValueAtTime(hz(p), at);
      o.frequency.exponentialRampToValueAtTime(hz(end), at + dur);
    }
    v.gain.setValueAtTime(0.0001, at);
    v.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    v.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(v);
    v.connect(master);
    o.start(at);
    o.stop(at + dur + 0.01);
    o.onended = () => {
      o.disconnect();
      v.disconnect();
    };
  }
  function play(id) {
    const e = effects[id];
    if (!e) return;
    if (e.at(-1) < 1)
      tone(
        e[0],
        e[2],
        0.055,
        ["glass", "smoke", "crush", "photo"].includes(id)
          ? "noise"
          : id === "hum"
            ? "triangle"
            : "square",
        e[1],
      );
    else e.forEach((p, i) => tone(p, 0.19, 0.047, "square", p, i * 0.095));
  }
  function frame(s) {
    if (!master) return;
    master.gain.setTargetAtTime(
      mute ? 0 : s.overlay ? 0.26 : 0.85,
      ac.currentTime,
      0.02,
    );
    s.events.forEach(play);
    if (s.overlay === "map" || s.screen === "continue") return;
    const key =
      s.screen === "title"
        ? "title"
        : s.screen === "store"
          ? s.sideB
            ? "side"
            : String(s.store)
          : s.screen === "mall"
            ? s.p.ride >= 0
              ? "lift"
              : s.alarm
                ? "alarm"
                : "mall"
            : "";
    if (key !== last) {
      tick = n = 0;
      last = key;
    }
    const song = songs[key];
    if (!song) return;
    let [beat, base, seq, vol] = song;
    if (key === "lift" && tick % 32 === 0) tone(30, 0.65, 0.018, "triangle");
    if (tick++ % beat) return;
    const i = n++ % seq.length,
      a = seq[i],
      bar = Math.floor((n - 1) / seq.length) % 4,
      root = base + [0, -2, -5, -2][bar];
    if (a >= 0) {
      tone(root + a + 12, beat / 49, vol, "square");
      if (i % 4 === 2 || key === "mall")
        tone(root + a + 7, beat / 34, vol * 0.42, "pulse25");
    }
    if (i % (key === "mall" ? 8 : 2) === 0)
      tone(root - 12 + (i % 4 ? 7 : 0), beat / 24, vol * 1.5, "triangle");
    if (key !== "mall" && key !== "lift" && i % 2 === 1)
      tone(40, 0.045, vol * 0.45, "noise");
  }
  return {
    unlock,
    frame,
    toggle() {
      mute = !mute;
      return !mute;
    },
  };
};
