package com.eldercareai.watch
import org.junit.Assert.*
import org.junit.Test
class GpsRecoveryPolicyTest {
    @Test fun coldAcquisitionIsNotRestartedEveryThirtySeconds() {
        for (age in listOf(30_000L,60_000L,120_000L,899_999L)) assertFalse(GpsRecoveryPolicy.restartNeeded(age,0,null))
        assertTrue(GpsRecoveryPolicy.restartNeeded(900_000,0,null))
    }
    @Test fun anAcquiredReceiverRecoversOnlyAfterSustainedSilence() {
        assertFalse(GpsRecoveryPolicy.restartNeeded(1_000_000,0,990_000))
        assertFalse(GpsRecoveryPolicy.restartNeeded(1_000_000,950_000,0))
        assertTrue(GpsRecoveryPolicy.restartNeeded(1_000_000,0,100_000))
    }
    @Test fun probesUseStaleFixesAndAreRateLimited() {
        assertFalse(GpsRecoveryPolicy.probeNeeded(20_000,0,15_000,-30_000))
        assertTrue(GpsRecoveryPolicy.probeNeeded(20_000,0,null,-30_000))
        assertFalse(GpsRecoveryPolicy.probeNeeded(40_000,0,null,20_000))
        assertTrue(GpsRecoveryPolicy.probeNeeded(50_000,0,10_000,20_000))
    }
}
