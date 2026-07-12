# Feature Ideas

Companion to [CODE_REVIEW.md](CODE_REVIEW.md) and [SCALABILITY_AND_MAINTAINABILITY.md](SCALABILITY_AND_MAINTAINABILITY.md).

The app's identity: **a Discord companion that turns server activity into insight** — voice tracking with a polished analytics dashboard. The best feature ideas either (a) surface data you *already collect but never show*, (b) close the loop from insight back into Discord, or (c) add the social/fun layer that makes people *want* to check the dashboard.

Effort scale: 🟢 small (days) · 🟡 medium (1–2 weeks) · 🔴 large (multi-week / architectural).

---

## 1. Free wins — data you already collect but never display

These are the highest ROI on the list: the pipeline exists, only the presentation is missing.

### 1.1 Message activity dashboard 🟢
`message_stats` records every message (guild, channel, user, timestamp) and the dashboard shows none of it. Mirror the voice-stats pages: messages-per-day timeline, most active text channels, top chatters, hour×day heatmap. Most of the backend is copy-adapting the existing SQL aggregations, and the frontend components (timeline, heatmap, leaderboard) already exist and are reusable.

### 1.2 Online-time / status analytics 🟢
`user_statuses` tracks every online/idle/dnd/offline transition with durations. Nothing consumes it. Ideas: "server pulse" chart (how many members online over time), personal online-time profile, "night owls vs early birds" breakdown per server.

