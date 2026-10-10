import { hiddenMemberIds, isHiddenFrom } from './privacy';

const ME = 'me';
const HIDDEN = 'hidden-member';
const VISIBLE = 'visible-member';

/** user_configs with one member who hides from others */
const db = {
  userConfigs: {
    findFirst: jest.fn(async ({ where }: { where: { user_id: string; privacy_hidden: boolean } }) =>
      where.user_id === HIDDEN && where.privacy_hidden ? { user_id: HIDDEN } : null
    ),
    findMany: jest.fn(async () => [{ user_id: HIDDEN }]),
  },
} as never;

describe('member privacy', () => {
  test('a hidden member is hidden from other members', async () => {
    expect(await isHiddenFrom(db, HIDDEN, ME)).toBe(true);
  });

  test('a visible member is not hidden', async () => {
    expect(await isHiddenFrom(db, VISIBLE, ME)).toBe(false);
  });

  test('members always see themselves, even when hidden', async () => {
    expect(await isHiddenFrom(db, HIDDEN, HIDDEN)).toBe(false);
  });

  test('hiddenMemberIds lists everyone who hides', async () => {
    expect([...(await hiddenMemberIds(db))]).toEqual([HIDDEN]);
  });
});
