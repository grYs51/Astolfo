
import type { Meta, StoryObj } from '@storybook/angular';

import { fireEvent, within } from '@storybook/test';

import { NavbarComponent  } from './navbar.component';



const meta: Meta<NavbarComponent> = {
  title: 'Components/Navbar',
  component: NavbarComponent,
  //👇 Our exports that end in "Data" are not stories.
  excludeStories: /.*Data$/,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<NavbarComponent>;

export const LoggedIn: Story = {

  args: {
    name: 'Test Task',
    image: 'https://cataas.com/cat',
  },

  // play: async ({ canvasElement }) => {
  //   const canvas = within(canvasElement);

  //   await fireEvent.click(canvas.getByText('Add Task'));
  // }
};

export const LoggedOut: Story = {
  args: {
   
  },
};