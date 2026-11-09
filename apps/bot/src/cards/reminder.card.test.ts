import { reminderCard, ReminderCardData } from './reminder.card';
import { renderPng } from './render';
import { THEMES } from './themes';

const data: ReminderCardData = { memberName: '<b>Astolfo</b>', channelName: 'chill & talk', hours: 5, word: 'gay' };

describe('reminderCard', () => {
  it('shows the hours, the channel and the escaped name', () => {
    const svg = reminderCard(data, THEMES.dark);
    expect(svg).toContain('>5 hours gay!<');
    expect(svg).toContain('in #chill &amp; talk');
    expect(svg).toContain('&lt;b&gt;Astolfo&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(reminderCard(data, THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
