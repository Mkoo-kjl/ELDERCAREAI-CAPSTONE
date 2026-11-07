package com.eldercareai.watch

/** Select recent genuine GPS/fused/network updates without a long GPS lockout. */
class LocationFixPolicy {
    data class Fix(val latitude: Double, val longitude: Double, val accuracy: Float, val elapsed: Long, val source: String)
    var latest: Fix? = null; private set
    fun accept(fix: Fix, now: Long): Boolean {
        if (fix.source !in setOf("watch_gps","fused","network") || !fix.latitude.isFinite() || !fix.longitude.isFinite() || fix.latitude !in -90.0..90.0 || fix.longitude !in -180.0..180.0 ||
            !fix.accuracy.isFinite() || fix.accuracy !in 0f..2000f || now - fix.elapsed !in 0..30_000) return false
        val old = latest
        if (old != null) {
            if (fix.elapsed <= old.elapsed) return false
            if (old.source == "watch_gps" && fix.source != "watch_gps" && now - old.elapsed < 5_000 &&
                old.accuracy <= 50 && fix.accuracy > old.accuracy * 1.5f) return false
        }
        latest = fix; return true
    }
    fun reset() { latest = null }
}
