# Voice Stats Heatmap Feature

## 🎨 Overview

Added an interactive heatmap visualization showing voice activity by **time of day** (hour 0-23) and **day of week** (Sunday-Saturday). The heatmap uses a color gradient to indicate activity levels, making it easy to spot peak usage patterns.

## ✅ What Was Created

### Backend
- **API Endpoint**: `GET /features/voice-stats/:serverId/heatmap?period=month`
  - Aggregates voice stats by hour and day of week
  - Returns activity data with session counts and unique users
  - Supports period filters: `week`, `month`, `year`, `all`
  
- **File**: [apps/bot/src/api/routes/features/voice-stats/getVoiceStatsHeatmap.ts](apps/bot/src/api/routes/features/voice-stats/getVoiceStatsHeatmap.ts)

### Frontend

#### Data Access
- **VoiceStatsHeatmap Interface**: TypeScript models for heatmap data
- **fetchVoiceStatsHeatmap()**: Reactive API method with signal support
- **Files**: 
  - [features/voice-stats/data-access/src/lib/voice-stats.model.ts](features/voice-stats/data-access/src/lib/voice-stats.model.ts)
  - [features/voice-stats/data-access/src/lib/voice-stats.api.ts](features/voice-stats/data-access/src/lib/voice-stats.api.ts)

#### UI Component
- **VoiceStatsHeatmapComponent**: Interactive ECharts-based visualization
  - Color-coded heatmap (dark blue = low activity → dark red = high activity)
  - Hover tooltips showing duration, sessions, and user counts
  - Summary stats: Total Hours, Peak Time, Avg per Cell, Max Activity
  - Responsive design with Tailwind CSS
  
- **Files**:
  - [features/voice-stats/ui/src/lib/voice-stats-heatmap/](features/voice-stats/ui/src/lib/voice-stats-heatmap/)

#### Integration
- Added heatmap section to detail-overview page
- Period filter controls (Week, Month, Year, All Time)
- Reactive resource that auto-refetches on filter changes

## 📦 Required Installation

**IMPORTANT**: You need to install Apache ECharts before this feature will work:

```bash
npm install echarts ngx-echarts --save
```

### Why ECharts?
- ✅ Powerful charting library with extensive heatmap support
- ✅ Excellent TypeScript integration
- ✅ Built-in dark theme support
- ✅ Interactive tooltips and zoom capabilities
- ✅ Works seamlessly with Angular

## 🎯 Features

### Heatmap Visualization
- **X-Axis**: Hours of the day (12AM - 11PM)
- **Y-Axis**: Days of the week (Sun - Sat)
- **Color Scale**: Activity intensity gradient
- **Interactive**: Hover to see detailed stats for each cell

### Data Insights
Shows for each hour/day combination:
- Total voice duration (in minutes)
- Number of sessions
- Number of unique users

### Summary Statistics
- **Total Hours**: Combined voice time across all cells
- **Peak Time**: Day and hour with highest activity
- **Avg per Cell**: Average minutes per time slot
- **Max Activity**: Highest activity level in hours

### Period Filtering
- **Week**: Last 7 days
- **Month**: Last 30 days
- **Year**: Last 365 days
- **All Time**: Complete history

## 🚀 Usage Example

```typescript
// The heatmap resource automatically refetches when filters change
heatmapResource = this.voiceStatsApi.fetchVoiceStatsHeatmap(
  () => this.id(),                        // Guild/Server ID
  () => this.selectedHeatmapPeriod()     // Reactive period filter
);

// Change period - triggers auto-refetch!
setHeatmapPeriod(period: 'week' | 'month' | 'year' | 'all') {
  this.selectedHeatmapPeriod.set(period);
}
```

## 📊 Backend Data Structure

### Request
```
GET /features/voice-stats/123456789/heatmap?period=month
```

### Response
```json
{
  "heatmap": [
    {
      "hour": 14,
      "dayOfWeek": 3,
      "value": 1234,
      "sessionCount": 45,
      "uniqueUsers": 12
    }
  ],
  "stats": {
    "totalMinutes": 45678,
    "maxValue": 3456,
    "avgValue": 234,
    "peakHour": 14,
    "peakDay": 3,
    "totalCells": 168
  }
}
```

## 🎨 Styling

The component uses:
- **Tailwind CSS** for layout and spacing
- **ECharts dark theme** for the heatmap
- **Custom color gradient** optimized for voice activity visualization
- **Responsive grid** for summary stats (2 cols mobile, 4 cols desktop)

## 🔍 Use Cases

1. **Identify Peak Hours**: See when your Discord server is most active
2. **Schedule Events**: Plan activities during high-traffic periods
3. **Optimize Moderation**: Allocate mod resources to peak times
4. **Growth Analysis**: Track activity patterns over different time periods
5. **User Behavior**: Understand when your community is most engaged

## 📝 Next Steps

After installing the packages:
1. Run `npm install echarts ngx-echarts --save`
2. Restart your dev server
3. Navigate to the voice stats page
4. The heatmap will appear at the bottom with interactive visualizations!

## 🐛 Troubleshooting

**If you see import errors:**
- Make sure both `echarts` and `ngx-echarts` are installed
- Check that your Angular version is compatible (Angular 14+)
- Clear your node_modules and reinstall if needed

**If the heatmap doesn't render:**
- Open browser DevTools Console for errors
- Verify the API endpoint returns data
- Check that NgxEchartsModule is properly imported

## 💡 Tips

- **Hover** over any cell to see detailed statistics
- Use **different period filters** to compare activity patterns
- **Peak time indicator** helps identify your most active periods
- **Color intensity** makes patterns immediately visible
- Works great with the existing timeline and other voice stats components!

---

Built with ❤️ using Apache ECharts and Angular 18+
