package com.eldercareai.watch
import org.junit.Assert.*
import org.junit.Test
class WatchSamplePolicyTest {
    @Test fun heartRatesAbove100AreAcceptedWithoutChange(){
        listOf(100.0,101.0,119.0,160.0,200.0,350.0).forEach { assertTrue(WatchSamplePolicy.accepts("heart_rate_bpm",it)) }
    }
    @Test fun everySupportedMetricHasItsOwnRange(){
        assertTrue(WatchSamplePolicy.accepts("spo2_percent",96.0));assertTrue(WatchSamplePolicy.accepts("hrv_rmssd_ms",44.6))
        assertTrue(WatchSamplePolicy.accepts("skin_temp_celsius",34.4));assertTrue(WatchSamplePolicy.accepts("steps_count",2172.0))
        assertTrue(WatchSamplePolicy.accepts("steps_count",0.0))
    }
    @Test fun invalidValuesCannotPoisonTheOutbox(){
        assertFalse(WatchSamplePolicy.accepts("hrv_rmssd_ms",1001.0));assertFalse(WatchSamplePolicy.accepts("spo2_percent",101.0))
        assertFalse(WatchSamplePolicy.accepts("steps_count",1.5));assertFalse(WatchSamplePolicy.accepts("heart_rate_bpm",Double.NaN))
    }
}
