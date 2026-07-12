---
name: add-bot-feature
description: Add a Discord bot capability — prefix command, event handler, slash command, or interaction (modal/component). USE WHEN working in apps/bot/src/{commands,events,slashs,interactions} or when asked to make the bot react to something on Discord.
---

# Adding a Bot Feature (command / event / slash / interaction)

Registration is automatic: `apps/bot/src/utils/registry.ts` recursively scans the four folders at startup and instantiates every file's default export. **No manual registration list** — the file's location determines its kind.

| Kind | Folder | Base class | Triggered by |
| --- | --- | --- | --- |
| Prefix command | `apps/bot/src/commands/<category>/` | `BaseCommand` | `<prefix><name>` in chat (prefix from guild config, default `,`) |
| Event handler | `apps/bot/src/events/<category>/` | `BaseEvent` | discord.js gateway event (constructor takes `Events.X`) |
| Slash command | `apps/bot/src/slashs/<category>/` | `BaseSlash` | Application command via `interaction-create.ts` |
| Interaction | `apps/bot/src/interactions/<kind>/` | `BaseInteraction` | Modal submit / message component, matched by `customId` |

Base classes live in `apps/bot/src/utils/structures/`. Each `run()` wrapper also increments the matching prom-client counter (`api/utils.ts/counter.ts`) — you get metrics for free.

## Recipes

**Event** (see `events/message/message-create.ts` as template):

```ts
import { Events, Message } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';

export default class MyEvent extends BaseEvent {
  constructor() { super(Events.MessageCreate); }
  async event(client: DiscordClient, message: Message) { /* ... */ }
}
```

**Slash command**: extend `BaseSlash` (see `slashs/bot/ping.ts` / `slashs/guild/leaderboard.ts`). New slash commands must also be **deployed to Discord** — the owner runs the `update-slash-commands` mod command; there is no automatic deploy on boot.

**Prefix command**: extend `BaseCommand`; name + aliases are registered in the commands Collection. Dispatch happens in `utils/handlers/message/run-command.ts`.

**Interaction**: the Collection key is the interaction `customId` (see `interactions/modal/modal-submit.ts`). Buttons are explicitly ignored in `events/slashs/interaction-create.ts`.

## Shared state & helpers

- Global client instance: `import { client } from '../..'` (relative to file depth). Client carries `guildConfigs`, `userConfigs`, `userStatus`, `voiceUsers` caches and `dataSource` (Db facade — see `apps/bot/src/db/index.ts`).
- Guild config toggles are a **bitfield**: use `isEnabled/enableFeature/disableFeature` from `utils/handlers/settings-handler.ts`; add new flags to `SETTING_FLAGS` as the next `1 << n`.
- Voice-session cache key is `` `${guildId}:${memberId}` `` (helper `voiceKey` in `utils/handlers/vc/voice-db.ts`).
- Scheduled jobs: `node-schedule` via `utils/schedulers/` (see `voice-channel.scheduler.ts` for the cancel-by-key pattern).
- Logging: `Logger` from `utils/logger.ts` only — never `console.*`.

## Gotchas

- `BaseEvent.run()` does **not** catch errors from your handler (CODE_REVIEW.md §4.1) — wrap risky async work in try/catch yourself and log with context.
- If the bot must persist something at shutdown, hook it into `utils/handlers/shutdown-handler.ts` — anything only in memory dies with the process.
- New intents must be added to the `IntentsBitField` list in `apps/bot/src/index.ts` (and enabled in the Discord developer portal if privileged).
