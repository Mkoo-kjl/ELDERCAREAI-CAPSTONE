package com.eldercareai.watch
import org.junit.Assert.*
import org.junit.Test
import java.time.*
class MedicationPlanTest {
    private val med=MedicationPlan.Medication("m","Test","1 tablet","Twice daily",listOf("08:00","20:00"),LocalDate.parse("2026-01-01"),null,true)
    @Test fun preservesSeparateDoseKeysInWatchTimezone(){
        val result=MedicationPlan.doses(listOf(med),Instant.parse("2026-11-02T01:00:00Z"),ZoneId.of("Asia/Manila"))
        assertTrue(result.any { it.at==Instant.parse("2026-11-02T00:00:00Z") })
        assertTrue(result.any { it.at==Instant.parse("2026-11-02T12:00:00Z") })
        assertEquals(result.size,result.map { it.key }.toSet().size)
    }
    @Test fun excludesAsNeededExpiredAndFutureStart(){
        val now=Instant.parse("2026-11-02T01:00:00Z");val zone=ZoneId.of("UTC")
        assertTrue(MedicationPlan.doses(listOf(med.copy(frequency="As needed")),now,zone).isEmpty())
        assertTrue(MedicationPlan.doses(listOf(med.copy(end=LocalDate.parse("2026-10-01"))),now,zone).isEmpty())
        assertTrue(MedicationPlan.doses(listOf(med.copy(start=LocalDate.parse("2026-12-01"))),now,zone).isEmpty())
    }
    @Test fun weeklyRemindersRespectStartDayAndRejectInvalidTimes(){
        val now=Instant.parse("2026-11-02T01:00:00Z")
        val result=MedicationPlan.doses(listOf(med.copy(frequency="Weekly",start=LocalDate.parse("2026-11-02"),times=listOf("08:00","bad","25:00"))),now,ZoneId.of("UTC"))
        assertEquals(1,result.size);assertEquals(Instant.parse("2026-11-02T08:00:00Z"),result.single().at)
    }
}
