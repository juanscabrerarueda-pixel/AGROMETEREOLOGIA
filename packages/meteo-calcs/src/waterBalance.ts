export function dailyWaterBalance(P: number | undefined, ETo: number | undefined) {
  return (P ?? 0) - (ETo ?? 0);
}

export function rollingSum(values: number[], window: number) {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += values[i];
    if (i >= window) acc -= values[i - window];
    out.push(acc);
  }
  return out;
}
