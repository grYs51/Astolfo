export const createBar = (current: number, max: number, size = 15) => {
  // Ensure values are not negative
  current = Math.max(0, current);
  max = Math.max(0, max);
  size = Math.max(0, size);

  const percentage = max === 0 ? 0 : Math.round((current / max) * 100);
  const bar = Math.round((size * percentage) / 100);
  const empty = size - bar;
  return `${'█'.repeat(bar)}${'░'.repeat(empty)}    ${percentage}%`;
};

type ValueOption = {
  icon: string;
  end?: boolean;
};
type PercentageValueOption = ValueOption & { percentage: number };
type AbsoluteValueOption = ValueOption & { value: number };
type DetailedBarOptions = {
  values: Array<PercentageValueOption | AbsoluteValueOption>;
  emptyIcon?: string;
  max: number;
  size: number;
};

export const createDetailedBar = (options: DetailedBarOptions) => {
  const barredValues = options.values.map((option) => {
    const percentage =
      'percentage' in option
        ? option.percentage
        : Math.round((option.value / options.max) * 100);

    const valueSize = Math.round((options.size * percentage) / 100);

    return { ...option, bar: option.icon.repeat(valueSize), size: valueSize };
  });

  const empty =
    options.size - barredValues.reduce((sum, curr) => sum + curr.size, 0);

  const { start: startBarOptions, end: endBarOptions } = Object.groupBy(
    barredValues,
    (option) => (option.end ? 'end' : 'start')
  );

  const startBars = startBarOptions.map(option=>option.icon.repeat(option.size)).join("")
  const endBars = endBarOptions.map(option=>option.icon.repeat(option.size)).join("")
  const emptyBar = (options.emptyIcon || ' ').repeat(empty)

  return `${startBars}${emptyBar}${endBars}`;
};
