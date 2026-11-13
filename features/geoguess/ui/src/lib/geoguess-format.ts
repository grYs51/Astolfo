import type { DiscordMember } from '@nx-stolfo/api-interfaces';

export interface LatLon {
  lat: number;
  lon: number;
}

/** Time left as m:ss, never below zero */
export const countdown = (endsAt: number, now: number) => {
  const s = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const memberName = (m: DiscordMember) => m.displayName ?? m.username;

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st */
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
