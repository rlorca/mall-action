import { createInitialState, step } from './rules';
import { InputHandler } from './input';
import { Renderer } from './render';
import { GameState } from './types';

// Get parameters from URL
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    seed: params.has('seed') ? parseInt(params.get('seed')!) : Math.random() * 1000000 | 0,
    debug: params.has('debug'),
    gallery: params.has('gallery'),
  };
}

function main() {
  const params = getUrlParams();
  const container = document.getElementById('game-container');

  if (!container) {
    console.error('Could not find game container');
    return;
  }

  const renderer = new Renderer(container);
  const inputHandler = new InputHandler();

  let gameState: GameState = createInitialState(params.seed);

  // Expose debug functions to window if debug mode
  if (params.debug) {
    (window as any).gameContext = {
      getState: () => gameState,
      step: (frames: number = 1, buttons: string[] = []) => {
        for (let i = 0; i < frames; i++) {
          const input = inputHandler.getInput();
          buttons.forEach(btn => input.pressed.add(btn as any));
          gameState = step(gameState, input);
        }
        renderer.render(gameState);
      }
    };
  }

  // Game loop
  let accumulator = 0;
  const FRAME_TIME = 1000 / 60; // 60 Hz

  function gameLoop(timestamp: number) {
    if (gameState.frame === 0) {
      accumulator = timestamp;
    }

    const delta = timestamp - accumulator;
    accumulator = timestamp;

    let stepped = 0;
    const maxSteps = 5; // Prevent catch-up spiral

    while (stepped < maxSteps && delta >= FRAME_TIME) {
      const input = inputHandler.getInput();
      gameState = step(gameState, input);
      stepped++;
    }

    renderer.render(gameState);
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

// Start game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
