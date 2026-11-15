import { DRUMS } from './drums.js';
import { CHANNELS, VEL_ACCENT, VEL_NORMAL, VEL_SOFT, } from './mix.js';
import { chordTone, midiToHz, noteToMidi, parseChord } from './notes.js';
const BASE_INST = {
    pulse1: { duty: 0.25, oct: 4 },
    pulse2: { duty: 0.5, oct: 4 },
    triangle: { oct: 2, gate: 0.95 },
    noise: {},
};
function resolveInst(name, def, ch) {
    const d = { ...BASE_INST[ch], ...def };
    return {
        name,
        duty: d.duty ?? 0.5,
        vol: d.vol ?? 1,
        attack: d.attack ?? 1,
        decay: d.decay ?? 0,
        sustain: d.sustain ?? 1,
        release: d.release ?? 12,
        gate: d.gate ?? 0.92,
        vibrato: d.vibrato,
        oct: d.oct ?? 4,
        arp: d.arp ?? 45,
    };
}
/** `rep('C4 E4', 3)` -> 'C4 E4 C4 E4 C4 E4'. Handy for writing the same bar several times. */
export function rep(pattern, times) {
    return Array.from({ length: times }, () => pattern).join(' ');
}
const CH_ORDER = { pulse1: 0, pulse2: 1, triangle: 2, noise: 3 };
export function compileSong(def) {
    const fail = (msg) => {
        throw new Error(`song "${def.id}": ${msg}`);
    };
    const beatUnit = def.beatUnit ?? 4;
    const stepsPerBeat = def.stepsPerBeat ?? 4;
    const stepsPerBar = def.beats * stepsPerBeat;
    const swing = def.swing ?? 0;
    const swingStep = def.swingStep ?? 1;
    if (!(def.bpm > 20 && def.bpm < 400))
        fail(`bpm ${def.bpm} out of range`);
    if (!Number.isInteger(def.beats) || def.beats < 1)
        fail('beats must be a positive integer');
    if (!Number.isInteger(stepsPerBeat) || stepsPerBeat < 1)
        fail('stepsPerBeat must be a positive integer');
    if (swing < 0 || swing >= 0.6)
        fail('swing must be in [0, 0.6)');
    if (swing > 0 && stepsPerBar % (2 * swingStep) !== 0)
        fail('bar length must be a multiple of two swing units');
    const stepSec = 60 / def.bpm / stepsPerBeat;
    /** Step position -> seconds, with swing (off-beats of each swing unit pair pushed late). */
    const warp = (s) => {
        if (swing === 0)
            return s * stepSec;
        const x = s / swingStep;
        const pair = Math.floor(x / 2 + 1e-9);
        const r = x - 2 * pair;
        const m = r < 1 ? r * (1 + swing) : 1 + swing + (r - 1) * (1 - swing);
        return (pair * 2 + m) * swingStep * stepSec;
    };
    // ----- chord lane -----------------------------------------------------------------------------
    const chordSpans = [];
    let laneSteps = -1; // expected total steps of every lane
    if (def.chords) {
        let cursor = 0;
        for (const tok of tokenize(def.chords)) {
            if (tok === '|') {
                if (cursor % stepsPerBar !== 0)
                    fail(`chords: bar line at step ${cursor} is not on a bar boundary`);
                continue;
            }
            const m = /^([^:]+?)(?::(\d+))?$/.exec(tok);
            if (!m)
                fail(`chords: bad token "${tok}"`);
            const head = m[1];
            const len = m[2] ? Number(m[2]) : 1;
            if (len < 1)
                fail(`chords: zero length in "${tok}"`);
            if (head === '=') {
                const last = chordSpans[chordSpans.length - 1];
                if (!last)
                    fail('chords: tie with nothing before it');
                last.end += len;
            }
            else {
                let chord;
                try {
                    chord = parseChord(head);
                }
                catch (e) {
                    return fail(`chords: ${e.message}`);
                }
                chordSpans.push({ start: cursor, end: cursor + len, chord });
            }
            cursor += len;
        }
        laneSteps = cursor;
    }
    const chordAt = (step) => {
        for (const sp of chordSpans)
            if (step >= sp.start && step < sp.end)
                return sp.chord;
        return undefined;
    };
    // ----- channel lanes --------------------------------------------------------------------------
    const instDefs = def.inst ?? {};
    const channelEvents = { pulse1: [], pulse2: [], triangle: [], noise: [] };
    for (const ch of CHANNELS) {
        const lane = def[ch];
        if (!lane)
            continue;
        const insts = new Map();
        const getInst = (name) => {
            let i = insts.get(name);
            if (!i) {
                const d = name === '' ? {} : instDefs[name];
                if (!d)
                    return fail(`${ch}: unknown instrument "@${name}"`);
                i = resolveInst(name || ch, d, ch);
                insts.set(name, i);
            }
            return i;
        };
        let inst = getInst('');
        const items = [];
        let cursor = 0;
        let last = null; // last note item (for ties); null after a rest
        let lastWasRest = false;
        for (const tok of tokenize(lane)) {
            const where = `${ch} step ${cursor} token "${tok}"`;
            if (tok === '|') {
                if (cursor % stepsPerBar !== 0)
                    fail(`${where}: bar line is not on a bar boundary`);
                continue;
            }
            if (tok.startsWith('@')) {
                if (ch === 'noise')
                    fail(`${where}: instruments do not apply to noise`);
                inst = getInst(tok.slice(1));
                continue;
            }
            const m = /^([^:!?]+)([!?])?(?::(\d+))?([!?])?$/.exec(tok);
            if (!m)
                return fail(`${where}: cannot parse`);
            const head = m[1];
            const len = m[3] ? Number(m[3]) : 1;
            if (len < 1)
                fail(`${where}: zero length`);
            const mark = m[2] ?? m[4];
            const vel = mark === '!' ? VEL_ACCENT : mark === '?' ? VEL_SOFT : VEL_NORMAL;
            if (head === '-') {
                cursor += len;
                last = null;
                lastWasRest = true;
                continue;
            }
            if (head === '=') {
                if (last)
                    last.steps += len;
                else if (!lastWasRest)
                    fail(`${where}: tie with nothing before it`);
                cursor += len;
                continue;
            }
            lastWasRest = false;
            if (ch === 'noise') {
                if (!DRUMS[head])
                    fail(`${where}: unknown drum "${head}"`);
                last = { startStep: cursor, steps: len, pitches: [], drum: head, vel, inst };
                items.push(last);
                cursor += len;
                continue;
            }
            const pitches = [];
            for (const part of head.split('+')) {
                const dm = /^\$(\d+|c|p)(['`,]*)$/.exec(part);
                if (dm) {
                    const chord = chordAt(cursor);
                    if (!chord)
                        fail(`${where}: no chord at this step for "${part}"`);
                    const shift = [...dm[2]].reduce((a, c) => a + (c === ',' ? -12 : 12), 0);
                    const sel = dm[1];
                    if (sel === 'c' || sel === 'p') {
                        const n = Math.min(chord.intervals.length, 4);
                        const idx = Array.from({ length: n }, (_, i) => i + 1);
                        if (sel === 'p')
                            for (let i = n - 1; i >= 2; i--)
                                idx.push(i);
                        for (const k of idx)
                            pitches.push(chordTone(chord, k, inst.oct) + shift);
                    }
                    else {
                        pitches.push(chordTone(chord, Number(sel), inst.oct) + shift);
                    }
                }
                else {
                    try {
                        pitches.push(noteToMidi(part));
                    }
                    catch {
                        return fail(`${where}: bad pitch "${part}"`);
                    }
                }
            }
            last = { startStep: cursor, steps: len, pitches, vel, inst };
            items.push(last);
            cursor += len;
        }
        if (laneSteps < 0)
            laneSteps = cursor;
        else if (cursor !== laneSteps)
            fail(`${ch} lane is ${cursor} steps long but the song is ${laneSteps}`);
        // ----- items -> events --------------------------------------------------------------------
        const out = channelEvents[ch];
        for (const it of items) {
            const t0 = warp(it.startStep);
            const total = warp(it.startStep + it.steps) - t0;
            if (it.drum) {
                const d = DRUMS[it.drum];
                const nat = d.ms / 1000;
                const drumInst = {
                    name: d.name,
                    duty: 0.5,
                    vol: d.vol,
                    attack: 0,
                    decay: d.ms,
                    sustain: 0,
                    release: 6,
                    gate: 1,
                    oct: 0,
                    arp: 0,
                };
                out.push({
                    ch, start: t0, dur: Math.min(nat, total), step: it.startStep, midi: -1,
                    freq: d.hz, freq2: d.hz2, short: d.short, vel: it.vel, inst: drumInst, drum: it.drum,
                });
            }
            else if (it.pitches.length === 1) {
                const midi = it.pitches[0];
                out.push({
                    ch, start: t0, dur: total * it.inst.gate, step: it.startStep, midi,
                    freq: midiToHz(midi), freq2: midiToHz(midi), short: false, vel: it.vel, inst: it.inst,
                });
            }
            else {
                // Arpeggio: stretch the sub-note length so a whole number of them fills the span evenly.
                const nSub = Math.max(1, Math.round(total / (it.inst.arp / 1000)));
                const sub = total / nSub;
                for (let k = 0; k < nSub; k++) {
                    const midi = it.pitches[k % it.pitches.length];
                    out.push({
                        ch, start: t0 + k * sub, dur: sub * it.inst.gate, step: it.startStep, midi,
                        freq: midiToHz(midi), freq2: midiToHz(midi), short: false, vel: it.vel, inst: it.inst,
                    });
                }
            }
        }
    }
    if (laneSteps <= 0)
        fail('has no content');
    if (laneSteps % stepsPerBar !== 0)
        fail(`length ${laneSteps} steps is not a whole number of ${stepsPerBar}-step bars`);
    const bars = laneSteps / stepsPerBar;
    const loopBar = def.loop ? (def.loopBar ?? 0) : 0;
    if (loopBar < 0 || loopBar >= bars)
        fail(`loopBar ${loopBar} outside 0..${bars - 1}`);
    const barSec = stepsPerBar * stepSec;
    const duration = bars * barSec;
    const loopStart = loopBar * barSec;
    const events = CHANNELS.flatMap((c) => channelEvents[c]).sort((a, b) => a.start - b.start || CH_ORDER[a.ch] - CH_ORDER[b.ch]);
    const mix = { pulse1: 1, pulse2: 1, triangle: 1, noise: 1, ...def.mix };
    return {
        id: def.id,
        title: def.title,
        bpm: def.bpm,
        beats: def.beats,
        beatUnit,
        stepsPerBeat,
        stepsPerBar,
        bars,
        stepSec,
        barSec,
        duration,
        loop: def.loop,
        loopStart,
        loopDuration: duration - loopStart,
        vol: def.vol,
        mix,
        key: def.key,
        events,
        channels: channelEvents,
        chords: chordSpans.map((c) => ({ startStep: c.start, endStep: c.end, chord: c.chord })),
    };
}
function tokenize(parts) {
    return parts
        .join(' ')
        .split(/\s+/)
        .filter((t) => t.length > 0);
}
