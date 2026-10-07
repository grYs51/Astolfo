import { Pipe, PipeTransform } from '@angular/core';

/**
 * Discord's own default-avatar rule for users without an avatar, so the
 * fallback is stable (it was Math.random(), changing on every re-render).
 */
const defaultAvatarIndex = (id?: string): number => {
    try {
        return id ? Number((BigInt(id) >> BigInt(22)) % BigInt(6)) : 0;
    } catch {
        return 0; // not a snowflake
    }
};

@Pipe({
    name: 'discordImage',
    standalone: true,
})
export class DiscordImagePipe implements PipeTransform {

    transform (value: string | undefined, key: 'avatars' | 'icons' | 'banners' | string, id?: string): string {
        if (!value || !id) {
            return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex(id)}.png`;
        }

        // check if value start with a_
        if (value.toString().startsWith('a_')) {
            return `https://cdn.discordapp.com/${key}/${id}/${value}.gif?size=${key === 'avatars' ? 128 : 1024}`;
        }

        return `https://cdn.discordapp.com/${key}/${id}/${value}.webp?size=${key === 'avatars' ? 128 : 1024}`;
    }

}