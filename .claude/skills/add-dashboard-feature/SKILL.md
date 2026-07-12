---
name: add-dashboard-feature
description: Add or extend an Angular dashboard feature (data-access lib, UI components, page wiring). USE WHEN working in features/*, libs/pages, or libs/components — new charts, cards, stats views, or wiring a new API endpoint into the UI.
---

# Adding a Dashboard Feature

Frontend stack: Angular 21, standalone components, signals, `httpResource`, `@ngrx/signals` stores, ngx-echarts, Tailwind-style utility classes in templates.

## Library layout (Nx)

A feature is split into two libs:

```
features/<name>/data-access/   # API class, models, optional signal store
features/<name>/ui/            # presentational components (inputs only, no fetching)
```

Pages that compose features live in `libs/pages` (e.g. `detail-overview` composes six voice-stats components). Shared dumb components (cards, badges, skeletons, progress bars) live in `libs/components` — check there before building a new primitive. Use the `nx-generate` skill to scaffold new libs so tags/paths match.

## Data access pattern

API classes extend `ApiBase` (`libs/common/api`). `ApiBase.get()` wraps `httpResource`; **pass functions for anything reactive** so the resource refetches when signals change:

```ts
export class MyFeatureApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  fetchThing(guildId: () => string, period?: () => string | undefined) {
    return this.get<ThingResponse>(
      () => `/features/my-feature/${guildId()}`,
      () => {
        const params: Record<string, string> = {};
        const p = period?.();
        if (p) params['period'] = p;
        return params;
      }
    );
  }
}
```

- Returning `undefined` from the URL fn skips the request (used when a param isn't ready yet — see `fetchVoiceStatsUserHeatmap`).
- Provide the API class at the page component level (`providers: [MyFeatureApi]`, see `detail-overview.component.ts`).
- Models: hand-written interfaces in `*.model.ts` mirroring the Express response — keep in sync with the backend handler.
- For load-once-on-init data, use `signalStore` + `withFetchOnInit` (`libs/common/store`, example: `ActiveServerStore`).

## Page wiring pattern (see `libs/pages/src/detail-overview/`)

- Filter state = plain `signal(...)`s on the component; resources take `() => this.filter()` and refetch automatically.
- Components use `input.required<T>()`, `computed()`, `ChangeDetectionStrategy.OnPush`.
- Loading: resources expose `isLoading()`; skeleton components exist in `libs/components` and `features/*/ui/*-skeleton`.
- Current user comes from the `USER` token (`@nx-stolfo/auth`).

## Charts (ngx-echarts)

Import only what the chart needs from `echarts/core` and register with `echarts.use([...])`, then `providers: [provideEchartsCore({ echarts })]` per component — see `voice-stats-heatmap.component.ts` or `voice-stats-timeline.component.ts`. Build the option object in a `computed()` from the input signal. Dark theme colors are hardcoded gray-800/purple palette — match the existing components.

## Rules

- No `console.log` in committed code (CODE_REVIEW.md §7.1).
- UI libs stay presentational: fetching happens in pages/data-access, data flows down via inputs.
- Storybook stories exist for shared components (`libs/components/**/*.stories.ts`) — add one for new shared primitives.
