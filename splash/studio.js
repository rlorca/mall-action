globalThis.Flickersoft = {
  duration: 180,
  visible: (frame, i) => frame >= 60 || (frame + i) % 2 === 0,
  draw(g, t) {
    const { rect, text } = g;
    rect(0, 0, 256, 240, "ink");
    const colors = ["pink", "coral", "gold", "mint", "ice", "lilac"];
    [..."FLICKERSOFT"].forEach((c, i) => {
      if (this.visible(t, i)) text(c, 19 + 20 * i, 103, colors[i % 6], 3);
    });
    if (t >= 60) rect(19, 129, 218, 2, "ice");
    if (t >= 95) text("P R E S E N T S", 128, 144, "cream", 1, "center");
  },
};
