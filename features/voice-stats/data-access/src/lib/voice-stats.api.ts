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
} from './voice-stats.model';

/**
 * All params are reactive functions (`() => value`) — usually signals or
 * computeds — so the underlying `httpResource` refetches when they change.
 * Static values can be passed as `() => 'value'`.
 */
export class VoiceStatsApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

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
  fetchVoiceStatsOverview(guildId: () => string) {
    return this.get<VoiceStatsOverview>(
      () => `/features/voice-stats/${guildId()}/overview`
    );
  }

  /** Fetch leaderboard with optional period filter */
  fetchVoiceStatsLeaderboard(
    guildId: () => string,
    period?: () => 'day' | 'week' | 'month' | 'all' | undefined,
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

  /** Fetch channel statistics */
  fetchVoiceStatsChannels(guildId: () => string) {
    return this.get<VoiceStatsChannels>(
      () => `/features/voice-stats/${guildId()}/channels`
    );
  }

  /** Fetch user-specific statistics */
  fetchVoiceStatsUser(guildId: () => string, userId: () => string) {
    return this.get<VoiceStatsUser>(
      () => `/features/voice-stats/${guildId()}/users/${userId()}`
    );
  }

  /** Fetch timeline statistics */
  fetchVoiceStatsTimeline(
    guildId: () => string,
    period?: () => 'day' | 'week' | 'month' | 'year' | undefined,
    granularity?: () => 'hour' | 'day' | 'week' | undefined
  ) {
    return this.get<VoiceStatsTimeline>(
      () => `/features/voice-stats/${guildId()}/timeline`,
      () => {
        const params: Record<string, string> = {};
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
    period?: () => 'week' | 'month' | 'year' | 'all' | undefined
  ) {
    return this.get<VoiceStatsHeatmap>(
      () => `/features/voice-stats/${guildId()}/heatmap`,
      () => {
        const params: Record<string, string> = {};
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
    period?: () => 'week' | 'month' | 'year' | 'all' | undefined
  ) {
    return this.get<VoiceStatsUserHeatmap>(
      () => {
        const user = userId();
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guildId()}/users/${user}/heatmap`;
      },
      () => {
        const params: Record<string, string> = {};
        const periodVal = period?.();

        if (periodVal) params['period'] = periodVal;

        return params;
      }
    );
  }
}
