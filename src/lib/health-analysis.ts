import type { VitalLog } from '@/src/providers/HealthDataProvider';

export type AnalysisSeverity = 'positive' | 'info' | 'warning' | 'critical';
export type AnalysisMetric = 'heart' | 'oxygen' | 'sleep' | 'steps' | 'temperature' | 'stress' | 'data';
export type AnalysisResult = {
  id: string;
  title: string;
  body: string;
  severity: AnalysisSeverity;
  metric: AnalysisMetric;
  confidence?: 'Low' | 'Moderate' | 'High';
};

type NumericVitalKey = 'heart_rate_bpm' | 'spo2_percent' | 'sleep_hours' | 'steps_count' | 'skin_temp_celsius' | 'stress_score';

function series(history: VitalLog[], key: NumericVitalKey) {
  const ordered = [...history].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  const values: number[] = [];
  for (const row of ordered) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value) && values.at(-1) !== value) values.push(value);
  }
  return values;
}

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}
function format(value: number, digits = 0) { return value.toFixed(digits); }

export function buildHealthInsights(history: VitalLog[]): AnalysisResult[] {
  if (!history.length) return [{ id: 'waiting', title: 'Waiting for synchronized readings', body: 'Connect Google Health and synchronize several readings to establish a personal baseline.', severity: 'info', metric: 'data' }];
  const results: AnalysisResult[] = [];
  const heart = series(history, 'heart_rate_bpm');
  const oxygen = series(history, 'spo2_percent');
  const sleep = series(history, 'sleep_hours');
  const steps = series(history, 'steps_count');
  const temperature = series(history, 'skin_temp_celsius');

  if (heart.length) {
    const latest = heart.at(-1)!;
    const baselineValues = heart.slice(-8, -1);
    const baseline = baselineValues.length ? mean(baselineValues) : null;
    const difference = baseline === null ? null : latest - baseline;
    results.push({
      id: 'heart-insight', metric: 'heart',
      title: difference !== null && Math.abs(difference) >= 10 ? 'Heart rate differs from recent baseline' : 'Heart-rate snapshot',
      body: baseline === null ? `The latest synchronized heart rate is ${format(latest)} bpm. More readings are needed for comparison.` : `Latest: ${format(latest)} bpm. Recent personal average: ${format(baseline)} bpm (${difference! >= 0 ? '+' : ''}${format(difference!)}).`,
      severity: difference !== null && Math.abs(difference) >= 15 ? 'warning' : 'info',
    });
  }
  if (oxygen.length) {
    const latest = oxygen.at(-1)!;
    results.push({ id: 'oxygen-insight', metric: 'oxygen', title: latest < 95 ? 'Blood oxygen needs attention' : 'Blood-oxygen snapshot', body: `Latest SpO₂: ${format(latest, 1)}%. Recent recorded average: ${format(mean(oxygen.slice(-7)), 1)}%.`, severity: latest < 95 ? 'critical' : 'positive' });
  }
  if (sleep.length) {
    const recent = sleep.slice(-7);
    const average = mean(recent);
    results.push({ id: 'sleep-insight', metric: 'sleep', title: average < 6 ? 'Recent sleep is shorter than the app threshold' : 'Recent sleep pattern', body: `${recent.length} recorded sleep session${recent.length === 1 ? '' : 's'} average ${format(average, 1)} hours.`, severity: average < 6 ? 'warning' : 'positive' });
  }
  if (steps.length) {
    const recent = steps.slice(-7);
    results.push({ id: 'steps-insight', metric: 'steps', title: 'Recent activity pattern', body: `${recent.length} synchronized activity snapshot${recent.length === 1 ? '' : 's'} average ${Math.round(mean(recent)).toLocaleString()} steps over each rolling 24-hour window.`, severity: 'info' });
  }
  if (temperature.length >= 2) {
    const latest = temperature.at(-1)!;
    const baseline = mean(temperature.slice(-8, -1));
    const difference = latest - baseline;
    results.push({ id: 'temperature-insight', metric: 'temperature', title: Math.abs(difference) >= 1 ? 'Nightly skin temperature shifted' : 'Skin-temperature trend', body: `Latest nightly value is ${format(latest, 1)} °C, ${Math.abs(difference).toFixed(1)} °C ${difference >= 0 ? 'above' : 'below'} the recent personal average.`, severity: Math.abs(difference) >= 1 ? 'warning' : 'info' });
  }
  return results.length ? results : [{ id: 'partial', title: 'Partial health data received', body: 'Google Health is connected, but the available records do not yet contain metrics that can be analyzed.', severity: 'info', metric: 'data' }];
}

function predict(values: number[], clamp: [number, number]) {
  const recent = values.slice(-14);
  if (recent.length < 4) return null;
  const xMean = (recent.length - 1) / 2;
  const yMean = mean(recent);
  const numerator = recent.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0);
  const denominator = recent.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0);
  const slope = denominator ? numerator / denominator : 0;
  const forecast = Math.min(clamp[1], Math.max(clamp[0], yMean + slope * (recent.length - xMean)));
  const residual = recent.reduce((sum, value, index) => sum + (value - (yMean + slope * (index - xMean))) ** 2, 0);
  const total = recent.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const fit = total === 0 ? 1 : Math.max(0, 1 - residual / total);
  const confidence = recent.length >= 8 && fit >= 0.5 ? 'High' : recent.length >= 6 && fit >= 0.25 ? 'Moderate' : 'Low';
  return { forecast, slope, confidence: confidence as 'Low' | 'Moderate' | 'High', samples: recent.length };
}

