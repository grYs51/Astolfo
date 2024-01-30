import { REST } from "discord.js";

export const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);
