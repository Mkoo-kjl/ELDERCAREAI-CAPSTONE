package com.eldercareai.watch
import org.junit.Assert.*
import org.junit.Test

class HrvWindowTest {
    @Test fun requiresEnoughValidBeatsAndTime() {
        val window = HrvWindow()
        repeat(29) { assertNull(window.add(1000, 0, 1_700_000_000_000L + it * 1000)) }
    }
    @Test fun computesRmssdFromIntervals() {
        val window = HrvWindow(); var result: Double? = null; var time = 1_700_000_000_000L
        repeat(65) { val interval = if (it % 2 == 0) 900 else 1100; time += interval; window.add(interval, 0, time)?.let { result = it } }
        assertEquals(200.0, result!!, 0.001)
    }
    @Test fun invalidIntervalsBreakContinuity() {
        val window = HrvWindow(); var time = 1_700_000_000_000L
        repeat(35) { time += 1000; window.add(1000, 0, time) }
        assertNull(window.add(1000, -1, time + 1000))
        assertNull(window.add(1000, 0, time + 2000))
        assertNull(window.add(0, 0, time + 3000))
    }
    @Test fun gapsAndOutOfOrderDataDoNotProduceFreshHrv() {
        val window = HrvWindow(); val time = 1_700_000_000_000L
        repeat(35) { window.add(1000, 0, time + it * 1000) }
        assertNull(window.add(1000, 0, time))
        assertNull(window.add(1000, 0, time + 60_000))
    }
}
