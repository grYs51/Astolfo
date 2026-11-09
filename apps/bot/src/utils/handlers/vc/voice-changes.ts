import { VoiceState } from 'discord.js';
import { client } from '../../../client/instance';
import {
  VOICE_TYPE,
  VoiceTypeToVoiceStats,
  createVoiceStat,
  getActiveVoiceStates,
  runSerialized,
  voiceKey,
} from './voice-utils';
import {
  cancelJob,
  schedule5hrVoiceChannelJob,
} from '../../schedulers/voice-channel.scheduler';
import { saveAllUserVoiceStatsToDb, saveTypeUserVoiceStats } from './voice-db';
import { Logger } from '../../logger';

export const handleUserLeftVoiceChannel = async (
  oldState: VoiceState,
  date: Date
) => {
  try {
    await saveAllUserVoiceStatsToDb(oldState.member!.id, oldState.guild.id, date);
  } finally {
    cancelJob(oldState.guild.id, oldState.member!.id);
  }
};

/**
 * Closes every open session in a guild (e.g. the bot was removed from it, so
 * no leave events will ever arrive) and cancels their reminder jobs.
 */
export const closeGuildVoiceSessions = async (guildId: string, date: Date) => {
  const prefix = voiceKey(guildId, '');
  return closeSessions(
    [...client.voiceUsers.keys()].filter((key) => key.startsWith(prefix)),
    date
  );
};

/** Open session whose member is no longer in its channel per the gateway */
const hasLeft = (key: string) => {
  const [guildId, memberId] = key.split(':');
  const guild = client.guilds.cache.get(guildId);
  // An unavailable guild's voice states are stale: leave its sessions alone
  if (!guild?.available) return false;
  const channelId = guild.voiceStates.cache.get(memberId)?.channelId;
  return channelId !== client.voiceUsers.get(key)?.[0]?.channel_id;
};

/**
 * After a fresh gateway session (re-identify), events missed during the gap
 * are never replayed: close sessions of members who left or switched channel
 * meanwhile, or they'd count live until the member rejoins. setVc reopens the
 * switched ones.
 * shortcut: mute/deaf/stream changes during the gap aren't reconciled (they
 * close with the session), upgrade if those rows matter more.
 */
export const closeLeftVoiceSessions = (date: Date) =>
  closeSessions([...client.voiceUsers.keys()].filter(hasLeft), date, hasLeft);

const closeSessions = async (
  keys: string[],
  date: Date,
  stillApplies: (key: string) => boolean = () => true
) => {
  let closed = 0;
  await Promise.all(
    keys.map((key) => {
      const [guildId, memberId] = key.split(':');
      // Same per-member queue as voiceStateUpdate, so an in-flight event for
      // this member finishes first
      return runSerialized(key, async () => {
        // A queued event may have handled it meanwhile
        if (!stillApplies(key)) return;
        try {
          await saveAllUserVoiceStatsToDb(memberId, guildId, date);
          closed++;
        } finally {
          cancelJob(guildId, memberId);
        }
      });
    })
  );

  return closed;
};

export const handleUserJoinedVoiceChannel = async (
  newState: VoiceState,
  date: Date
) => {
  const joinKey = voiceKey(newState.guild.id, newState.member!.id);

  // Anything still cached on join belongs to a session whose leave was never
  // seen (e.g. missed gateway event) — close it rather than append to it
  if (client.voiceUsers.has(joinKey)) {
    Logger.warn(`Closing stale voice session for ${joinKey} on join`);
    await saveAllUserVoiceStatsToDb(newState.member!.id, newState.guild.id, date);
  }

  const voiceVoiceStat = createVoiceStat(
    newState.guild.id,
    newState.channelId!,
    newState.member!.id,
    date
  );

  const otherVoiceStats = getActiveVoiceStates(newState).map((type) =>
    createVoiceStat(
      newState.guild.id,
      newState.channelId!,
      newState.member!.id,
      date,
      type
    )
  );

  // Persist on open: rows go to the DB immediately with ended_on = null, so
  // a crash can't lose the session (recovered by closeDanglingVoiceSessions)
  const newStats = [voiceVoiceStat, ...otherVoiceStats];
  await client.dataSource.voiceStats.createMany({ data: newStats });

  client.voiceUsers.set(joinKey, newStats);
  schedule5hrVoiceChannelJob(newState.member!, newState.channel!.id, date);
};

export const handleUserChangeVoiceChannel = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date
) => {
  await handleUserLeftVoiceChannel(oldState, date);
  await handleUserJoinedVoiceChannel(newState, date);
};

export const handleUserChangeVoiceStates = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date,
  statesChanged: VoiceTypeToVoiceStats
) => {
  const stateKey = voiceKey(newState.guild.id, newState.member!.id);
  const openTypes = new Set(
    (client.voiceUsers.get(stateKey) ?? []).map((stat) => stat.type)
  );

  // Skip types that already have an open row (e.g. captured by setVc at startup)
  const statesToAdd = Object.entries(statesChanged)
    .filter(([key, state]) => newState[state] && !openTypes.has(key))
    .map(([key]) => key as VOICE_TYPE);

  if (statesToAdd.length > 0) {
    const newVoiceStats = statesToAdd.map((type) =>
      createVoiceStat(
        newState.guild.id,
        newState.channelId!,
        newState.member!.id,
        date,
        type
      )
    );
    await client.dataSource.voiceStats.createMany({ data: newVoiceStats });
    const existingStats = client.voiceUsers.get(stateKey) ?? [];
    client.voiceUsers.set(stateKey, [...existingStats, ...newVoiceStats]);
  }

  const statesToSave = Object.entries(statesChanged)
    .filter(([, state]) => !newState[state])
    .map(([key]) => key as VOICE_TYPE);

  if (statesToSave.length > 0) {
    await saveTypeUserVoiceStats(
      oldState.member!.id,
      oldState.guild.id,
      date,
      statesToSave
    );
  }
};
