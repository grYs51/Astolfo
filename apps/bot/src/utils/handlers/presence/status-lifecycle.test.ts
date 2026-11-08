import { user_statuses } from '@prisma/client';
import { Presence } from 'discord.js';
import { client } from '../../../client/instance';
import type { Db } from '../../../db';
import { handleUserPresenceChange } from './handle-presence-changes';
import { closeDanglingStatuses, saveAllStatuses } from './status-save';

jest.mock('../../logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const USER = 'user-1';
const T0 = new Date('2026-11-08T10:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

/** In-memory user_statuses table; `holdCreate()` delays the next insert. */
class FakeStatuses {
  rows = new Map<string, user_statuses>();
  private createHolds: Promise<void>[] = [];

  holdCreate() {
    const d = deferred();
    this.createHolds.push(d.promise);
    return d.resolve;
  }

  create = async ({ data }: { data: user_statuses }) => {
    const held = this.createHolds.shift();
    if (held) await held;
    this.rows.set(data.id, { ...data });
    return data;
  };

  createMany = async ({ data }: { data: user_statuses[] }) => {
    for (const row of data) this.rows.set(row.id, { ...row });
    return { count: data.length };
  };

  private matches(row: user_statuses, where: { id: string | { in: string[] }; ended_at?: null }) {
    const ids = typeof where.id === 'string' ? [where.id] : where.id.in;
    return ids.includes(row.id) && !(where.ended_at === null && row.ended_at !== null);
  }

  updateMany = async ({ where, data }: { where: { id: string | { in: string[] }; ended_at?: null }; data: Partial<user_statuses> }) => {
    let count = 0;
    for (const row of this.rows.values()) {
      if (!this.matches(row, where)) continue;
      Object.assign(row, data);
      count++;
    }
    return { count };
  };

  deleteMany = async ({ where }: { where: { id: string | { in: string[] }; ended_at?: null } }) => {
    let count = 0;
    for (const row of [...this.rows.values()]) {
      if (!this.matches(row, where)) continue;
      this.rows.delete(row.id);
      count++;
    }
    return { count };
  };

  open() {
    return [...this.rows.values()].filter((row) => row.ended_at === null);
  }
}

const presence = (status: string | undefined) =>
  ({ userId: USER, status }) as unknown as Presence;

/** Lets every pending promise chain run (several hops through the queue). */
const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
};

let db: FakeStatuses;
let executeRaw: jest.Mock;

beforeEach(() => {
  db = new FakeStatuses();
  executeRaw = jest.fn().mockResolvedValue(3);
  client.dataSource = {
    userStatus: db,
    metrics: { findFirst: jest.fn().mockResolvedValue({ updated_at: at(-30) }) },
    $executeRaw: executeRaw,
  } as unknown as Db;
  client.userStatus.clear();
});

describe('status lifecycle', () => {
  test('a status change opens a row, the next one closes it', async () => {
    await handleUserPresenceChange(null, presence('online'), T0);
    expect(db.open()).toHaveLength(1);
    expect(db.open()[0]).toMatchObject({ user_id: USER, status: 'online', created_at: T0 });

    await handleUserPresenceChange(presence('online'), presence('idle'), at(600));
    const [online, idle] = [...db.rows.values()];
    expect(online.ended_at).toEqual(at(600));
    expect(idle).toMatchObject({ status: 'idle', ended_at: null });
    expect(client.userStatus.get(USER)?.id).toBe(idle.id);
  });

  test('a status shorter than 15 seconds is deleted, not kept', async () => {
    await handleUserPresenceChange(null, presence('online'), T0);
    await handleUserPresenceChange(presence('online'), presence('idle'), at(5));
    expect([...db.rows.values()].map((row) => row.status)).toEqual(['idle']);
  });

  test('a quick second change waits for the first insert before closing it', async () => {
    const release = db.holdCreate();
    const first = handleUserPresenceChange(null, presence('online'), T0);
    const second = handleUserPresenceChange(presence('online'), presence('dnd'), at(60));
    await flush();
    release();
    await Promise.all([first, second]);

    expect(db.open().map((row) => row.status)).toEqual(['dnd']);
    expect([...db.rows.values()].find((row) => row.status === 'online')?.ended_at).toEqual(at(60));
  });

  test('a repeated event for the same status (one per guild) writes nothing', async () => {
    await handleUserPresenceChange(null, presence('online'), T0);
    await handleUserPresenceChange(presence('idle'), presence('online'), at(60));
    expect(db.rows.size).toBe(1);
  });

  test('shutdown closes open rows and drops the short ones', async () => {
    await handleUserPresenceChange(null, presence('online'), T0);
    client.userStatus.set('user-2', { id: 'short', user_id: 'user-2', status: 'idle', created_at: at(595) });
    db.rows.set('short', { id: 'short', user_id: 'user-2', status: 'idle', created_at: at(595), ended_at: null });

    await saveAllStatuses(at(600));
    expect(db.open()).toHaveLength(0);
    expect(db.rows.has('short')).toBe(false);
    expect([...db.rows.values()][0].ended_at).toEqual(at(600));
    expect(client.userStatus.size).toBe(0);
  });

  test('crash recovery closes open rows at the last metrics snapshot', async () => {
    await expect(closeDanglingStatuses()).resolves.toBe(3);
    const sql = executeRaw.mock.calls[0][0];
    expect(sql.sql).toContain('UPDATE user_statuses');
    expect(sql.values).toEqual([at(-30)]);
  });
});
