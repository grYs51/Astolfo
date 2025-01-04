import { InjectionToken } from "@angular/core";

export const COMMON_BOT_API_URL = new InjectionToken<string>('common/bot-api-url');

export interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    banner?: string;
    premium_type?: number;
    accentColor?: number;
    globalName?: string;
}