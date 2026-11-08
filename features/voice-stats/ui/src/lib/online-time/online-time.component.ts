import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UserPresence } from '@nx-stolfo/data-access-voice-stats';
import { HumanizeDurationPipe } from '@nx-stolfo/common/pipes';

const HOUR_LABELS = ['12 AM', '6 AM', '12 PM', '6 PM'];

/** One member's online time: hours per status and when in the day they're on. */
@Component({
  selector: 'feature-voice-stats-online-time',
  imports: [HumanizeDurationPipe],
  templateUrl: './online-time.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class OnlineTimeComponent {
  presence = input.required<UserPresence>();
  /** Another member's name; empty for the viewer */
  name = input<string | undefined>(undefined);
  /** "the month before"; undefined hides the comparison */
  previousLabel = input<string | undefined>(undefined);

  private readonly durationPipe = new HumanizeDurationPipe();
  protected readonly hourLabels = HOUR_LABELS;

  protected total = computed(() => {
    const p = this.presence();
    return p.online + p.idle + p.dnd;
  });

  protected statuses = computed(() => {
    const p = this.presence();
    const total = this.total() || 1;
    return [
      { label: 'Online', ms: p.online, color: 'bg-success', pct: (p.online / total) * 100 },
      { label: 'Idle', ms: p.idle, color: 'bg-warning', pct: (p.idle / total) * 100 },
      { label: 'Do not disturb', ms: p.dnd, color: 'bg-error', pct: (p.dnd / total) * 100 },
    ];
  });

  protected bars = computed(() =>
    this.presence().byHour.map((share, hour) => ({
      hour,
      pct: Math.round(share * 100),
    }))
  );

  /** "↑ 3h more than the month before" */
  protected change = computed(() => {
    const label = this.previousLabel();
    const previous = this.presence().previousTotal;
    if (!label || previous === null) return undefined;
    const diff = this.total() - previous;
    if (Math.abs(diff) < 60_000) return { up: false, text: `About the same as ${label}` };
    const amount = this.durationPipe.transform(Math.abs(diff), true);
    return diff > 0
      ? { up: true, text: `↑ ${amount} more than ${label}` }
      : { up: false, text: `↓ ${amount} less than ${label}` };
  });

  protected hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
}
