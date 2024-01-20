export const createBar = (current: number, max: number, size = 15) => {
  const percentage = Math.round((current / max) * 100);
  const bar = Math.round((size * percentage) / 100);
  const empty = size - bar;
  return `[${'='.repeat(bar)}${' '.repeat(empty)}] ${percentage}%`;
};
