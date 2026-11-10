import type { XpRules, XpSegment } from '@nx-stolfo/api-interfaces';

/**
 * Voice XP, worked out minute by minute over a closed VOICE session: a step line that moves whenever
 * someone joins or leaves, the member (un)deafens, turns the camera or screen share on or off, or has
 * stayed another `stayEveryMin`. Summed and floored once at the end, so fractional minutes add up.
 * Pure: times are ms since epoch.
 */

export interface Interval {
  from: number;
  to: number;
}

export interface Session extends Interval {
  id: string;
  channelId: string;
}

/** Another member's time in the channel, deafened stretches already cut out, bots already removed */
export interface OtherPiece extends Interval {
  memberId: string;
  /** The VOICE row it came from */
  sessionId: string;
}

export interface VoiceInput {
  session: Session;
  ownDeaf: Interval[];
  ownVideo: Interval[];
  ownStreaming: Interval[];
  /** When the member's unbroken time in voice began (see stayStarts) */
  stayStart: number;
  others: OtherPiece[];
  channelName?: string;
}

const MINUTE = 60_000;
/** A gap this short (a reconnect) doesn't break a stay */
const STAY_GAP_MS = 60_000;

const covers = (intervals: Interval[], at: number) => intervals.some((i) => i.from <= at && at < i.to);
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

export const crowdFactor = (others: number, voice: XpRules['voice']) =>
  others === 0 ? voice.alone : Math.min(voice.crowdCap, voice.oneOther + voice.perExtra * (others - 1));

export const stayFactor = (stayedMs: number, voice: XpRules['voice']) =>
  Math.min(voice.stayCap, 1 + voice.stayStep * Math.floor(stayedMs / (voice.stayEveryMin * MINUTE)));

/** Shared time between the session and someone's pieces */
export const togetherMs = (session: Interval, pieces: Interval[]) =>
  pieces.reduce((sum, p) => sum + Math.max(0, Math.min(session.to, p.to) - Math.max(session.from, p.from)), 0);

/**
 * When each session's unbroken stay began: a channel move (one session ending as the next starts)
 * or a gap of up to a minute carries it on. `sessions` are one member's, in any order.
 */
export const stayStarts = (sessions: Session[]) => {
  const starts = new Map<string, number>();
  let prev: Session | undefined;
  for (const s of [...sessions].sort((a, b) => a.from - b.from)) {
    const start = prev && prev.to >= s.from - STAY_GAP_MS ? (starts.get(prev.id) as number) : s.from;
    starts.set(s.id, start);
    if (!prev || s.to > prev.to) prev = s;
  }
  return starts;
};

const minutes = (ms: number) => Math.round(ms / MINUTE);
const others = (n: number) => (n === 1 ? '1 other' : `${n} others`);

