import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AdminPeople } from '@nx-stolfo/data-access-admin';
import { StatCardComponent } from '@nx-stolfo/components';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { dailyLineOption, echarts } from './charts';

@Component({
  selector: 'feature-admin-people',
  imports: [NgxEchartsDirective, StatCardComponent],
  providers: [provideEchartsCore({ echarts })],
  template: `
    @let p = people();
    <div class="grid grid-cols-2 gap-sm md:grid-cols-4">
      <lib-stat-card [dense]="true" label="Active today" [value]="p.dau" subtitle="UTC day, voice or messages" />
      <lib-stat-card [dense]="true" label="Active, 7 days" [value]="p.wau" />
      <lib-stat-card [dense]="true" label="Active, 30 days" [value]="p.mau" />
      <lib-stat-card [dense]="true" label="Drifted away" [value]="p.churned" subtitle="Active 30–60 days ago, not since" />
      <lib-stat-card [dense]="true" label="New members (13 wk)" [value]="newMembers()" [subtitle]="'This week: ' + newThisWeek()" />
      <lib-stat-card
        [dense]="true"
        label="Dashboard sign-ins (30d)"
        [value]="p.signIns.last30d"
        [subtitle]="p.signIns.last7d + ' in 7 days · ' + p.signIns.total + ' ever' + (p.signIns.beforeTracking ? ', ' + p.signIns.beforeTracking + ' before tracking' : '')"
      />
      <lib-stat-card [dense]="true" label="Signed in now" [value]="p.liveWebUsers" subtitle="People with a live dashboard session" />
      <lib-stat-card [dense]="true" label="Hidden members" [value]="p.hiddenMembers" subtitle="Privacy setting on" />
    </div>

    <h3 class="mb-xs mt-md text-sm font-semibold text-gray-100">Active members per day, all servers</h3>
    <div echarts [options]="lineOption()" class="block h-[260px] w-full"></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPeopleComponent {
  people = input.required<AdminPeople>();

  protected newMembers = computed(() => this.people().firstSeenPerWeek.reduce((sum, w) => sum + w.members, 0));
  protected newThisWeek = computed(() => this.people().firstSeenPerWeek.at(-1)?.members ?? 0);

  protected lineOption = computed(() => {
    const daily = this.people().daily;
    return dailyLineOption(
      daily.map((d) => d.day),
      [{ name: 'Members', data: daily.map((d) => d.members) }]
    );
  });
}