### 1.3 Rich voice-type breakdowns 🟡
You track MUTED, DEAF, VIDEO, STREAMING sessions alongside VOICE, but the dashboard only shows an aggregate type-percentage widget. Interesting cuts:
- **Camera/streaming leaderboard** — who streams or has video on the most.
- **"Actually listening" score** — voice time minus deafened time, per user (the bot-side active leaderboard already computes this; the dashboard doesn't have it).
- **Lurker index** — ratio of muted time to voice time.

### 1.4 Game stats page 🟢
`game_result` / `game_player` store every rock-paper-scissors match including moves, but there's no stats surface. Win/loss/tie records, head-to-head grids, "favorite move" (and the fun stat: what move beats this player most often). Doing this makes adding future games worthwhile.

### 1.5 The `user_activities` table 🟡
The schema has a `user_activities` table (activity + start/end) that appears completely unused — no writer, no reader. Presence updates already flow through the bot, and discord.js exposes activities (games being played, Spotify). Wire it up and you unlock: "most played games this month" per server, "who else plays X", listening-party detection. If you *don't* want this, delete the table — unused schema invites confusion.

---

## 2. Social & insight features — the dashboard's killer content

### 2.1 Voice social graph — "who hangs out with whom" 🟡
You have everything needed: overlapping `voice_stats` intervals in the same channel = time spent together. Compute pairwise co-presence and render:
- A **force-directed graph** of the server's friend clusters (ECharts `graph` type — the charting stack is already there).
- Per-user "**duo stats**": most-shared-VC partner, total hours together.
- "**Bridge members**" — people connecting otherwise-separate friend groups.

This is the feature people screenshot and share. Nothing else in the app has this virality potential.

### 2.2 "Server Wrapped" — yearly/monthly recap 🟡
Spotify-Wrapped-style story page per user per server: total hours, longest session, favorite channel, top duo, peak month, percentile rank ("you were in the top 4% of voice users"). Historical data is already sitting in Postgres. Generate a shareable image/card for Discord posting. Seasonal, high-retention, and largely composed of queries you already have.

### 2.3 Streaks & milestones 🟢
Consecutive-day voice streaks, lifetime-hours milestones (10h/100h/1000h), "first time in months" detection. Cheap SQL, big engagement. Pairs naturally with §3.1 announcements and §3.2 role rewards.

### 2.4 Best-time-to-schedule recommender 🟢
The heatmap data already answers "when is this server most active" — turn it into an explicit feature: pick the N members you want (or a role), and the app suggests the best weekly slot based on their historical presence. Server admins planning events will love it, and it's mostly a re-aggregation of existing heatmap queries filtered by member set.

### 2.5 Server health trends 🟡
For admins: week-over-week trends in active users, new-vs-returning voice participants, churn ("members who were active last month but silent this month"). One rollup query per metric, displayed with the existing timeline component.

---

## 3. Closing the loop — insight back into Discord

The dashboard is pull; these push, which is what keeps a bot visible in a server.

### 3.1 Weekly digest post 🟢
A scheduled job (node-schedule is already in place) that posts a summary embed to a configured channel: top 3 voice users, total server hours, biggest gainer, current streak leaders. One new guild-config toggle (`SETTING_FLAGS` bitfield is built for exactly this) + one embed builder. This single feature markets the dashboard inside every server, every week.

### 3.2 Voice-activity role rewards 🟡
Auto-assign roles at configurable hour thresholds ("Regular" at 50h, "No-Lifer" at 500h). Config lives in the dashboard (see §4.1), the bot enforces on a schedule. This is one of the most-requested features in activity-bot ecosystems, and it drives users to check their progress on your dashboard.

### 3.3 Personal stats slash command 🟢
`/stats [user]` replying with an embed of the user's voice profile — hours, rank, favorite channel, streak — plus a link to their dashboard page. The queries all exist in the API handlers; refactor them into shared functions (CODE_REVIEW §2.2 helps here) and the command is thin.

### 3.4 Smarter session reminders 🟢
Generalize the hardcoded 5-hour reminder: per-guild configurable threshold, optional DM instead of channel ping, and a "you've been deafened for 2 hours, are you AFK?" variant. The scheduler infrastructure already exists.

### 3.5 Temporary voice channels ("join to create") 🔴
Classic bot feature: join a hub channel → bot creates a personal channel, deletes it when empty. It's a departure from analytics into utility, but it *generates* the voice activity you track, and servers that install a bot for temp channels stay for the stats. Needs careful permission handling — larger lift.

---

## 4. Dashboard platform features

### 4.1 Guild settings page 🟡
Settings currently change via chat commands (`set-prefix`, `set-welcomechannel`, toggle flags). A dashboard settings page — prefix, welcome/goodbye messages, feature toggles, reminder thresholds, digest channel — is table stakes for a bot with a web app. Requires proper authorization (verify the user has "Manage Server" on the guild via their OAuth token, not just membership), which is worth building carefully because every admin feature after this reuses it.

### 4.2 Live "now" view 🟡
Who's in which voice channel *right now*, session durations ticking live. The data is in `client.voiceUsers` already. A simple polling endpoint gets you 90% of it; SSE/WebSocket makes it feel magical. (If you adopt persist-on-open from SCALABILITY §1.1, this becomes a plain DB query.)

### 4.3 Compare view 🟢
Pick two members (or two channels, or two time periods) and see stats side by side. Almost entirely frontend work over existing endpoints — the user-stats endpoint already returns everything needed.

### 4.4 Data export & public pages 🟢
- CSV/JSON export of your own stats (also good GDPR hygiene — see §6.2).
- Optional public read-only server stats page (admin-toggleable) — shareable link for community sites.

---

## 5. Gamification layer 🔴

If you want to go full engagement loop: XP from voice minutes + messages, levels, seasonal leaderboards that reset monthly with end-of-season awards, badges for achievements (streaks, milestones, "night owl", "channel hopper"). This is a big system (new tables, balancing, anti-idle-farming rules like ignoring muted-alone-in-channel time — which you can already detect from your voice types!) but it's the proven retention model of MEE6/Arcane-style bots, and your data quality is better than theirs.

Anti-farm note: you're uniquely positioned here — most XP bots can't tell AFK-in-channel from real activity. You track mute/deafen/alone states, so your XP can require *actual participation*. That's a genuine differentiator worth marketing.

---

## 6. Foundation features that unlock the rest

### 6.1 Notification preferences 🟢
Once digests/reminders/role-rewards exist, users need opt-outs (`user_configs` table already exists and is nearly empty — this is its purpose).

### 6.2 Privacy controls 🟡
An activity tracker should offer: per-user opt-out of tracking (bot ignores their voice/presence events), data deletion request, and the export from §4.4. Beyond ethics, this preempts the #1 complaint pattern for tracking bots and is required territory if the bot ever grows beyond friends' servers.

### 6.3 Multi-server aggregate profile 🟢
The active-servers page lists a user's servers; a natural next step is a cross-server personal profile — total hours everywhere, favorite server, global streak. All data exists; it's one aggregation without the `guild_id` filter.

---

## Suggested roadmap

| Phase | Features | Why this order |
|---|---|---|
| 1 — "Show what you have" | 1.1 messages, 1.2 status, 1.4 games, 2.3 streaks | Pure wins, no new collection, reuses existing components |
| 2 — "Close the loop" | 3.1 digest, 3.3 /stats, 4.1 settings page | Makes the bot visible in-server; settings page unlocks all config-driven features |
| 3 — "The shareable stuff" | 2.1 social graph, 2.2 Wrapped, 4.2 live view | Highest wow-factor, built on phase-1 query work |
| 4 — "The big bets" | 3.2 role rewards, 5 gamification, 3.5 temp channels | Retention systems; only worth it once phases 1–3 prove engagement |
