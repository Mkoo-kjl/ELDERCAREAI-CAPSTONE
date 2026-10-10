type Point = Record<string, any>;

export const metricKeys = [
  'heart_rate_bpm',
  'spo2_percent',
  'hrv_rmssd_ms',
  'skin_temp_celsius',
  'steps_count',
  'sleep_hours',
] as const;

export type MetricKey = typeof metricKeys[number];
export type MeasurementTimes = Partial<Record<MetricKey, string>>;
export type HealthResults = Record<'heart' | 'oxygen' | 'dailyOxygen' | 'sleep' | 'steps' | 'temperature' | 'hrv', { dataPoints?: Point[]; warning?: unknown }>;

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function instant(value: unknown) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function dailyDate(value: Point | undefined) {
  const year = Number(value?.year);
  const month = Number(value?.month);
  const day = Number(value?.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

function sleepMinutesFromPoint(point: Point | undefined) {
  const sleep = point?.sleep;
  if (!sleep) return null;

  const summaryMinutes = positiveNumber(sleep.summary?.minutesAsleep);
  if (summaryMinutes !== null) return summaryMinutes;

  const asleepStages = new Set(['ASLEEP', 'LIGHT', 'DEEP', 'REM']);
  const stageMinutes = (sleep.summary?.stagesSummary ?? []).reduce(
    (total: number, stage: Point) => total + (asleepStages.has(stage.type) ? (positiveNumber(stage.minutes) ?? 0) : 0),
    0,
  );
  if (stageMinutes > 0) return stageMinutes;
  return null;
}

export function sleepSessionRows(points: Point[]) {
  return points.flatMap((point) => {
    const start = instant(point.sleep?.interval?.startTime);
    const end = instant(point.sleep?.interval?.endTime);
    const minutes = sleepMinutesFromPoint(point);
    if (!start || !end || Date.parse(end) <= Date.parse(start) || minutes === null) return [];
    const period = positiveNumber(point.sleep?.summary?.minutesInSleepPeriod);
    return [{
      source_key: typeof point.name === 'string' && point.name ? point.name : start,
      session_start_at: start,
      session_end_at: end,
      minutes_asleep: Math.round(minutes),
      minutes_in_sleep_period: period === null ? null : Math.round(period),
      is_main_sleep: point.sleep?.metadata?.mainSleep === true,
      is_processed: point.sleep?.metadata?.processed === true,
    }];
  }).sort((left, right) => Date.parse(right.session_end_at) - Date.parse(left.session_end_at) || left.source_key.localeCompare(right.source_key));
}

export function buildHealthSnapshot(results: HealthResults, checkedAt: string) {
  const heartPoint = results.heart.dataPoints?.[0];
  const oxygenPoint = results.oxygen.dataPoints?.[0];
  const dailyOxygenPoint = results.dailyOxygen.dataPoints?.[0];
  const temperaturePoint = results.temperature.dataPoints?.[0];
  const hrvPoint = results.hrv.dataPoints?.[0];
  const sleepPoints = results.sleep.dataPoints ?? [];
  const sleepPoint = sleepPoints.find((point) => point.sleep?.metadata?.mainSleep === true && point.sleep?.metadata?.processed === true && sleepMinutesFromPoint(point) !== null)
    ?? sleepPoints.find((point) => point.sleep?.metadata?.processed === true && sleepMinutesFromPoint(point) !== null)
    ?? sleepPoints.find((point) => sleepMinutesFromPoint(point) !== null);
  const sleepMinutes = sleepMinutesFromPoint(sleepPoint);
  const heartRate = positiveNumber(heartPoint?.heartRate?.beatsPerMinute);
  const instantOxygen = positiveNumber(oxygenPoint?.oxygenSaturation?.percentage);
  const spo2 = instantOxygen ?? positiveNumber(dailyOxygenPoint?.dailyOxygenSaturation?.averagePercentage);
  const stepPoints = results.steps.dataPoints ?? [];
  const stepsCount = stepPoints.length
    ? stepPoints.reduce((sum, point) => sum + (Number(point.steps?.count) || 0), 0)
    : null;
  const skinTemp = positiveNumber(temperaturePoint?.dailySleepTemperatureDerivations?.nightlyTemperatureCelsius);
  const rmssd = positiveNumber(hrvPoint?.heartRateVariability?.rootMeanSquareOfSuccessiveDifferencesMilliseconds);

  const measurementTimes: MeasurementTimes = {};
  const setTime = (key: MetricKey, time: string | null) => { if (time) measurementTimes[key] = time; };
  if (heartRate !== null) setTime('heart_rate_bpm', instant(heartPoint?.heartRate?.sampleTime?.physicalTime));
  if (spo2 !== null) setTime('spo2_percent', instantOxygen !== null
    ? instant(oxygenPoint?.oxygenSaturation?.sampleTime?.physicalTime)
    : dailyDate(dailyOxygenPoint?.dailyOxygenSaturation?.date));
  if (sleepMinutes !== null) setTime('sleep_hours', instant(sleepPoint?.sleep?.interval?.endTime));
  if (stepsCount !== null) {
    const latestStep = stepPoints.map((point) => instant(point.steps?.interval?.endTime)).filter((value): value is string => Boolean(value)).sort().at(-1);
    setTime('steps_count', latestStep ?? null);
  }
  if (skinTemp !== null) setTime('skin_temp_celsius', dailyDate(temperaturePoint?.dailySleepTemperatureDerivations?.date));
  if (rmssd !== null) setTime('hrv_rmssd_ms', instant(hrvPoint?.heartRateVariability?.sampleTime?.physicalTime));

  const measuredInstants = Object.values(measurementTimes).map((value) => value.length === 10 ? `${value}T00:00:00.000Z` : value);
  const recordedAt = measuredInstants.sort().at(-1) ?? checkedAt;
  const riskScore = Math.min(100, (heartRate && heartRate > 100 ? 25 : 0) + (spo2 && spo2 < 95 ? 45 : 0) + (sleepMinutes && sleepMinutes < 360 ? 20 : 0));
  const values = {
    heart_rate_bpm: heartRate,
    spo2_percent: spo2,
    hrv_rmssd_ms: rmssd,
    skin_temp_celsius: skinTemp,
    steps_count: stepsCount,
    sleep_hours: sleepMinutes === null ? null : Math.round((sleepMinutes / 60) * 10) / 10,
  };

  return {
    ...values,
    measurement_times: measurementTimes,
    recorded_at: recordedAt,
    synced_at: checkedAt,
    overall_status: riskScore >= 45 ? 'warning' : 'normal',
    ai_risk_score: riskScore,
    hasData: Object.values(values).some((value) => value !== null),
    sleepDiagnostics: {
      dataPointCount: sleepPoints.length,
      selected: Boolean(sleepPoint),
      mainSleep: sleepPoint?.sleep?.metadata?.mainSleep ?? null,
      processed: sleepPoint?.sleep?.metadata?.processed ?? null,
      minutesAsleep: sleepMinutes,
    },
  };
}

export function snapshotChanged(previous: Point | null, next: ReturnType<typeof buildHealthSnapshot>) {
  return !previous || metricKeys.some((key) => previous[key] !== next[key] || previous.measurement_times?.[key] !== next.measurement_times[key]);
}