export function buildHealthPredictions(history: VitalLog[]): AnalysisResult[] {
  const definitions: { key: NumericVitalKey; id: string; metric: AnalysisMetric; label: string; unit: string; digits: number; clamp: [number, number]; meaningfulSlope: number }[] = [
    { key: 'heart_rate_bpm', id: 'heart-forecast', metric: 'heart', label: 'Heart-rate trend projection', unit: 'bpm', digits: 0, clamp: [30, 220], meaningfulSlope: 2 },
    { key: 'sleep_hours', id: 'sleep-forecast', metric: 'sleep', label: 'Sleep trend projection', unit: 'hours', digits: 1, clamp: [0, 24], meaningfulSlope: 0.15 },
    { key: 'steps_count', id: 'steps-forecast', metric: 'steps', label: 'Activity trend projection', unit: 'steps', digits: 0, clamp: [0, 200000], meaningfulSlope: 250 },
  ];
  const results = definitions.flatMap((definition) => {
    const prediction = predict(series(history, definition.key), definition.clamp);
    if (!prediction) return [];
    const direction = prediction.slope > definition.meaningfulSlope ? 'rising' : prediction.slope < -definition.meaningfulSlope ? 'falling' : 'stable';
    return [{
      id: definition.id, metric: definition.metric, title: definition.label,
      body: `The short-term trend is ${direction}. A simple linear projection estimates the next comparable reading near ${format(prediction.forecast, definition.digits)} ${definition.unit}, based on ${prediction.samples} distinct readings.`,
      severity: 'info' as const, confidence: prediction.confidence,
    }];
  });
  return results.length ? results : [{ id: 'prediction-waiting', title: 'Building personal trends', body: 'At least four distinct readings per metric are required before a statistical trend can be calculated.', severity: 'info', metric: 'data', confidence: 'Low' }];
}

export function buildHealthAnomalies(history: VitalLog[]): AnalysisResult[] {
  const latest = history[0];
  if (!latest) return [{ id: 'anomaly-waiting', title: 'No readings to analyze', body: 'Synchronize Google Health before checking for anomalies.', severity: 'info', metric: 'data' }];
  const anomalies: AnalysisResult[] = [];
  if (latest.spo2_percent !== null && latest.spo2_percent < 95) anomalies.push({ id: 'low-spo2', title: 'Low SpO₂ threshold crossed', body: `The latest SpO₂ is ${latest.spo2_percent.toFixed(1)}%, below the app’s 95% review threshold. Confirm the wearable reading and consider appropriate medical guidance.`, severity: 'critical', metric: 'oxygen' });
  if (latest.heart_rate_bpm !== null && (latest.heart_rate_bpm > 110 || latest.heart_rate_bpm < 50)) anomalies.push({ id: 'heart-threshold', title: 'Heart-rate threshold crossed', body: `The latest heart rate is ${latest.heart_rate_bpm.toFixed(0)} bpm, outside the app’s 50–110 bpm review range. Context such as activity and symptoms matters.`, severity: 'critical', metric: 'heart' });
  if (latest.sleep_hours !== null && latest.sleep_hours < 5) anomalies.push({ id: 'short-sleep', title: 'Very short recorded sleep', body: `The latest synchronized sleep duration is ${latest.sleep_hours.toFixed(1)} hours.`, severity: 'warning', metric: 'sleep' });
  if (latest.stress_score !== null && latest.stress_score >= 75) anomalies.push({ id: 'stress-elevated', title: 'HRV-derived strain estimate is elevated', body: `The demo strain score is ${latest.stress_score}/100. This reflects HRV—not a diagnosis of emotional stress.`, severity: 'warning', metric: 'stress' });

  const personalized: { key: NumericVitalKey; id: string; metric: AnalysisMetric; label: string; unit: string; minimumDelta: number }[] = [
    { key: 'heart_rate_bpm', id: 'heart-personal', metric: 'heart', label: 'Heart rate', unit: 'bpm', minimumDelta: 10 },
    { key: 'skin_temp_celsius', id: 'temp-personal', metric: 'temperature', label: 'Nightly skin temperature', unit: '°C', minimumDelta: 0.8 },
  ];
  for (const item of personalized) {
    const values = series(history, item.key);
    if (values.length < 6) continue;
    const current = values.at(-1)!;
    const baselineValues = values.slice(-8, -1);
    const baseline = mean(baselineValues);
    const deviation = standardDeviation(baselineValues);
    const delta = current - baseline;
    if (deviation > 0 && Math.abs(delta) >= item.minimumDelta && Math.abs(delta / deviation) >= 2) anomalies.push({ id: item.id, title: `${item.label} differs from personal baseline`, body: `Latest: ${format(current, item.key === 'skin_temp_celsius' ? 1 : 0)} ${item.unit}; recent average: ${format(baseline, item.key === 'skin_temp_celsius' ? 1 : 0)} ${item.unit}. The change is more than two recent standard deviations.`, severity: 'warning', metric: item.metric });
  }
  return anomalies.length ? anomalies : [{ id: 'no-anomalies', title: 'No current anomalies detected', body: 'The latest reading does not cross the configured safety thresholds or differ substantially from the available personal baseline.', severity: 'positive', metric: 'data' }];
}
