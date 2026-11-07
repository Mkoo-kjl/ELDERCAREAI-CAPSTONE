package com.eldercareai.watch
import org.junit.Assert.*
import org.junit.Test
class LocationFixPolicyTest {
    private fun fix(time: Long, source: String = "fused", accuracy: Float = 10f, latitude: Double = 10.0) =
        LocationFixPolicy.Fix(latitude, 123.0, accuracy, time, source)
    @Test fun freshFusedMovementIsNotLockedOutByAnOlderGpsFix() {
        val policy = LocationFixPolicy()
        assertTrue(policy.accept(fix(100_000,"watch_gps"),100_000))
        assertTrue(policy.accept(fix(106_000,"fused",20f,10.001),106_000))
        assertEquals("fused",policy.latest!!.source)
        assertEquals(10.001,policy.latest!!.latitude,0.000001)
    }
    @Test fun preciseRecentSatelliteFixIsPreferredOverPoorNetworkData() {
        val policy = LocationFixPolicy()
        assertTrue(policy.accept(fix(100_000,"watch_gps",5f),100_000))
        assertFalse(policy.accept(fix(101_000,"network",300f),101_000))
        assertTrue(policy.accept(fix(102_000,"fused",4f),102_000))
        assertEquals("fused",policy.latest!!.source)
    }
    @Test fun networkFallbackKeepsItsTrueSource() {
        val policy = LocationFixPolicy()
        assertTrue(policy.accept(fix(100_000,"watch_gps",10f),100_000))
        assertTrue(policy.accept(fix(110_000,"network",100f),110_000))
        assertEquals("network",policy.latest!!.source)
    }
    @Test fun rejectsOldFutureOutOfOrderAndInvalidSources() {
        val policy = LocationFixPolicy()
        assertFalse(policy.accept(fix(0),100_000))
        assertFalse(policy.accept(fix(101_000),100_000))
        assertFalse(policy.accept(fix(100_000,latitude=91.0),100_000))
        assertFalse(policy.accept(fix(100_000,accuracy=Float.NaN),100_000))
        assertFalse(policy.accept(fix(100_000,"unknown"),100_000))
        assertTrue(policy.accept(fix(100_000),100_000))
        assertFalse(policy.accept(fix(99_000),100_000))
    }
    @Test fun acceptsFirstFusedFixAfterReboot() { assertTrue(LocationFixPolicy().accept(fix(2_000),2_000)) }
}
