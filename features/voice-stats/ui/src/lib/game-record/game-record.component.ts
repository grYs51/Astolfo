import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RpsMove, UserGames } from '@nx-stolfo/data-access-voice-stats';

const MOVE_ICON: Record<RpsMove, string> = { rock: '🪨', paper: '📄', scissors: '✂️' };

/** One member's rock-paper-scissors record, and head-to-head with the viewer. */
@Component({
  selector: 'feature-voice-stats-game-record',
  templateUrl: './game-record.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class GameRecordComponent {
  games = input.required<UserGames>();
  /** Another member's name; empty for the viewer */
  name = input<string | undefined>(undefined);

  protected winRate = computed(() => {
    const g = this.games();
    return g.games > 0 ? Math.round((g.wins / g.games) * 100) : 0;
  });

  protected move = (move: RpsMove | null) => (move ? `${MOVE_ICON[move]} ${move}` : '—');
}
