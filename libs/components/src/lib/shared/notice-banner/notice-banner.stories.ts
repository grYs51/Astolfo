import type { Meta, StoryObj } from '@storybook/angular';

import { NoticeBannerComponent } from './notice-banner.component';

const meta: Meta<NoticeBannerComponent> = {
  title: 'Components/NoticeBanner',
  component: NoticeBannerComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<NoticeBannerComponent>;

export const Maintenance: Story = {
  args: { text: 'Astolfo is down for maintenance tonight from 22:00 to 23:00 UTC.' },
};
