package com.eldercareai.watch

import kotlin.math.sqrt

/** Rolling RMSSD from quality-approved inter-beat intervals, never estimated from BPM. */
class HrvWindow {
    private data class Beat(val end: Long, val interval: Int)
    private val beats = ArrayDeque<Beat>()
    private var lastEmitted = 0L
    fun reset() { beats.clear(); lastEmitted = 0 }
    fun add(interval: Int, status: Int, endedAt: Long): Double? {
        if (status != 0 || interval !in 300..2000) { reset(); return null }
        val previous = beats.lastOrNull()
        if (previous != null && endedAt <= previous.end) return null
        if (previous != null && endedAt - previous.end > 3_000) reset()
        beats.addLast(Beat(endedAt, interval))
        while (beats.isNotEmpty() && beats.first().end < endedAt - 60_000) beats.removeFirst()
        if (beats.size < 30 || endedAt - beats.first().end < 30_000 || endedAt - lastEmitted < 5_000) return null
        var squareSum = 0.0
        val list = beats.toList()
        for (i in 1 until list.size) {
            val difference = (list[i].interval - list[i - 1].interval).toDouble()
            squareSum += difference * difference
        }
        lastEmitted = endedAt
        return sqrt(squareSum / (list.size - 1))
    }
}
