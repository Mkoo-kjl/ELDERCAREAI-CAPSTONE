package com.eldercareai.watch
import org.junit.Assert.*
import org.junit.Test

class SpotOxygenSessionTest {
    private class Fake : SpotOxygenSession.Port {
        val calls = mutableListOf<String>()
        val results = mutableListOf<(Int, Long) -> Unit>()
        val errors = mutableListOf<(String) -> Unit>()
        override fun pauseContinuous() { calls.add("pause") }
        override fun startSpot(result: (Int, Long) -> Unit, error: (String) -> Unit) { calls.add("spot"); results.add(result); errors.add(error) }
        override fun stopSpot() { calls.add("stop") }
        override fun resumeContinuous() { calls.add("resume") }
    }
    @Test fun resultStopsSpotAndRestoresContinuousBeforePublishingOnce() {
        val fake = Fake(); val session = SpotOxygenSession(fake); var count = 0
        session.start({ value, _ -> assertEquals(97, value); assertEquals(listOf("pause","spot","stop","resume"), fake.calls); count++ }, { fail(it) })
        fake.results[0](97, 100); fake.results[0](97, 100)
        assertEquals(1, count); assertFalse(session.active)
    }
    @Test fun anOldCallbackCannotCancelOrCompleteARetry() {
        val fake = Fake(); val session = SpotOxygenSession(fake); var errors = 0; var results = 0
        session.start({ _, _ -> results++ }, { errors++ }); val old = session.attempt
        session.cancel()
        session.start({ _, _ -> results++ }, { errors++ })
        fake.errors[0]("connection ended"); fake.results[0](98, 100); session.fail(old, "timeout")
        assertTrue(session.active); assertEquals(0, errors); assertEquals(0, results)
        fake.results[1](97, 200); assertEquals(1, results)
    }
    @Test fun timeoutAndCancellationResumeTrackingExactlyOnce() {
        val fake = Fake(); val session = SpotOxygenSession(fake); var errors = 0
        session.start({ _, _ -> fail("Unexpected reading") }, { errors++ })
        session.fail(session.attempt, "No reliable result"); session.cancel()
        assertEquals(1, errors); assertEquals(1, fake.calls.count { it == "resume" })
    }
    @Test fun repeatedStartDoesNotReplaceActiveMeasurement() {
        val fake = Fake(); val session = SpotOxygenSession(fake)
        assertTrue(session.start({ _, _ -> }, {})); assertFalse(session.start({ _, _ -> }, {}))
        assertEquals(listOf("pause","spot"), fake.calls)
    }
}
