import type { Meta, StoryObj } from '@storybook/angular';

import { fireEvent, within } from '@storybook/test';

import { BreadCrumbsComponent } from './breadcrumbs.component';

const meta: Meta<BreadCrumbsComponent> = {
  title: 'Components/Breadcrumbs',
  component: BreadCrumbsComponent,
  //👇 Our exports that end in "Data" are not stories.
  excludeStories: /.*Data$/,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<BreadCrumbsComponent>;

export const LoggedIn: Story = {
  args: {
    breadCrumbs: [
      {
        path: 'home',
        name: 'Home',
      },
    ],
  },

  // play: async ({ canvasElement }) => {
  //   const canvas = within(canvasElement);

  //   await fireEvent.click(canvas.getByText('Add Task'));
  // }
};
