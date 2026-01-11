# Dynamic API with Angular Resource API

## Overview

The `ApiBase` class now supports **reactive signal tracking** with Angular's `httpResource`. This means your HTTP requests automatically refetch when signals change!

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
// The API automatically tracks signals when you pass functions!
leaderboardResource = this.voiceStatsApi.fetchVoiceStatsLeaderboard(
  () => this.id(),           // Tracks id signal
  () => this.selectedPeriod(), // Tracks period signal
  () => 10
);
```

## Usage Examples

### Example 1: Static Values (No Reactivity)
```typescript
// Pass static values directly
resource = api.fetchVoiceStatsOverview('123456789');
```

### Example 2: Reactive with Signals
```typescript
export class MyComponent {
  id = input.required<string>();
  period = signal('week');

  // Resource automatically refetches when id or period changes!
  resource = api.fetchVoiceStatsLeaderboard(
    () => this.id(),
    () => this.period()
  );

  changePeriod(newPeriod: string) {
    this.period.set(newPeriod); // ✨ Auto-refetches!
  }
}
```

### Example 3: Mixed Static and Reactive
```typescript
// You can mix static and reactive params
resource = api.fetchVoiceStatsLeaderboard(
  '123456789',           // Static guild ID
  () => this.period(),  // Reactive period
  10                     // Static limit
);
```

### Example 4: Complex Path with Signals
```typescript
guildId = signal('123');
userId = signal('456');

// Path is built reactively from signals
resource = api.fetchVoiceStatsUser(
  () => this.guildId(),
  () => this.userId()
);
```

## API Methods

All `VoiceStatsApi` methods now support both patterns:

### fetchVoiceStatsOverview
```typescript
// Static
api.fetchVoiceStatsOverview('guildId')

// Reactive
api.fetchVoiceStatsOverview(() => this.guildId())
```

### fetchVoiceStatsLeaderboard
```typescript
// Static
api.fetchVoiceStatsLeaderboard('guildId', 'week', 10)

// Reactive
api.fetchVoiceStatsLeaderboard(
  () => this.guildId(),
  () => this.period(),
  () => this.limit()
)

// Mixed
api.fetchVoiceStatsLeaderboard(
  'guildId',
  () => this.period(), // Only period is reactive
  10
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

  // Support both static and reactive parameters
  fetchData(
    id: string | (() => string),
    filter?: string | (() => string | undefined)
  ) {
    return this.get<MyData>(
      // Path can be reactive
      typeof id === 'function'
        ? () => `/api/data/${id()}`
        : `/api/data/${id}`,
      // Query params can be reactive
      () => {
        const params: Record<string, string> = {};
        const filterVal = typeof filter === 'function' ? filter() : filter;
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
✅ **Flexible** - Mix static and reactive params as needed
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
