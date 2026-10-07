import { voice_stats } from '@prisma/client';
import { VoiceState } from 'discord.js';
import { client } from '../../../client/instance';
import type { Db } from '../../../db';
import VoiceDurationUpdateEvent from '../../../events/voiceState/voice-state-update';
import { setVc } from '../../functions/set-vc';
import { cancelJob } from '../../schedulers/voice-channel.scheduler';
import { closeGuildVoiceSessions, handleUserJoinedVoiceChannel } from './voice-changes';
import { runSerialized, voiceKey, VOICE_TYPE } from './voice-utils';

jest.mock('../../schedulers/voice-channel.scheduler', () => ({
  schedule5hrVoiceChannelJob: jest.fn(),
  cancelJob: jest.fn(),
}));
jest.mock('../../logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const GUILD = 'guild-1';
const MEMBER = 'member-1';
const OTHER = 'member-2';
const CHANNEL = 'channel-1';
const KEY = voiceKey(GUILD, MEMBER);

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

/** Lets every pending promise chain run (several hops through the queue). */
const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
};

type Op = 'createMany' | 'updateMany';

/**
 * In-memory voice_stats table. `hold(op)` makes the next call of that op wait
 * until the returned release function is called — that's how the tests
 * reproduce a slow DB round trip overlapping another gateway event.
 */
class FakeVoiceStats {
  rows = new Map<string, voice_stats>();
  updateManyCalls = 0;
  private holds: Record<Op, Promise<void>[]> = { createMany: [], updateMany: [] };

  hold(op: Op) {
    const d = deferred();
    this.holds[op].push(d.promise);
    return d.resolve;
  }

  private async gate(op: Op) {
    const held = this.holds[op].shift();
    if (held) await held;
  }

  createMany = async ({ data }: { data: voice_stats[] }) => {
    await this.gate('createMany');
    for (const row of data) this.rows.set(row.id, { ...row });
    return { count: data.length };
  };

  updateMany = async ({
    where,
    data,
  }: {
    where: { id: { in: string[] }; ended_on?: null };
    data: Partial<voice_stats>;
  }) => {
    this.updateManyCalls++;
    await this.gate('updateMany');
    let count = 0;
    for (const id of where.id.in) {
      const row = this.rows.get(id);
      if (!row) continue;
      if (where.ended_on === null && row.ended_on !== null) continue;
      Object.assign(row, data);
      count++;
    }
    return { count };
  };

  open() {
    return [...this.rows.values()].filter((row) => row.ended_on === null);
  }

  ofMember(memberId: string) {
    return [...this.rows.values()].filter((row) => row.member_id === memberId);
  }
}

type StateOptions = { channelId?: string | null; deaf?: boolean; mute?: boolean; memberId?: string };

const state = ({ channelId = null, deaf = false, mute = false, memberId = MEMBER }: StateOptions) =>
  ({
    id: memberId,
    guild: { id: GUILD },
    channelId,
    channel: channelId ? { id: channelId } : null,
    member: { id: memberId },
    deaf,
    mute,
    serverMute: false,
    serverDeaf: false,
    selfVideo: false,
    streaming: false,
  }) as unknown as VoiceState;

const out = state({});
const inChannel = state({ channelId: CHANNEL });
const deafened = state({ channelId: CHANNEL, deaf: true, mute: true });

const handler = new VoiceDurationUpdateEvent();
// event() is protected; the dispatch path under test is exactly this call
const dispatch = (oldState: VoiceState, newState: VoiceState) =>
  (handler as unknown as {
    event: (c: typeof client, o: VoiceState, n: VoiceState) => Promise<void>;
  }).event(client, oldState, newState);

const cachedTypes = (key = KEY) =>
  (client.voiceUsers.get(key) ?? []).map((stat) => stat.type).sort();

let db: FakeVoiceStats;

beforeEach(() => {
  db = new FakeVoiceStats();
  client.dataSource = { voiceStats: db } as unknown as Db;
  client.voiceUsers.clear();
});

