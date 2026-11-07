package com.eldercareai.watch
/** Mirrors server limits so one invalid SDK event cannot block valid queued measurements. */
object WatchSamplePolicy {
    fun accepts(metric:String,value:Double):Boolean {
        if(!value.isFinite())return false
        return when(metric){
            "heart_rate_bpm"->value in 1.0..350.0
            "spo2_percent"->value in 1.0..100.0
            "hrv_rmssd_ms"->value in 0.0..1000.0
            "skin_temp_celsius"->value in -10.0..60.0
            "steps_count"->value in 0.0..1_000_000.0 && value==kotlin.math.floor(value)
            else->false
        }
    }
}
