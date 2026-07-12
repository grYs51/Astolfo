import type { Meta, StoryObj } from '@storybook/angular';

import { SegmentedControlComponent } from './segmented-control.component';

const meta: Meta<SegmentedControlComponent> = {
  title: 'Components/SegmentedControl',
  component: SegmentedControlComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SegmentedControlComponent>;

export const Periods: Story = {
  args: {
    options: [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'all', label: 'All' },
    ],
    value: 'week',
  },
};
