package com.eldercareai.watch

/** Give cold acquisition time, but recover a receiver that stops delivering fixes. */
object GpsRecoveryPolicy {
    fun restartNeeded(now: Long, started: Long, lastFix: Long?): Boolean =
        now - started >= 900_000 && (lastFix == null || now - lastFix >= 900_000)
    fun probeNeeded(now: Long, started: Long, lastFix: Long?, lastProbe: Long): Boolean =
        now - (lastFix ?: started) >= 15_000 && now - lastProbe >= 30_000
}
