import { HttpClient, httpResource } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import {
  VoiceStatsOverview,
  VoiceStatsLeaderboard,
  VoiceStatsChannels,
  VoiceStatsUser,
  VoiceStatsTimeline,
  VoiceStatsHeatmap,
  VoiceStatsUserHeatmap,
  VoiceStatsPeriod,
  TimelinePeriod,
  TimelineGranularity,
  HeatmapPeriod,
  DashboardPeriod,
  ServerMessageStats,
  ServerPresence,
  UserPresence,
  ServerGames,
  UserGames,
  ActivityCalendar,
  VoiceHabitMetric,
  VoiceHabitsLeaderboard,
  XpLeaderboard,
  StatsCardSection,
  StatsCardTheme,
} from '@nx-stolfo/api-interfaces';

/**
 * The viewer's IANA time zone. Sent as `tz` so the API buckets hours/days
 * (heatmaps, timeline) the way the viewer experiences them instead of UTC.
 */
const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * All params are reactive functions (`() => value`) — usually signals or
 * computeds — so the underlying `httpResource` refetches when they change.
 * Static values can be passed as `() => 'value'`.
 */
export class VoiceStatsApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);
  private http = inject(HttpClient);

  /**
   * A member's stats card as a PNG blob, for the preview, the download and the clipboard.
   * `card` returning undefined skips the request (the dialog is closed).
   */
  fetchStatsCard(
    card: () =>
      | { guildId: string; userId: string; period: DashboardPeriod; theme: StatsCardTheme; sections: StatsCardSection[] }
      | undefined
  ) {
    return httpResource.blob(() => {
      const c = card();
      return c && {
        url: `${this.host}/features/voice-stats/${c.guildId}/users/${c.userId}/stats.png`,
        params: { period: c.period, theme: c.theme, sections: c.sections.join(','), tz: viewerTimeZone() },
      };
    });
  }

  /** Fetch overview statistics */
  fetchVoiceStatsOverview(
    guildId: () => string,
    period?: () => DashboardPeriod | undefined
  ) {
    return this.get<VoiceStatsOverview>(
      () => `/features/voice-stats/${guildId()}/overview`,
      (): Record<string, string> => {
        const periodVal = period?.();
        return periodVal ? { period: periodVal } : {};
      }
    );
  }

  /** Fetch leaderboard with optional period filter */
  fetchVoiceStatsLeaderboard(
    guildId: () => string,
    period?: () => VoiceStatsPeriod | undefined,
    limit?: () => number | undefined
  ) {
    return this.get<VoiceStatsLeaderboard>(
      () => `/features/voice-stats/${guildId()}/leaderboard`,
      () => {
        const params: Record<string, string> = {};
        const periodVal = period?.();
        const limitVal = limit?.();

        if (periodVal) params['period'] = periodVal;
        if (limitVal !== undefined) params['limit'] = limitVal.toString();

        return params;
      }
    );
  }

  /** Fetch text activity: totals, top channels, top members */
  fetchServerMessages(
    guildId: () => string,
    period?: () => DashboardPeriod | undefined
  ) {
    return this.get<ServerMessageStats>(
      () => `/features/voice-stats/${guildId()}/messages`,
      (): Record<string, string> => {
        const periodVal = period?.();
        return periodVal ? { period: periodVal } : {};
      }
    );
  }

  /** Fetch channel statistics */
  fetchVoiceStatsChannels(
    guildId: () => string,
    period?: () => DashboardPeriod | undefined
  ) {
    return this.get<VoiceStatsChannels>(
      () => `/features/voice-stats/${guildId()}/channels`,
      (): Record<string, string> => {
        const periodVal = period?.();
        return periodVal ? { period: periodVal } : {};
      }
    );
  }

  /** Fetch user-specific statistics */
  fetchVoiceStatsUser(
    guildId: () => string,
    userId: () => string | undefined | null,
    period?: () => DashboardPeriod | undefined
  ) {
    return this.get<VoiceStatsUser>(
      () => {
        const user = userId();
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guildId()}/users/${user}`;
      },
      (): Record<string, string> => {
        const periodVal = period?.();
        return periodVal ? { period: periodVal } : {};
      }
    );
  }

  /** Fetch timeline statistics */
  fetchVoiceStatsTimeline(
    guildId: () => string,
    period?: () => TimelinePeriod | undefined,
    granularity?: () => TimelineGranularity | undefined
  ) {
    return this.get<VoiceStatsTimeline>(
      () => `/features/voice-stats/${guildId()}/timeline`,
      () => {
        const params: Record<string, string> = { tz: viewerTimeZone() };
        const periodVal = period?.();
        const granularityVal = granularity?.();

        if (periodVal) params['period'] = periodVal;
        if (granularityVal) params['granularity'] = granularityVal;

        return params;
      }
    );
  }

  /** Fetch heatmap data showing activity by hour and day of week */
  fetchVoiceStatsHeatmap(
    guildId: () => string,
    period?: () => HeatmapPeriod | undefined
  ) {
    return this.get<VoiceStatsHeatmap>(
      () => `/features/voice-stats/${guildId()}/heatmap`,
      () => {
        const params: Record<string, string> = { tz: viewerTimeZone() };
        const periodVal = period?.();

        if (periodVal) params['period'] = periodVal;

        return params;
      }
    );
  }

  /** Fetch user-specific heatmap data with server comparison */
  fetchVoiceStatsUserHeatmap(
    guildId: () => string,
    userId: () => string | undefined | null,
    period?: () => HeatmapPeriod | undefined
  ) {
    return this.get<VoiceStatsUserHeatmap>(
      () => {
        const user = userId();
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guildId()}/users/${user}/heatmap`;
      },
      () => {
        const params: Record<string, string> = { tz: viewerTimeZone() };
        const periodVal = period?.();

        if (periodVal) params['period'] = periodVal;

        return params;
      }
    );
  }

  /** Server pulse: average members online per hour, night owls, early birds */
  fetchServerPresence(guildId: () => string, period: () => DashboardPeriod) {
    return this.get<ServerPresence>(
      () => `/features/voice-stats/${guildId()}/presence`,
      () => ({ period: period(), tz: viewerTimeZone() })
    );
  }

  /** One member's online time per status and hour of day */
  fetchUserPresence(
    guildId: () => string,
    userId: () => string | undefined | null,
    period: () => DashboardPeriod
  ) {
    return this.get<UserPresence>(
      () => {
        const user = userId();
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guildId()}/users/${user}/presence`;
      },
      () => ({ period: period(), tz: viewerTimeZone() })
    );
  }

  /** Rock-paper-scissors leaderboard and most-played pairs */
  fetchServerGames(guildId: () => string, period: () => DashboardPeriod) {
    return this.get<ServerGames>(
      () => `/features/voice-stats/${guildId()}/games`,
      () => ({ period: period() })
    );
  }

  /** Members ranked by camera or streaming time */
  fetchVoiceHabits(
    guildId: () => string,
    period: () => DashboardPeriod,
    metric: () => VoiceHabitMetric
  ) {
    return this.get<VoiceHabitsLeaderboard>(
      () => `/features/voice-stats/${guildId()}/voice-habits`,
      () => ({ period: period(), metric: metric() })
    );
  }

  /** Members ranked by XP earned in the period */
  fetchXpLeaderboard(guildId: () => string, period: () => DashboardPeriod) {
    return this.get<XpLeaderboard>(
      () => `/features/voice-stats/${guildId()}/xp-leaderboard`,
      () => ({ period: period() })
    );
  }

  /** One member's rock-paper-scissors record (and head-to-head with the viewer) */
  fetchUserGames(
    guildId: () => string,
    userId: () => string | undefined | null,
    period: () => DashboardPeriod
  ) {
    return this.get<UserGames>(
      () => {
        const user = userId();
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guildId()}/users/${user}/games`;
      },
      () => ({ period: period() })
    );
  }

  /** The server's daily activity over the last 12 months */
  fetchServerActivityCalendar(guildId: () => string) {
    return this.get<ActivityCalendar>(
      () => `/features/voice-stats/${guildId()}/calendar`,
      () => ({ tz: viewerTimeZone() })
    );
  }

  /** One member's daily activity over the last 12 months */
  fetchUserActivityCalendar(guildId: () => string, userId: () => string | undefined | null) {
    return this.get<ActivityCalendar>(
      () => {
        const user = userId();
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guildId()}/users/${user}/calendar`;
      },
      () => ({ tz: viewerTimeZone() })
    );
  }

}
