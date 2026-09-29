// Procedural pixel art generation

export interface Sprite {
  width: number;
  height: number;
  pixels: Uint8Array; // palette indices
}

export class Art {
  static playerWalk(): Sprite {
    const width = 16;
    const height = 24;
    const pixels = new Uint8Array(width * height);

    // Simple red trench coat figure
    // Head (top section)
    for (let y = 0; y < 6; y++) {
      for (let x = 4; x < 12; x++) {
        pixels[y * width + x] = 2; // red
      }
    }

    // Body (trench coat)
    for (let y = 6; y < 20; y++) {
      for (let x = 2; x < 14; x++) {
        pixels[y * width + x] = 2; // red
      }
    }

    // Legs
    for (let y = 20; y < 24; y++) {
      for (let x = 4; x < 12; x++) {
        pixels[y * width + x] = 1; // white
      }
    }

    return { width, height, pixels };
  }

  static spyStanding(): Sprite {
    const width = 16;
    const height = 24;
    const pixels = new Uint8Array(width * height);

    // Head with hat
    for (let y = 0; y < 8; y++) {
      for (let x = 3; x < 13; x++) {
        pixels[y * width + x] = 8; // gray (hat/head)
      }
    }

    // Black suit body
    for (let y = 8; y < 20; y++) {
      for (let x = 2; x < 14; x++) {
        pixels[y * width + x] = 0; // black
      }
    }

    // Legs
    for (let y = 20; y < 24; y++) {
      for (let x = 4; x < 12; x++) {
        pixels[y * width + x] = 0; // black
      }
    }

    return { width, height, pixels };
  }

  static bullet(): Sprite {
    const width = 4;
    const height = 4;
    const pixels = new Uint8Array(width * height);

    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = 5; // yellow
    }

    return { width, height, pixels };
  }

  static package(): Sprite {
    const width = 8;
    const height = 8;
    const pixels = new Uint8Array(width * height);

    // Brown box
    for (let y = 1; y < 7; y++) {
      for (let x = 1; x < 7; x++) {
        pixels[y * width + x] = 14; // olive/brown
      }
    }

    // Red ribbon
    for (let x = 3; x < 5; x++) {
      pixels[4 * width + x] = 2; // red
    }

    return { width, height, pixels };
  }

  static powerUpRapidFire(): Sprite {
    const width = 8;
    const height = 8;
    const pixels = new Uint8Array(width * height);

    // Orange circle
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const dist = Math.sqrt((x - 4) * (x - 4) + (y - 4) * (y - 4));
        if (dist < 3.5) pixels[y * width + x] = 9; // orange
      }
    }

    return { width, height, pixels };
  }

  static elevator(): Sprite {
    const width = 32;
    const height = 48;
    const pixels = new Uint8Array(width * height);

    // Metal box
    for (let y = 4; y < 44; y++) {
      for (let x = 4; x < 28; x++) {
        pixels[y * width + x] = 8; // gray
      }
    }

    // Door
    for (let y = 8; y < 40; y++) {
      for (let x = 8; x < 24; x++) {
        pixels[y * width + x] = 0; // black door
      }
    }

    return { width, height, pixels };
  }

  static tile(pattern: string): Sprite {
    const width = 16;
    const height = 16;
    const pixels = new Uint8Array(width * height);

    // Fill with color based on pattern
    let color = 8; // default gray
    if (pattern === 'floor') color = 14;
    if (pattern === 'wall') color = 8;
    if (pattern === 'carpet') color = 10;

    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = color;
    }

    // Add some simple texture
    for (let i = 0; i < pixels.length; i += 3) {
      pixels[i] = (pixels[i] + 1) % 16;
    }

    return { width, height, pixels };
  }

  static renderToCanvas(
    ctx: CanvasRenderingContext2D,
    sprite: Sprite,
    x: number,
    y: number,
    palette: string[],
    scale: number = 1
  ) {
    const imageData = ctx.createImageData(sprite.width * scale, sprite.height * scale);
    const data = imageData.data;

    for (let py = 0; py < sprite.height; py++) {
      for (let px = 0; px < sprite.width; px++) {
        const colorIdx = sprite.pixels[py * sprite.width + px];
        const color = palette[colorIdx % palette.length];
        const rgb = this.hexToRgb(color);

        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const idx = ((py * scale + dy) * sprite.width * scale + (px * scale + dx)) * 4;
            data[idx] = rgb[0];
            data[idx + 1] = rgb[1];
            data[idx + 2] = rgb[2];
            data[idx + 3] = colorIdx === 0 ? 0 : 255; // Transparent black
          }
        }
      }
    }

    ctx.putImageData(imageData, x, y);
  }

  private static hexToRgb(hex: string): [number, number, number] {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return [0, 0, 0];
    return [
      parseInt(match[1], 16),
      parseInt(match[2], 16),
      parseInt(match[3], 16),
    ];
  }
}