export const voiceXp = (input: VoiceInput, rules: XpRules) => {
  const { session, ownDeaf, ownVideo, ownStreaming, stayStart } = input;
  const { voice } = rules;
  const inSession = input.others.filter((p) => p.to > session.from && p.from < session.to);

  const edges = new Set([session.from, session.to]);
  const addEdges = (list: Interval[]) =>
    list.forEach(({ from, to }) => [from, to].forEach((t) => t > session.from && t < session.to && edges.add(t)));
  [inSession, ownDeaf, ownVideo, ownStreaming].forEach(addEdges);
  const stayEvery = voice.stayEveryMin * MINUTE;
  if (voice.stayStep > 0) {
    const steps = Math.ceil((voice.stayCap - 1) / voice.stayStep);
    for (let k = 1; k <= steps; k++) {
      const t = stayStart + k * stayEvery;
      if (t > session.from && t < session.to) edges.add(t);
    }
  }
  const times = [...edges].sort((a, b) => a - b);

  const segments: XpSegment[] = [];
  let xp = 0;
  const byCrowd = new Map<number, number>();
  let deafMs = 0;
  let cameraMs = 0;
  let streamingMs = 0;
  let maxStay = 1;

  for (let i = 0; i < times.length - 1; i++) {
    const [from, to] = [times[i], times[i + 1]];
    const memberIds = [...new Set(inSession.filter((p) => p.from <= from && from < p.to).map((p) => p.memberId))].sort();
    const deaf = covers(ownDeaf, from);
    const camera = covers(ownVideo, from);
    const streaming = covers(ownStreaming, from);
    const stay = round4(stayFactor(from - stayStart, voice));
    const media = 1 + (camera ? voice.camera : 0) + (streaming && memberIds.length > 0 ? voice.screenShare : 0);
    const multiplier = round4(crowdFactor(memberIds.length, voice) * (deaf ? voice.deafened : 1) * stay * media);
    xp += (rules.amounts.voiceMinute * multiplier * (to - from)) / MINUTE;

    const ms = to - from;
    if (deaf) deafMs += ms;
    else byCrowd.set(memberIds.length, (byCrowd.get(memberIds.length) ?? 0) + ms);
    if (camera) cameraMs += ms;
    if (streaming) streamingMs += ms;
    maxStay = Math.max(maxStay, stay);

    const last = segments[segments.length - 1];
    const same =
      last &&
      last.deaf === deaf &&
      last.stay === stay &&
      last.camera === camera &&
      last.streaming === streaming &&
      last.multiplier === multiplier &&
      last.memberIds.join() === memberIds.join();
    if (same) last.to = to;
    else segments.push({ from, to, memberIds, deaf, stay, camera, streaming, multiplier });
  }

  const parts = [...byCrowd.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, ms]) => minutes(ms) > 0)
    .map(([n, ms]) => `${minutes(ms)} min ${n === 0 ? 'alone' : `with ${others(n)}`}`);
  if (minutes(deafMs) > 0) parts.push(`${minutes(deafMs)} min deafened`);
  const extras = [
    minutes(cameraMs) > 0 && `camera ${minutes(cameraMs)} min`,
    minutes(streamingMs) > 0 && `screen share ${minutes(streamingMs)} min`,
    maxStay > 1 && `up to ${maxStay}× for staying`,
  ].filter(Boolean);
  const where = `#${input.channelName ?? 'voice'}`;
  const note = [`${minutes(session.to - session.from)} min in ${where}${parts.length ? `: ${parts.join(', ')}` : ''}`, ...extras].join(
    ' · '
  );

  // The tiny epsilon keeps 69.99999 from flooring to 69
  return { amount: Math.floor(xp + 1e-9), note, segments };
};

/**
 * Sessions that started a call: nobody else was in the channel when the member joined, and someone
 * spent `togetherMin` with them in it. At most `startersPerDay` per UTC day, in start order, counting
 * `taken` (starter bonuses already granted that day). Returns each with its number for the day.
 */
export const starterSessions = (
  sessions: Session[],
  othersByChannel: Map<string, OtherPiece[]>,
  rules: XpRules,
  taken: Map<string, number> = new Map()
) => {
  const counts = new Map(taken);
  const result: { session: Session; day: string; n: number }[] = [];
  for (const session of [...sessions].sort((a, b) => a.from - b.from)) {
    const others = othersByChannel.get(session.channelId) ?? [];
    if (covers(others, session.from)) continue;
    const byMember = new Map<string, OtherPiece[]>();
    others.forEach((p) => byMember.set(p.memberId, [...(byMember.get(p.memberId) ?? []), p]));
    const together = [...byMember.values()].some((pieces) => togetherMs(session, pieces) >= rules.thresholds.togetherMin * MINUTE);
    if (!together) continue;
    const day = new Date(session.from).toISOString().slice(0, 10);
    const n = (counts.get(day) ?? 0) + 1;
    if (n > rules.thresholds.startersPerDay) continue;
    counts.set(day, n);
    result.push({ session, day, n });
  }
  return result;
};
