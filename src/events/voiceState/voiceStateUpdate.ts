import { Events, VoiceState } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import {
  handleVoiceChannelStateChanges,
} from '../../utils/handlers/vc';
export default class VoiceDurationUpdateEvent extends BaseEvent {
  constructor() {
    super(Events.VoiceStateUpdate);
  }

  async run(client: DiscordClient, oldState: VoiceState, newState: VoiceState) {
    const date = new Date();
    return handleVoiceChannelStateChanges(oldState, newState, date);
  }
}
