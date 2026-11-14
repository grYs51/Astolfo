import { countdown, memberName, ordinal } from './geoguess-format';

describe('countdown', () => {
  it('shows m:ss, rounding up, and stops at 0:00', () => {
    expect(countdown(90_000, 0)).toBe('1:30');
    expect(countdown(5_001, 0)).toBe('0:06');
    expect(countdown(1_000, 5_000)).toBe('0:00');
  });
});

describe('memberName', () => {
  it('prefers the display name', () => {
    expect(memberName({ id: '1', username: 'astolfo', displayName: 'Astolfo', avatar: null })).toBe('Astolfo');
    expect(memberName({ id: '1', username: 'astolfo', displayName: null, avatar: null })).toBe('astolfo');
  });
});

describe('ordinal', () => {
  it('handles the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st']);
  });
});
