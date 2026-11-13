import path from 'path';
import { registerCommands } from './registry';

// The build emits no folder for a handler type with no files; startup must
// not crash on it
test('a missing handler folder registers nothing instead of throwing', async () => {
  await expect(
    registerCommands(path.join(__dirname, 'does-not-exist'))
  ).resolves.toBeUndefined();
});
