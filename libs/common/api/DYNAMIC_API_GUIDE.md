# Dynamic API with Angular Resource API

## Overview

The `ApiBase` class supports **reactive signal tracking** with Angular's `httpResource`. HTTP requests automatically refetch when signals change.

`VoiceStatsApi` methods accept **only reactive function parameters** (`() => value`). Static values are passed as constant closures, e.g. `() => 'guildId'` — since `httpResource` re-evaluates the closure anyway, there is no separate static form.

## How It Works

### Before (Manual Resource Creation)
```typescript
// You had to manually create resources with request/loader pattern
leaderboardResource = resource({
  request: () => ({ id: this.id(), period: this.selectedPeriod() }),
  loader: ({ request }) =>
    this.voiceStatsApi.fetchVoiceStatsLeaderboard(request.id, request.period, 10),
});
```

### After (Automatic Signal Tracking)
```typescript
// The API automatically tracks signals inside the functions you pass
leaderboardResource = this.voiceStatsApi.fetchVoiceStatsLeaderboard(
  () => this.id(),             // Tracks id signal
  () => this.selectedPeriod(), // Tracks period signal
  () => 10                     // Constant closure for a static value
);
```

## Usage Examples

### Example 1: Reactive with Signals
```typescript
export class MyComponent {
  id = input.required<string>();
  period = signal<'day' | 'week' | 'month' | 'all'>('week');

  // Resource automatically refetches when id or period changes!
  resource = api.fetchVoiceStatsLeaderboard(
    () => this.id(),
    () => this.period()
  );

  changePeriod(newPeriod: 'day' | 'week' | 'month' | 'all') {
    this.period.set(newPeriod); // ✨ Auto-refetches!
  }
}
```

### Example 2: Static Values

```typescript
// Static values are just constant closures
resource = api.fetchVoiceStatsOverview(() => '123456789');
```

### Example 3: Complex Path with Signals
```typescript
guildId = signal('123');
userId = signal('456');

// Path is built reactively from signals
resource = api.fetchVoiceStatsUser(
  () => this.guildId(),
  () => this.userId()
);
```

### Example 4: Skipping a Request Until Data Is Ready

```typescript
// Returning undefined/null from the userId function skips the request
resource = api.fetchVoiceStatsUserHeatmap(
  () => this.guildId(),
  () => this.currentUser()?.id, // request skipped while undefined
  () => this.period()
);
```

## API Methods

### fetchVoiceStatsOverview
```typescript
api.fetchVoiceStatsOverview(() => this.guildId())
```

### fetchVoiceStatsLeaderboard
```typescript
api.fetchVoiceStatsLeaderboard(
  () => this.guildId(),
  () => this.period(), // 'day' | 'week' | 'month' | 'all'
  () => this.limit()
)
```

### fetchVoiceStatsTimeline
```typescript
// Fully reactive - automatically refetches when any signal changes
api.fetchVoiceStatsTimeline(
  () => this.guildId(),
  () => this.period(),      // 'day' | 'week' | 'month' | 'year'
  () => this.granularity()  // 'hour' | 'day' | 'week'
)
```

## Creating Your Own API Service

```typescript
export class MyApi extends ApiBase {
  protected override host = inject(MY_API_URL);

  // Accept only the reactive form — it keeps signatures simple and
  // httpResource re-evaluates the closures anyway
  fetchData(id: () => string, filter?: () => string | undefined) {
    return this.get<MyData>(
      () => `/api/data/${id()}`,
      () => {
        const params: Record<string, string> = {};
        const filterVal = filter?.();
        if (filterVal) params['filter'] = filterVal;
        return params;
      }
    );
  }
}
```

## Key Benefits

✅ **Automatic reactivity** - No manual resource creation needed
✅ **Type-safe** - Full TypeScript support
✅ **Clean code** - One-liner resource creation
✅ **Performance** - Only refetches when tracked signals change

## Migration Guide

### Old Pattern
```typescript
const resource = resource({
  request: () => ({
    id: this.id(),
    filter: this.filter()
  }),
  loader: ({ request }) => api.fetch(request.id, request.filter)
});
```

### New Pattern
```typescript
const resource = api.fetch(
  () => this.id(),
  () => this.filter()
);
```

Much cleaner! 🎉
