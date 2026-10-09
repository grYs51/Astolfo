import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import {
  VoiceStatsResponse,
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
  MemberPrivacy,
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

  /** The viewer's own privacy setting */
  fetchPrivacy() {
    return this.get<MemberPrivacy>('/features/me/privacy');
  }

  /** Change the viewer's privacy setting (one-off request, not a resource) */
  setPrivacy(hidden: boolean) {
    return this.http.put<MemberPrivacy>(`${this.host}/features/me/privacy`, { hidden });
  }

  /** Fetch all voice stats with pagination */
  fetchVoiceStats(
    guildId: () => string,
    limit?: () => number | undefined,
    offset?: () => number | undefined
  ) {
    return this.get<VoiceStatsResponse>(
      () => `/features/voice-stats/${guildId()}`,
      () => {
        const params: Record<string, string> = {};
        const limitVal = limit?.();
        const offsetVal = offset?.();

        if (limitVal !== undefined) params['limit'] = limitVal.toString();
        if (offsetVal !== undefined) params['offset'] = offsetVal.toString();

        return params;
      }
    );
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
}
