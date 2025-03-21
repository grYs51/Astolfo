import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'humanizeDuration',
  standalone: true,
})
export class HumanizeDurationPipe implements PipeTransform {
  transform(value: number, short = false): string {
    if (value < 0) return '';

    value = Math.floor(value / 1000); // Convert milliseconds to seconds

    console.log('value', value);

    const weeks = Math.floor(value / (7 * 24 * 60 * 60));
    const days = Math.floor((value % (7 * 24 * 60 * 60)) / (24 * 60 * 60));
    const hours = Math.floor((value % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((value % (60 * 60)) / 60);
    const seconds = Math.floor(value % 60);

    const parts = [];
    if (weeks > 0)
      parts.push(short ? `${weeks}w` : `${weeks} week${weeks > 1 ? 's' : ''}`);
    if (days > 0)
      parts.push(short ? `${days}d` : `${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0)
      parts.push(short ? `${hours}h` : `${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0)
      parts.push(
        short ? `${minutes}m` : `${minutes} minute${minutes > 1 ? 's' : ''}`
      );
    if (seconds > 0 || parts.length === 0)
      parts.push(
        short ? `${seconds}s` : `${seconds} second${seconds > 1 ? 's' : ''}`
      );

    return parts.join(' ');
  }
}
