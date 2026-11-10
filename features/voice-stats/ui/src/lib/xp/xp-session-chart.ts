import type { DiscordMember, XpSegment } from '@nx-stolfo/data-access-voice-stats';

type People = Record<string, DiscordMember>;

const nameOf = (people: People, id: string) => {
  const member = people[id];
  return member ? member.displayName || member.username : 'Someone';
};

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** "Alex joined", "Sam left": one marker at each change in who's in the channel */
export const memberChanges = (segments: XpSegment[], people: People) =>
  segments.slice(1).flatMap((segment, i) => {
    const before = new Set(segments[i].memberIds);
    const now = new Set(segment.memberIds);
    const labels = [
      ...segment.memberIds.filter((id) => !before.has(id)).map((id) => `${nameOf(people, id)} joined`),
      ...segments[i].memberIds.filter((id) => !now.has(id)).map((id) => `${nameOf(people, id)} left`),
    ];
    return labels.length ? [{ at: segment.from, multiplier: segment.multiplier, label: labels.join(', ') }] : [];
  });

/** Deafened stretches, neighbours merged */
export const deafRanges = (segments: XpSegment[]) =>
  segments.reduce<{ from: number; to: number }[]>((ranges, s) => {
    if (!s.deaf) return ranges;
    const last = ranges[ranges.length - 1];
    if (last && last.to === s.from) last.to = s.to;
    else ranges.push({ from: s.from, to: s.to });
    return ranges;
  }, []);

/** "Alex, Sam: 2 others 1.12× · stay 1.1× · camera +10% = 1.36×" */
export const breakdown = (s: XpSegment, people: People) => {
  const n = s.memberIds.length;
  const parts = [
    n ? `${s.memberIds.map((id) => nameOf(people, id)).join(', ')}: ${n === 1 ? '1 other' : `${n} others`} ${s.crowd}×` : `Alone ${s.crowd}×`,
  ];
  if (s.stay !== 1) parts.push(`stay ${s.stay}×`);
  if (s.media !== 1) {
    const what = s.camera && s.streaming ? 'camera and screen share' : s.camera ? 'camera' : 'screen share';
    parts.push(`${what} +${Math.round((s.media - 1) * 100)}%`);
  }
  if (s.deaf) parts.push(`deafened ${+(s.multiplier / (s.crowd * s.stay * s.media)).toFixed(2)}×`);
  return `${parts.join(' · ')} = ${s.multiplier}×`;
};

const AXIS = { axisLabel: { color: '#9ca3af' }, axisLine: { lineStyle: { color: '#374151' } } };

/** The ECharts option for a voice session's multiplier over time: one point per segment and one at the end */
export const sessionChartOption = (segments: XpSegment[], people: People) => {
  const last = segments[segments.length - 1];
  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    grid: { left: 8, right: 24, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#f3f4f6' },
      formatter: (params: { value: [number, number] }[]) => {
        const at = params[0]?.value[0] ?? last.from;
        const segment = segments.find((s) => s.from <= at && at < s.to) ?? last;
        return `<strong>${time(segment.from)}–${time(segment.to)}</strong><br/>${escapeHtml(breakdown(segment, people))}`;
      },
    },
    xAxis: { type: 'time', ...AXIS },
    yAxis: {
      type: 'value',
      min: 0,
      ...AXIS,
      axisLabel: { color: '#9ca3af', formatter: '{value}×' },
      splitLine: { lineStyle: { color: '#374151', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        // Each value holds until the next point
        step: 'end',
        symbol: 'none',
        lineStyle: { color: '#a855f7', width: 2 },
        areaStyle: { color: 'rgba(168, 85, 247, 0.12)' },
        data: [...segments.map((s) => [s.from, s.multiplier]), [last.to, last.multiplier]],
        markPoint: {
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#f3f4f6' },
          label: { show: true, position: 'top', color: '#e5e7eb', fontSize: 11, formatter: '{b}' },
          data: memberChanges(segments, people).map((c) => ({ name: c.label, coord: [c.at, c.multiplier] })),
        },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(156, 163, 175, 0.15)' },
          label: { show: true, color: '#9ca3af', fontSize: 11, position: 'insideTop' },
          data: deafRanges(segments).map((r) => [{ name: 'Deafened', xAxis: r.from }, { xAxis: r.to }]),
        },
      },
    ],
  };
};
