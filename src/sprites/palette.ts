export const NES_PALETTE: string[] = [
  // Row 0: darks
  '#666666', '#002A88', '#1412A7', '#3B00A4', '#5C007E', '#6E0040', '#6C0600', '#561D00',
  '#333500', '#0B4800', '#005200', '#004F08', '#00404D', '#000000', '#000000', '#000000',
  // Row 1: mediums
  '#ADADAD', '#155FD9', '#4240FF', '#7527FE', '#A01ACC', '#B71E7B', '#B53120', '#994E00',
  '#6B6D00', '#388700', '#0C9300', '#008F32', '#007C8D', '#000000', '#000000', '#000000',
  // Row 2: brights
  '#FFFEFF', '#64B0FF', '#9290FF', '#C676FF', '#F36AFF', '#FE6ECC', '#FE8170', '#EA9E22',
  '#BCBE00', '#88D800', '#5CE430', '#45E082', '#48CDDE', '#4F4F4F', '#000000', '#000000',
  // Row 3: pastels
  '#FFFEFF', '#C0DFFF', '#D3D2FF', '#E8C8FF', '#FBC2FF', '#FEC4EA', '#FECCC5', '#F7D8A5',
  '#E4E594', '#CFEF96', '#BDF4AB', '#B9F2CE', '#B5EBF2', '#B8B8B8', '#000000', '#000000',
];

export function colorToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function createSubPalette(indices: number[]): string[] {
  return indices.slice(0, 4).map(i => NES_PALETTE[i] || '#000000');
}