describe('voice session lifecycle', () => {
  test('join then leave opens and closes one VOICE row', async () => {
    await dispatch(out, inChannel);
    expect(db.open()).toHaveLength(1);
    expect(cachedTypes()).toEqual([VOICE_TYPE.VOICE]);

    await dispatch(inChannel, out);
    expect(db.rows.size).toBe(1);
    expect(db.open()).toHaveLength(0);
    expect(client.voiceUsers.has(KEY)).toBe(false);
  });

  test('undeafen closes DEAF and MUTED together and keeps VOICE open', async () => {
    await dispatch(out, inChannel);
    await dispatch(inChannel, deafened);
    expect(cachedTypes()).toEqual(
      [VOICE_TYPE.DEAF, VOICE_TYPE.MUTED, VOICE_TYPE.VOICE].sort()
    );

    const callsBefore = db.updateManyCalls;
    await dispatch(deafened, inChannel);

    // One update for both ended types (no concurrent splices on the cache)
    expect(db.updateManyCalls - callsBefore).toBe(1);
    expect(db.open().map((row) => row.type)).toEqual([VOICE_TYPE.VOICE]);
    expect(cachedTypes()).toEqual([VOICE_TYPE.VOICE]);
  });

  test('leave + quick rejoin while the leave update is slow keeps the new session', async () => {
    await dispatch(out, inChannel);
    const [first] = db.open();

    const releaseLeave = db.hold('updateMany');
    const leaving = dispatch(inChannel, out);
    const rejoining = dispatch(out, inChannel);
    await flush();

    // The rejoin waits for the leave instead of interleaving with it
    expect(db.rows.size).toBe(1);

    releaseLeave();
    await Promise.all([leaving, rejoining]);

    expect(db.rows.get(first.id)?.ended_on).not.toBeNull();
    const open = db.open();
    expect(open).toHaveLength(1);
    expect(open[0].id).not.toBe(first.id);
    // Before serialization the leave's cache delete wiped this entry, so the
    // new row stayed open forever
    expect(client.voiceUsers.get(KEY)?.map((stat) => stat.id)).toEqual([open[0].id]);
  });

  test('leave during a slow join insert still closes the session', async () => {
    const releaseJoin = db.hold('createMany');
    const joining = dispatch(out, inChannel);
    const leaving = dispatch(inChannel, out);
    await flush();

    releaseJoin();
    await Promise.all([joining, leaving]);

    expect(db.rows.size).toBe(1);
    expect(db.open()).toHaveLength(0);
    expect(client.voiceUsers.has(KEY)).toBe(false);
  });

  test('a join with stale cache entries closes them without overwriting end times', async () => {
    const closedAt = new Date('2026-10-01T10:00:00Z');
    const stale: voice_stats = {
      id: 'stale',
      guild_id: GUILD,
      channel_id: CHANNEL,
      member_id: MEMBER,
      issued_on: new Date('2026-10-01T09:00:00Z'),
      ended_on: closedAt,
      type: VOICE_TYPE.VOICE,
    };
    db.rows.set(stale.id, { ...stale });
    client.voiceUsers.set(KEY, [{ ...stale, ended_on: null }]);

    await handleUserJoinedVoiceChannel(inChannel, new Date('2026-10-01T15:00:00Z'));

    // Already closed in the DB: ended_on: null guard leaves it alone
    expect(db.rows.get('stale')?.ended_on).toEqual(closedAt);
    // Cache holds only the new session (not appended to the stale one)
    const cached = client.voiceUsers.get(KEY) ?? [];
    expect(cached).toHaveLength(1);
    expect(cached[0].id).not.toBe('stale');
  });
});

describe('closeGuildVoiceSessions (bot removed from a guild)', () => {
  test("closes only that guild's sessions and cancels their reminder jobs", async () => {
    await dispatch(out, inChannel);
    await dispatch(state({ memberId: OTHER }), state({ channelId: CHANNEL, memberId: OTHER }));
    const otherGuildRow: voice_stats = {
      id: 'elsewhere',
      guild_id: 'guild-2',
      channel_id: 'channel-9',
      member_id: MEMBER,
      issued_on: new Date(),
      ended_on: null,
      type: VOICE_TYPE.VOICE,
    };
    db.rows.set(otherGuildRow.id, { ...otherGuildRow });
    client.voiceUsers.set(voiceKey('guild-2', MEMBER), [otherGuildRow]);

    const closed = await closeGuildVoiceSessions(GUILD, new Date());

    expect(closed).toBe(2);
    expect(db.open().map((row) => row.id)).toEqual(['elsewhere']);
    expect([...client.voiceUsers.keys()]).toEqual([voiceKey('guild-2', MEMBER)]);
    expect(cancelJob).toHaveBeenCalledWith(GUILD, MEMBER);
    expect(cancelJob).toHaveBeenCalledWith(GUILD, OTHER);
  });
});

describe('setVc (startup)', () => {
  const voiceChannel = (members: string[]) => ({
    id: CHANNEL,
    guild: { id: GUILD },
    isVoiceBased: () => true,
    members: new Map(
      members.map((id) => [
        id,
        {
          id,
          voice: { deaf: false, mute: false, serverMute: false, serverDeaf: false, selfVideo: false, streaming: false },
        },
      ])
    ),
  });

  beforeEach(() => {
    Object.defineProperty(client, 'channels', {
      configurable: true,
      value: { cache: new Map([[CHANNEL, voiceChannel([MEMBER, OTHER])]]) },
    });
  });

  test('opens a session for everyone in voice', async () => {
    await setVc();
    expect(db.ofMember(MEMBER)).toHaveLength(1);
    expect(db.ofMember(OTHER)).toHaveLength(1);
    expect(client.voiceUsers.size).toBe(2);
  });

  test('skips a member whose replayed join event is still being saved', async () => {
    const releaseJoin = db.hold('createMany');
    const joining = dispatch(out, inChannel);
    const starting = setVc();
    await flush();

    releaseJoin();
    await Promise.all([joining, starting]);

    // One session for MEMBER, not two (would double-count the time)
    expect(db.ofMember(MEMBER)).toHaveLength(1);
    expect(db.ofMember(OTHER)).toHaveLength(1);
    expect(client.voiceUsers.get(KEY)).toHaveLength(1);
  });
});

describe('runSerialized', () => {
  test('runs tasks for one key in order and a failure does not block the next', async () => {
    const order: string[] = [];
    const gate = deferred();

    const first = runSerialized('k', async () => {
      await gate.promise;
      order.push('first');
      throw new Error('boom');
    });
    const second = runSerialized('k', async () => {
      order.push('second');
    });
    const otherKey = runSerialized('other', async () => {
      order.push('other');
    });

    await otherKey;
    expect(order).toEqual(['other']);

    gate.resolve();
    await expect(first).rejects.toThrow('boom');
    await second;
    expect(order).toEqual(['other', 'first', 'second']);
  });
});
