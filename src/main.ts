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
  try {
    console.log('[MALL ACTION] Starting...');
    const params = getUrlParams();
    console.log('[MALL ACTION] Params:', params);

    const container = document.getElementById('game-container');
    if (!container) {
      console.error('[MALL ACTION] No container found!');
      return;
    }
    console.log('[MALL ACTION] Container found');

    console.log('[MALL ACTION] Creating Renderer...');
    const renderer = new Renderer(container);
    console.log('[MALL ACTION] Renderer created');

    console.log('[MALL ACTION] Creating InputHandler...');
    const inputHandler = new InputHandler();
    console.log('[MALL ACTION] InputHandler created');

    console.log('[MALL ACTION] Creating initial state...');
    let gameState: GameState = createInitialState(params.seed);
    console.log('[MALL ACTION] State created, screen:', gameState.screen);

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
      try {
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
      } catch (error) {
        console.error('[MALL ACTION] Game loop error:', error);
        console.error(error instanceof Error ? error.stack : 'Unknown error');
      }
      requestAnimationFrame(gameLoop);
    }

    console.log('[MALL ACTION] Starting game loop...');
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error('[MALL ACTION] Fatal error in main():', error);
    console.error(error instanceof Error ? error.stack : 'Unknown error');
    document.body.innerHTML = `<pre style="color:red;font-family:monospace;white-space:pre-wrap">[MALL ACTION] Error:\n${error}</pre>`;
  }
}

// Start game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
