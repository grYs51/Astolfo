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

export class VoiceStatsApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  /**
   * Fetch all voice stats with pagination
   * @param guildId - Can be a static string or a signal/computed function
   * @param limit - Optional limit
   * @param offset - Optional offset
   */
  fetchVoiceStats(
    guildId: string | (() => string),
    limit?: number | (() => number | undefined),
    offset?: number | (() => number | undefined)
  ) {
    return this.get<VoiceStatsResponse>(
      typeof guildId === 'function'
        ? () => `/features/voice-stats/${guildId()}`
        : `/features/voice-stats/${guildId}`,
      () => {
        const params: Record<string, string> = {};
        const limitVal = typeof limit === 'function' ? limit() : limit;
        const offsetVal = typeof offset === 'function' ? offset() : offset;

        if (limitVal !== undefined) params['limit'] = limitVal.toString();
        if (offsetVal !== undefined) params['offset'] = offsetVal.toString();

        return params;
      }
    );
  }

  /**
   * Fetch overview statistics
   * @param guildId - Can be a static string or a signal/computed function
   */
  fetchVoiceStatsOverview(guildId: string | (() => string)) {
    return this.get<VoiceStatsOverview>(
      typeof guildId === 'function'
        ? () => `/features/voice-stats/${guildId()}/overview`
        : `/features/voice-stats/${guildId}/overview`
    );
  }

  /**
   * Fetch leaderboard with optional period filter
   * @param guildId - Can be a static string or a signal/computed function
   * @param period - Can be a static string or a signal/computed function
   * @param limit - Optional limit
   */
  fetchVoiceStatsLeaderboard(
    guildId: string | (() => string),
    period?: ('day' | 'week' | 'month' | 'all') | (() => 'day' | 'week' | 'month' | 'all' | undefined),
    limit?: number | (() => number | undefined)
  ) {
    return this.get<VoiceStatsLeaderboard>(
      typeof guildId === 'function'
        ? () => `/features/voice-stats/${guildId()}/leaderboard`
        : `/features/voice-stats/${guildId}/leaderboard`,
      () => {
        const params: Record<string, string> = {};
        const periodVal = typeof period === 'function' ? period() : period;
        const limitVal = typeof limit === 'function' ? limit() : limit;

        if (periodVal) params['period'] = periodVal;
        if (limitVal !== undefined) params['limit'] = limitVal.toString();

        return params;
      }
    );
  }

  /**
   * Fetch channel statistics
   * @param guildId - Can be a static string or a signal/computed function
   */
  fetchVoiceStatsChannels(guildId: string | (() => string)) {
    return this.get<VoiceStatsChannels>(
      typeof guildId === 'function'
        ? () => `/features/voice-stats/${guildId()}/channels`
        : `/features/voice-stats/${guildId}/channels`
    );
  }

  /**
   * Fetch user-specific statistics
   * @param guildId - Can be a static string or a signal/computed function
   * @param userId - Can be a static string or a signal/computed function
   */
  fetchVoiceStatsUser(
    guildId: string | (() => string),
    userId: string | (() => string)
  ) {
    return this.get<VoiceStatsUser>(
      typeof guildId === 'function' || typeof userId === 'function'
        ? () => {
            const guild = typeof guildId === 'function' ? guildId() : guildId;
            const user = typeof userId === 'function' ? userId() : userId;
            return `/features/voice-stats/${guild}/users/${user}`;
          }
        : `/features/voice-stats/${guildId}/users/${userId}`
    );
  }

  /**
   * Fetch timeline statistics
   * @param guildId - Can be a static string or a signal/computed function
   * @param period - Can be a static string or a signal/computed function
   * @param granularity - Can be a static string or a signal/computed function
   */
  fetchVoiceStatsTimeline(
    guildId: string | (() => string),
    period?: ('day' | 'week' | 'month' | 'year') | (() => 'day' | 'week' | 'month' | 'year' | undefined),
    granularity?: ('hour' | 'day' | 'week') | (() => 'hour' | 'day' | 'week' | undefined)
  ) {
    return this.get<VoiceStatsTimeline>(
      typeof guildId === 'function'
        ? () => `/features/voice-stats/${guildId()}/timeline`
        : `/features/voice-stats/${guildId}/timeline`,
      () => {
        const params: Record<string, string> = {};
        const periodVal = typeof period === 'function' ? period() : period;
        const granularityVal = typeof granularity === 'function' ? granularity() : granularity;

        if (periodVal) params['period'] = periodVal;
        if (granularityVal) params['granularity'] = granularityVal;

        return params;
      }
    );
  }

  /**
   * Fetch heatmap data showing activity by hour and day of week
   * @param guildId - Can be a static string or a signal/computed function
   * @param period - Optional time period filter
   */
  fetchVoiceStatsHeatmap(
    guildId: string | (() => string),
    period?: ('week' | 'month' | 'year' | 'all') | (() => 'week' | 'month' | 'year' | 'all' | undefined)
  ) {
    return this.get<VoiceStatsHeatmap>(
      typeof guildId === 'function'
        ? () => `/features/voice-stats/${guildId()}/heatmap`
        : `/features/voice-stats/${guildId}/heatmap`,
      () => {
        const params: Record<string, string> = {};
        const periodVal = typeof period === 'function' ? period() : period;

        if (periodVal) params['period'] = periodVal;

        return params;
      }
    );
  }

  /**
   * Fetch user-specific heatmap data with server comparison
   * @param guildId - Can be a static string or a signal/computed function
   * @param userId - Can be a static string or a signal/computed function
   * @param period - Optional time period filter
   */
  fetchVoiceStatsUserHeatmap(
    guildId: string | (() => string),
    userId: string | (() => string | undefined | null),
    period?: ('week' | 'month' | 'year' | 'all') | (() => 'week' | 'month' | 'year' | 'all' | undefined)
  ) {
    return this.get<VoiceStatsUserHeatmap>(
      () => {
        const guild = typeof guildId === 'function' ? guildId() : guildId;
        const user = typeof userId === 'function' ? userId() : userId;
        if (!user) return undefined; // skip request until userId is available
        return `/features/voice-stats/${guild}/users/${user}/heatmap`;
      },
      () => {
        const params: Record<string, string> = {};
        const periodVal = typeof period === 'function' ? period() : period;

        if (periodVal) params['period'] = periodVal;

        return params;
      }
    );
  }
}
