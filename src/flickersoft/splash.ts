export interface SplashState {
  frame: number;
  phase: 'flicker' | 'settle' | 'presents' | 'done';
  done: boolean;
}

export function createSplashState(): SplashState {
  return { frame: 0, phase: 'flicker', done: false };
}

export function updateSplash(state: SplashState, skip: boolean): SplashState {
  if (state.done) return state;

  const next = { ...state, frame: state.frame + 1 };

  if (skip) {
    next.phase = 'done';
    next.done = true;
    return next;
  }

  if (next.frame <= 60) {
    next.phase = 'flicker';
  } else if (next.frame <= 90) {
    next.phase = 'settle';
  } else if (next.frame <= 180) {
    next.phase = 'presents';
  } else {
    next.phase = 'done';
    next.done = true;
  }

  return next;
}

export interface SplashRenderInfo {
  letters: { char: string; visible: boolean; color: string }[];
  showUnderline: boolean;
  showPresents: boolean;
  phase: string;
}

const RAINBOW = ['#FF0000', '#FF7700', '#FFFF00', '#00FF00', '#0088FF', '#4400FF', '#8800FF', '#FF0088', '#FF4400', '#00FFAA'];

export function getSplashRenderInfo(state: SplashState): SplashRenderInfo {
  const text = 'FLICKERSOFT';
  const letters = text.split('').map((char, i) => {
    let visible = true;
    if (state.phase === 'flicker') {
      visible = (state.frame + i) % 2 === 0;
    }
    return {
      char,
      visible,
      color: RAINBOW[i % RAINBOW.length],
    };
  });

  return {
    letters,
    showUnderline: state.phase === 'settle' || state.phase === 'presents',
    showPresents: state.phase === 'presents',
    phase: state.phase,
  };
}
