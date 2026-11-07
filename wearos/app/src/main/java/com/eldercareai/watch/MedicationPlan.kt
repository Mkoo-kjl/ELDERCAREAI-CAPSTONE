package com.eldercareai.watch

import java.time.*
import java.time.temporal.ChronoUnit

object MedicationPlan {
    data class Medication(val id: String, val name: String, val dosage: String, val frequency: String,
        val times: List<String>, val start: LocalDate, val end: LocalDate?, val reminders: Boolean)
    data class Dose(val medication: Medication, val at: Instant) { val key get() = "${medication.id}:${at.epochSecond}" }
    fun doses(medications: List<Medication>, now: Instant, zone: ZoneId): List<Dose> {
        val first = now.atZone(zone).toLocalDate().minusDays(1)
        return medications.flatMap { med -> (0L..3L).flatMap { offset ->
            val day = first.plusDays(offset)
            if (day < med.start || med.end?.let { day > it } == true || med.frequency.equals("As needed", true) ||
                (med.frequency.equals("Weekly", true) && ChronoUnit.DAYS.between(med.start, day) % 7 != 0L)) emptyList()
            else med.times.mapNotNull { time ->
                try { if (!Regex("\\d{2}:\\d{2}").matches(time)) null else Dose(med, day.atTime(LocalTime.parse(time)).atZone(zone).toInstant()) }
                catch (_: Exception) { null }
            }
        } }.filter { it.at >= now.minusSeconds(86400) && it.at <= now.plusSeconds(172800) }.distinctBy { it.key }.sortedBy { it.at }
    }
}
