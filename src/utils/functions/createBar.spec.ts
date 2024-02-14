import { createBar } from './createBar';

describe('createBar', () => {
  test('should return a bar with 50% completion', () => {
    const current = 50;
    const max = 100;
    const size = 15;
    const expected = '[========       ] 50%';
    const result = createBar(current, max, size);
    expect(result).toBe(expected);
  });

  test('should return a bar with 100% completion', () => {
    const current = 100;
    const max = 100;
    const size = 15;
    const expected = '[===============] 100%';
    const result = createBar(current, max, size);
    expect(result).toBe(expected);
  });

  test('should return a bar with 0% completion', () => {
    const current = 0;
    const max = 100;
    const size = 15;
    const expected = '[               ] 0%';
    const result = createBar(current, max, size);
    expect(result).toBe(expected);
  });

  test('should return a bar only 10 characters long', () => {
    const current = 50;
    const max = 100;
    const size = 10;
    const expected = '[=====     ] 50%';
    const result = createBar(current, max, size);
    expect(result).toBe(expected);
  });
});
