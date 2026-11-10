import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { XpRules, XpRulesError } from '@nx-stolfo/data-access-admin';
import { getRule, levelsPreview, MILESTONE_PATH, parseHours, saveBody, setRule, XP_RULE_GROUPS } from './xp-rules-form';

/** The XP rules for every server, each number with its default beside it. The page saves. */
@Component({
  selector: 'feature-admin-xp-rules',
  imports: [DecimalPipe],
  template: `
    <form (submit)="$event.preventDefault(); save.emit(body())">
      <div class="grid gap-lg md:grid-cols-2">
        @for (group of groups; track group.title) {
          <fieldset class="space-y-sm">
            <legend class="text-sm font-semibold text-gray-100">{{ group.title }}</legend>
            <p class="text-xs text-gray-500">{{ group.hint }}</p>
            <div class="grid grid-cols-2 gap-sm">
              @for (field of group.fields; track field.path) {
                <div>
                  <label [for]="'xp-' + field.path" class="block text-xs text-gray-400">{{ field.label }}</label>
                  <input
                    [id]="'xp-' + field.path"
                    type="number"
                    min="0"
                    [step]="field.step"
                    class="input input-bordered input-sm w-full tabular-nums"
                    [class.input-error]="errorAt(field.path)"
                    [attr.aria-invalid]="errorAt(field.path) ? 'true' : null"
                    [attr.aria-describedby]="'xp-' + field.path + '-hint'"
                    [value]="get(draft(), field.path)"
                    (input)="set(field.path, $any($event.target).valueAsNumber)"
                  />
                  <p [id]="'xp-' + field.path + '-hint'" class="mt-0.5 text-xs" [class]="errorAt(field.path) ? 'text-error' : 'text-gray-500'">
                    {{ errorAt(field.path) ?? 'Default ' + get(defaults(), field.path) }}
                  </p>
                </div>
              }
            </div>
            @if (group.title === 'Levels') {
              <p class="text-xs text-gray-400" aria-live="polite">
                @for (l of preview(); track l.level) {
                  Level {{ l.level }}: <span class="tabular-nums text-gray-200">{{ l.xp | number }} XP</span>{{ $last ? '' : ' · ' }}
                }
              </p>
            }
            @if (group.title === 'Thresholds') {
              <div>
                <label for="xp-milestones" class="block text-xs text-gray-400">Milestone hours (rising, comma separated)</label>
                <input
                  id="xp-milestones"
                  class="input input-bordered input-sm w-full tabular-nums"
                  [class.input-error]="errorAt(milestonePath)"
                  [attr.aria-invalid]="errorAt(milestonePath) ? 'true' : null"
                  aria-describedby="xp-milestones-hint"
                  [value]="draft().thresholds.milestoneHours.join(', ')"
                  (change)="set(milestonePath, parseHours($any($event.target).value))"
                />
                <p id="xp-milestones-hint" class="mt-0.5 text-xs" [class]="errorAt(milestonePath) ? 'text-error' : 'text-gray-500'">
                  {{ errorAt(milestonePath) ?? 'Default ' + defaults().thresholds.milestoneHours.join(', ') }}
                </p>
              </div>
            }
          </fieldset>
        }
      </div>

      <div class="mt-md flex flex-wrap items-center gap-sm">
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">Save</button>
        <button type="button" class="btn btn-ghost btn-sm" [disabled]="busy()" (click)="draft.set(defaults())">Reset to defaults</button>
        @if (error() && !error()!.field) {
          <span class="text-xs text-error">{{ error()!.error }}</span>
        }
      </div>
      @if (saved()) {
        <p class="mt-sm text-xs text-gray-400" role="status">
          New rules apply to new XP. Recalculate a server to apply them to its history.
        </p>
      }
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminXpRulesComponent {
  rules = input.required<XpRules>();
  defaults = input.required<XpRules>();
  busy = input(false);
  /** The API's 400; `field` names the input it belongs to */
  error = input<XpRulesError | null>(null);
  saved = input(false);
  /** null goes back to the defaults */
  save = output<XpRules | null>();

  protected readonly groups = XP_RULE_GROUPS;
  protected readonly milestonePath = MILESTONE_PATH;
  protected readonly get = getRule;
  protected readonly parseHours = parseHours;

  protected draft = linkedSignal(() => this.rules());
  protected preview = computed(() => levelsPreview(this.draft()));
  protected body = computed(() => saveBody(this.draft(), this.defaults()));

  protected set(path: string, value: unknown) {
    this.draft.update((rules) => setRule(rules, path, value));
  }

  /** The error for a field, or for an item of the milestone list */
  protected errorAt(path: string) {
    const e = this.error();
    return e?.field && (e.field === path || e.field.startsWith(path + '.')) ? e.error : undefined;
  }
}
