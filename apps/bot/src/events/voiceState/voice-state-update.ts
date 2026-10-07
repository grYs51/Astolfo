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
    return runSerialized(voiceKey(newState.guild.id, newState.id), () =>
      this.handleVoiceStateUpdate(oldState, newState, date)
    );
  }

  private async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
    date: Date
  ) {
    if (userJoinedVoiceChannel(oldState, newState)) {
      return handleUserJoinedVoiceChannel(newState, date);
    }

    if (userLeftVoiceChannel(oldState, newState)) {
      return handleUserLeftVoiceChannel(oldState, date);
    }

    if (userChangedVoiceChannel(oldState, newState)) {
      return handleUserChangeVoiceChannel(oldState, newState, date);
    }

    // user changed voice states (mute, deaf, streaming, etc)
    const changedVoiceStates = getChangedUserVoiceStates(oldState, newState);
    if (Object.values(changedVoiceStates).length > 0) {
      return handleUserChangeVoiceStates(
        oldState,
        newState,
        date,
        changedVoiceStates
      );
    }
  }
}
