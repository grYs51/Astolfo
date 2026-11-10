import { Events, VoiceState } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import {
  getChangedUserVoiceStates,
  handleUserChangeVoiceChannel,
  handleUserChangeVoiceStates,
  handleUserJoinedVoiceChannel,
  handleUserLeftVoiceChannel,
  runSerialized,
  userChangedVoiceChannel,
  userJoinedVoiceChannel,
  userLeftVoiceChannel,
  voiceKey,
} from '../../utils/handlers/vc';
import { awardAndAnnounce } from '../../xp/level-up';

export default class VoiceDurationUpdateEvent extends BaseEvent {
  constructor() {
    super(Events.VoiceStateUpdate);
  }

  async event(
    client: DiscordClient,
    oldState: VoiceState,
    newState: VoiceState
  ) {
    // Timestamp at receipt, not when the queued handler eventually runs
    const date = new Date();

    // One member's events must not interleave (see runSerialized)
    return runSerialized(voiceKey(newState.guild.id, newState.id), async () => {
      const closed = await this.handleVoiceStateUpdate(oldState, newState, date);
      // Voice XP lands when a session closes, in the same queue so the row is closed first
      if (closed) await awardAndAnnounce(client, newState.guild.id, newState.id);
    });
  }

  /** True when a session closed (a leave or a channel move) */
  private async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
    date: Date
  ): Promise<boolean> {
    if (userJoinedVoiceChannel(oldState, newState)) {
      await handleUserJoinedVoiceChannel(newState, date);
      return false;
    }

    if (userLeftVoiceChannel(oldState, newState)) {
      await handleUserLeftVoiceChannel(oldState, date);
      return true;
    }

    if (userChangedVoiceChannel(oldState, newState)) {
      await handleUserChangeVoiceChannel(oldState, newState, date);
      return true;
    }

    // user changed voice states (mute, deaf, streaming, etc)
    const changedVoiceStates = getChangedUserVoiceStates(oldState, newState);
    if (Object.values(changedVoiceStates).length > 0) {
      await handleUserChangeVoiceStates(
        oldState,
        newState,
        date,
        changedVoiceStates
      );
    }
    return false;
  }
}
