import type { Meta, StoryObj } from '@storybook/angular';

import { NavbarComponent } from './navbar.component';

const meta: Meta<NavbarComponent> = {
  title: 'Components/Navbar',
  component: NavbarComponent,
  //👇 Our exports that end in "Data" are not stories.
  excludeStories: /.*Data$/,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<NavbarComponent>;

// loginUrl is a required input; without it the LoggedOut story threw NG0950
export const LoggedIn: Story = {
  args: {
    name: 'Test Task',
    image: 'https://cataas.com/cat',
    loginUrl: '#',
    logoutUrl: '#',
  },
};

export const LoggedOut: Story = {
  args: {
    loginUrl: '#',
  },
};
