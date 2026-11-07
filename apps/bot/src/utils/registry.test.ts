import path from 'path';
import { registerInteractions } from './registry';

// The build emits no folder for a handler type with no files (interactions/
// today); startup must not crash on it
test('a missing handler folder registers nothing instead of throwing', async () => {
  await expect(
    registerInteractions(path.join(__dirname, 'does-not-exist'))
  ).resolves.toBeUndefined();
});
