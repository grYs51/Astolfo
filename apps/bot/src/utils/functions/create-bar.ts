export const createBar = (current: number, max: number, size = 15) => {
  // Ensure values are not negative
  current = Math.max(0, current);
  max = Math.max(0, max);
  size = Math.max(0, size);

  const percentage = max === 0 ? 0 : Math.round((current / max) * 100);
  const bar = Math.round((size * percentage) / 100);
  const empty = size - bar;
  return `${'█'.repeat(bar)}${'░'.repeat(empty)}    ${percentage}%`;
};
