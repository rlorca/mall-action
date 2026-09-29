import { MallActionGame } from "./game/game";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const fallback = document.getElementById("fallback-message");

  if (!canvas || !canvas.getContext) {
    if (fallback) fallback.style.display = "block";
    return;
  }

  try {
    const game = new MallActionGame(canvas);
    game.start();
  } catch (err) {
    console.error("Failed to initialize game:", err);
    if (fallback) fallback.style.display = "block";
  }
});
