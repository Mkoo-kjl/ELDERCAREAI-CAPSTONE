package com.eldercareai.watch

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.samsung.android.service.health.tracking.ConnectionListener
import com.samsung.android.service.health.tracking.HealthTracker
import com.samsung.android.service.health.tracking.HealthTrackerException
import com.samsung.android.service.health.tracking.HealthTrackingService
import com.samsung.android.service.health.tracking.data.DataPoint
import com.samsung.android.service.health.tracking.data.HealthTrackerType
import com.samsung.android.service.health.tracking.data.ValueKey

class SamsungSensors(
    private val context: Context,
    private val onSample: (String, Double, Long) -> Unit,
    private val onStatus: (String, String) -> Unit,
    private val onHeartUnavailable: () -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private var service: HealthTrackingService? = null
    private var heart: HealthTracker? = null
    private var skin: HealthTracker? = null
    private var generation = 0
    private var connectionReady = false
    private var oxygenTracker: HealthTracker? = null
    private var oxygenTimeout: Runnable? = null
    private var oxygenFinished: (() -> Unit)? = null
    private val oxygen = SpotOxygenSession(object : SpotOxygenSession.Port {
        override fun pauseContinuous() {
            heart?.unsetEventListener(); skin?.unsetEventListener(); heart = null; skin = null
            hrv.reset(); lastHeart = 0
            onStatus("heart_rate_bpm", "Paused during blood-oxygen measurement.")
            onStatus("hrv_rmssd_ms", "Paused for SpO₂. A fresh HRV window starts afterwards.")
        }
        override fun startSpot(result: (Int, Long) -> Unit, error: (String) -> Unit) {
            val connected = service ?: throw IllegalStateException("Samsung sensor connection unavailable.")
            if (HealthTrackerType.SPO2_ON_DEMAND !in connected.trackingCapability.supportHealthTrackerTypes)
                throw IllegalStateException("Blood oxygen is unavailable on this watch software.")
            val current = generation
            oxygenTracker = connected.getHealthTracker(HealthTrackerType.SPO2_ON_DEMAND)
            oxygenTracker?.setEventListener(object : HealthTracker.TrackerEventListener {
                override fun onDataReceived(points: List<DataPoint>) { handler.post {
                    if (current != generation) return@post
                    for (point in points) {
                        val status = point.getValue(ValueKey.SpO2Set.STATUS)
                        if (status == 2) {
                            val value = point.getValue(ValueKey.SpO2Set.SPO2)
                            if (value in 1..100) result(value, point.timestamp) else error("Invalid blood-oxygen result. Try again.")
                            break
                        } else if (status < 0) {
                            error(when (status) { -4 -> "Movement detected. Rest your arm and try again."
                                -5 -> "Signal is weak. Adjust the watch fit and try again."
                                else -> "No reliable SpO₂ result (status $status). Try again." }); break
                        }
                    }
                } }
                override fun onError(problem: HealthTracker.TrackerError) { handler.post {
                    if (current == generation) error("SpO₂ sensor: $problem. Check Samsung sensor access.")
                } }
                override fun onFlushCompleted() = Unit
            })
        }
        override fun stopSpot() {
            oxygenTimeout?.let { handler.removeCallbacks(it) }; oxygenTimeout = null
            try { oxygenTracker?.unsetEventListener() } catch (_: Exception) { }
            oxygenTracker = null
        }
        override fun resumeContinuous() {
            try { if (connectionReady) attachContinuous() }
            catch (e: Exception) { failed(e.message ?: "Unable to resume Samsung sensors.") }
            val finished = oxygenFinished; oxygenFinished = null; finished?.invoke()
        }
    })
    private var lastHeart = 0L
    private var lastSamsungHeart = 0L
    fun noteValidHeartContact(measured:Long) { lastHeart=maxOf(lastHeart,measured) }
    private val hrv = HrvWindow()
    fun start() {
        stop()
        val current = ++generation
        onStatus("sdk", "Connecting to Samsung Health Sensor Service…")
        onStatus("hrv_rmssd_ms", "Keep still; waiting for 30–60 seconds of valid beat intervals.")
        onStatus("skin_temp_celsius", "Waiting for Samsung skin-temperature sensor.")
        val listener = object : ConnectionListener {
            override fun onConnectionSuccess() { handler.post {
                if (current != generation) return@post
                try {
                    connectionReady = true
                    onStatus("sdk", "Samsung sensors connected.")
                    attachContinuous()
                } catch (e: Exception) { failed(e.message ?: "Sensor setup failed.") }
            } }
            override fun onConnectionEnded() { handler.post { if (current == generation) failed("Samsung sensor connection ended. Stop and Start monitoring to reconnect.") } }
            override fun onConnectionFailed(error: HealthTrackerException) { handler.post {
                if (current == generation) failed("Samsung sensor connection error ${error.errorCode}. Update Health Sensor Service and enable its Developer mode for this test app.")
            } }
        }
        try { service = HealthTrackingService(listener, context); service?.connectService() }
        catch (e: Exception) { failed(e.message ?: "Samsung sensor service unavailable.") }
    }
    private fun attachContinuous() {
        val connected = service ?: return
        val supported = connected.trackingCapability.supportHealthTrackerTypes
        val current = generation
        if (HealthTrackerType.HEART_RATE_CONTINUOUS in supported) {
            heart = connected.getHealthTracker(HealthTrackerType.HEART_RATE_CONTINUOUS)
            heart?.setEventListener(events(current, "heart_rate_bpm", ::heartData))
        } else { onStatus("hrv_rmssd_ms", "Beat intervals unavailable on this software version."); onHeartUnavailable() }
        if (HealthTrackerType.SKIN_TEMPERATURE_CONTINUOUS in supported) {
            skin = connected.getHealthTracker(HealthTrackerType.SKIN_TEMPERATURE_CONTINUOUS)
            skin?.setEventListener(events(current, "skin_temp_celsius", ::skinData))
        } else onStatus("skin_temp_celsius", "Skin-temperature tracker unavailable. Update watch software.")
    }
    fun measureOxygen(result: (Int, Long) -> Unit, error: (String) -> Unit, finished: () -> Unit): Boolean {
        if (!connectionReady) { error("Samsung sensors are not connected. Stop and Start monitoring, then try again."); return false }
        if (oxygen.active) { error("A blood-oxygen measurement is already running."); return false }
        oxygenFinished = finished
        val accepted = oxygen.start(result, error)
        if (oxygen.active) {
            val current = oxygen.attempt
            oxygenTimeout = Runnable { oxygen.fail(current, "No reliable result in 30 seconds. Rest your arm and try again.") }
                .also { handler.postDelayed(it, 30_000) }
        }
        return accepted
    }
    fun cancelOxygen() { oxygen.cancel() }
    private fun failed(message: String) {
        connectionReady = false
        oxygen.fail(oxygen.attempt, message)
        onStatus("sdk", message)
        onStatus("skin_temp_celsius", message)
        onStatus("hrv_rmssd_ms", message)
        onHeartUnavailable()
    }
    private fun events(current: Int, metric: String, receive: (List<DataPoint>) -> Unit) = object : HealthTracker.TrackerEventListener {
        override fun onDataReceived(points: List<DataPoint>) { handler.post {
            if (current == generation) try { receive(points) } catch (e: Exception) { onStatus(metric, "Sensor data could not be read: ${e.message}") }
        } }
        override fun onFlushCompleted() = Unit
        override fun onError(error: HealthTracker.TrackerError) { handler.post {
            if (current != generation) return@post
            val message = "Samsung sensor: $error. Check sensor permissions and Health Sensor Service Developer mode."
            onStatus(metric, message)
            if (metric == "heart_rate_bpm") { onStatus("hrv_rmssd_ms", message); hrv.reset(); onHeartUnavailable() }
        } }
    }
    private fun heartData(points: List<DataPoint>) {
        val ordered = points.sortedBy { it.timestamp }
        for (point in ordered) {
            val quality = point.getValue(ValueKey.HeartRateSet.HEART_RATE_STATUS)
            if (quality == 1) {
                val value = point.getValue(ValueKey.HeartRateSet.HEART_RATE)
                if (value in 1..350) { lastHeart = maxOf(lastHeart, point.timestamp); lastSamsungHeart=maxOf(lastSamsungHeart,point.timestamp); onSample("heart_rate_bpm", value.toDouble(), point.timestamp) }
            } else {
                onStatus("heart_rate_bpm", "Waiting for stable wrist contact (Samsung status $quality).")
            }
        }
        // Samsung batches all IBIs in the first data point. Reconstruct successive beat ends
        // backwards from the last timestamp, retaining each status and interval in order.
        val intervals = mutableListOf<Pair<Int, Int>>()
        for (point in ordered) {
            val values = point.getValue(ValueKey.HeartRateSet.IBI_LIST) ?: continue
            val statuses = point.getValue(ValueKey.HeartRateSet.IBI_STATUS_LIST) ?: continue
            if (values.size != statuses.size) { hrv.reset(); continue }
            values.indices.forEach { intervals.add(values[it] to statuses[it]) }
        }
        if (intervals.isEmpty()) return
        var ended = ordered.last().timestamp - intervals.drop(1).sumOf { it.first.coerceAtLeast(0).toLong() }
        for ((index, pair) in intervals.withIndex()) {
            if (index > 0) ended += pair.first.coerceAtLeast(0)
            hrv.add(pair.first, pair.second, ended)?.let { onSample("hrv_rmssd_ms", it, ended) }
        }
    }
    private fun skinData(points: List<DataPoint>) {
        for (point in points) {
            if (point.getValue(ValueKey.SkinTemperatureSet.STATUS) != 0) continue
            val temperature = point.getValue(ValueKey.SkinTemperatureSet.OBJECT_TEMPERATURE).toDouble()
            // Wrist contact is corroborated by a recent valid optical heart-rate reading.
            if (temperature.isFinite() && temperature in -10.0..60.0 && kotlin.math.abs(point.timestamp - lastHeart) < 45_000)
                onSample("skin_temp_celsius", temperature, point.timestamp)
            else onStatus("skin_temp_celsius", "Wear the watch snugly; waiting for valid wrist contact.")
        }
    }
    fun flush() {
        try { heart?.flush(); skin?.flush() } catch (e: Exception) { onStatus("sdk", "Sensor flush: ${e.message}") }
        if(connectionReady && !oxygen.active && System.currentTimeMillis()-lastSamsungHeart>10_000) onHeartUnavailable()
    }
    fun stop() {
        generation++; connectionReady = false; oxygen.cancel(); hrv.reset(); lastHeart = 0; lastSamsungHeart=0
        try { heart?.unsetEventListener() } catch (_: Exception) { }
        try { skin?.unsetEventListener() } catch (_: Exception) { }
        heart = null; skin = null
        try { service?.disconnectService() } catch (_: Exception) { }
        service = null
    }
}
