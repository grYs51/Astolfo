import { REST } from "discord.js";

export default new REST().setToken(process.env.DISCORD_BOT_TOKEN!);
