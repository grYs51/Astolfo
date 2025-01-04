import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'discordImage',
    standalone: true,
})
export class DiscordImagePipe implements PipeTransform {

    transform (value: string | undefined, key: 'avatars' | 'icons' | 'banners' | string, id: string): string | null {
        if (!value || !id) {
            const random = Math.floor(Math.random() * 6);
            return `https://cdn.discordapp.com/embed/avatars/${random}.png`;
        }

        // check if value start with a_
        if (value.toString().startsWith('a_')) {
            return `https://cdn.discordapp.com/${key}/${id}/${value}.gif?size=${key === 'avatars' ? 128 : 1024}`;
        }

        return `https://cdn.discordapp.com/${key}/${id}/${value}.webp?size=${key === 'avatars' ? 128 : 1024}`;
    }

}