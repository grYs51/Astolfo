import { ObjectId } from 'mongodb';

export interface DbGuildConfiguration {
  _id: ObjectId;
  guildId: string;
  prefix: string;
  welcomeChannelId: string;
  welcomeMessage: string;
  goodbyeMessage: string;
}
