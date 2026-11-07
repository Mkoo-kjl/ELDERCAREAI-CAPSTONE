package com.eldercareai.watch

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.*
import android.location.Location
import android.net.ConnectivityManager
import android.net.Network
import android.os.*
import android.provider.Settings
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** User-started monitoring. Every valid vital event is persisted before a batched upload. */
class MonitoringService : Service(), SensorEventListener {
    companion object {
        @Volatile var isMonitoring = false
            private set
        const val STOP = "com.eldercareai.watch.STOP"
        const val RETRY_LOCATION = "com.eldercareai.watch.RETRY_LOCATION"
    }
    private lateinit var store: DeviceStore
    private lateinit var queue: SampleQueue
    private lateinit var sensors: SensorManager
    private lateinit var location: WatchLocation
    private lateinit var samsung: SamsungSensors
    private lateinit var internet: WatchInternet
    private val worker = Executors.newSingleThreadScheduledExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    @Volatile private var running = false
    @Volatile private var fix: Pair<Location, String>? = null
    private var wakeRenewedAt = 0L
    private var careTick = 0
    private var fallback = false
    private var opticalPaused = false
    private var deviceId = ""
    private var connectivity: ConnectivityManager? = null
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            if (running) try { worker.execute { if (running) upload() } } catch (_: java.util.concurrent.RejectedExecutionException) { }
        }
    }

    override fun onCreate() {
        super.onCreate()
        store = DeviceStore(this); queue = SampleQueue(this)
        internet = WatchInternet(this, { message -> store.prefs.edit().putString("connection_status",message).apply() }, {
            if (running) try { worker.execute { if (running) upload() } } catch (_: java.util.concurrent.RejectedExecutionException) { }
        })
        connectivity = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        connectivity?.registerDefaultNetworkCallback(networkCallback)
        sensors = getSystemService(SENSOR_SERVICE) as SensorManager
        location = WatchLocation(this, { point, source ->
            fix = point to source
            store.prefs.edit().putString("gps_display", "%.5f, %.5f ±%.0fm".format(point.latitude, point.longitude, point.accuracy))
                .putLong("gps_at", point.time).putString("location_source", source).apply()
        }, { message -> store.prefs.edit().putString("gps_status", message.take(240)).apply() })
        samsung = SamsungSensors(this, { metric, value, measured ->
            if (metric == "heart_rate_bpm" && fallback) stopFallback()
            sample(metric, value, measured)
        }, { metric, message ->
            status(metric, message)
        }, { if (running && !opticalPaused) startFallback() })
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
            NotificationChannel("monitoring", "Watch monitoring", NotificationManager.IMPORTANCE_LOW))
    }
    private fun status(metric: String, message: String) { store.prefs.edit().putString("status_$metric", message.take(240)).apply() }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            STOP -> {
                if (!running) { stopSelf(); return START_NOT_STICKY }
                running = false; isMonitoring = false
                stopCollectors()
                store.prefs.edit().putBoolean("running", false).apply()
                worker.execute {
                    do { val sent = upload() } while (sent && queue.count(deviceId) > 0)
                    handler.post { stopSelf() }
                }
                return START_NOT_STICKY
            }
            RETRY_LOCATION -> { if (running) location.start() else stopSelf(); return START_NOT_STICKY }

        }
        if (running) return START_NOT_STICKY
        try {
            val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            val stop = PendingIntent.getService(this, 1, Intent(this, MonitoringService::class.java).setAction(STOP), PendingIntent.FLAG_IMMUTABLE)
            val notification = Notification.Builder(this, "monitoring").setContentTitle("ElderCareAI monitoring")
                .setContentText("Sharing watch vitals and location").setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(open).setOngoing(true).addAction(android.R.drawable.ic_media_pause, "Stop", stop).build()
            val types = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or
                (if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH else 0)
            startForeground(1, notification, types)
            if (store.token() == null) throw IllegalStateException("Pair the watch before starting.")
            deviceId = store.prefs.getString("device_id", null) ?: throw IllegalStateException("Pair this watch again.")
            running = true; isMonitoring = true
            internet.start()
            store.prefs.edit().putBoolean("running", true).putString("upload_status", "Starting sensors…").apply()
            status("sleep_hours", "Sleep is not exposed by the live sensor SDK.")
            status("spo2_percent", "Tap Measure blood oxygen on the watch for a spot reading.")
            startFallback(); samsung.start()
            if (checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED) {
                val stepSensor = sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
                if (stepSensor != null && sensors.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL))
                    status("steps_count", "Steps counted during monitoring today.")
                else status("steps_count", "Step counter unavailable.")
            } else status("steps_count", "Allow Physical activity permission on the watch.")
            // A location problem must not stop working heart-rate monitoring.
            try { location.start() } catch (e: Exception) { store.prefs.edit().putString("gps_status", "Location: ${e.message}").apply() }
            wakeLock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ElderCareAI:Monitoring").apply {
                setReferenceCounted(false); acquire(60 * 60 * 1000L)
            }
            wakeRenewedAt = SystemClock.elapsedRealtime()
            worker.scheduleWithFixedDelay({
                try {
                    if (running && SystemClock.elapsedRealtime() - wakeRenewedAt > 50 * 60 * 1000L) {
                        wakeLock?.acquire(60 * 60 * 1000L); wakeRenewedAt = SystemClock.elapsedRealtime()
                    }
                    if (running) {
                        handler.post { if (running && !opticalPaused) samsung.flush() }
                        upload()
                        if (careTick++ % 7 == 0) CareBridge.refresh(this)
                    }
                } catch (e: Exception) { store.prefs.edit().putString("upload_status", "Upload pending: ${e.message}").apply() }
            }, 0, 2, TimeUnit.SECONDS)
        } catch (error: Exception) {
            store.prefs.edit().putString("upload_status", error.message ?: "Unable to start monitoring.").apply(); stopSelf()
        }
        return START_NOT_STICKY
    }
    private fun startFallback() {
        if (fallback || opticalPaused || !running) return
        val heart = sensors.getDefaultSensor(Sensor.TYPE_HEART_RATE, true) ?: sensors.getDefaultSensor(Sensor.TYPE_HEART_RATE)
        fallback = heart != null && sensors.registerListener(this, heart, 1_000_000, 0)
        status("heart_rate_bpm", if (fallback) "Waiting for a valid wrist measurement." else "Heart-rate sensor unavailable or permission denied.")
    }
    private fun stopFallback() {
        sensors.getSensorList(Sensor.TYPE_HEART_RATE).forEach { sensors.unregisterListener(this, it) }
        fallback = false
    }
    private fun sample(metric: String, value: Double, measured: Long): Boolean {
        if(!WatchSamplePolicy.accepts(metric,value)){status(metric,"Invalid sensor event rejected; waiting for a valid measurement.");return false}
        if (!running || !value.isFinite() || measured < 1_577_836_800_000L || measured > System.currentTimeMillis() + 300_000) return false
        // SQLite persists every delivered update; uploads never collapse the intervening samples.
        try {
            queue.add(deviceId, metric, value, measured)
            val prefs = store.prefs
            if (measured > prefs.getLong("at_$metric", 0)) {
                prefs.edit().putString("value_$metric", value.toString()).putLong("at_$metric", measured).apply()
                status(metric, when (metric) {
                    "hrv_rmssd_ms" -> "RMSSD estimated from valid beat intervals over 30–60 seconds; not a stress score."
                    "skin_temp_celsius" -> "Wrist skin temperature; not core body temperature."
                    "steps_count" -> "Steps counted during monitoring today."
                    else -> "Receiving measurements."
                })
            }
            return true
        } catch (e: Exception) { status(metric, "Not saved: ${e.message}. Check watch storage."); return false }
    }
    private var stepAnchor: Long? = null
    private var stepDay = ""
    override fun onSensorChanged(event: SensorEvent) {
        if (!running) return
        val measured = System.currentTimeMillis() - (SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1_000_000L
        val value = event.values.firstOrNull() ?: return
        if (!value.isFinite()) return
        if (event.sensor.type == Sensor.TYPE_HEART_RATE && fallback && !opticalPaused) {
            if (event.accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE || value <= 0 || value > 350) return
            samsung.noteValidHeartContact(measured)
            sample("heart_rate_bpm", value.toDouble(), measured)
        } else if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val today = LocalDate.now().toString()
            val raw = value.toLong()
            val prefs = store.prefs
            if (stepDay != today) {
                stepAnchor = null; stepDay = today
                if (prefs.getString("step_day", "") != today) prefs.edit().putString("step_day", today).putLong("steps_today", 0).apply()
            }
            val increment = stepAnchor?.let { if (raw >= it) raw - it else 0 } ?: 0
            stepAnchor = raw
            val total = prefs.getLong("steps_today", 0) + increment
            prefs.edit().putLong("steps_today", total).apply()
            sample("steps_count", total.toDouble(), measured)
        }
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    private fun upload(): Boolean {
        val token = store.token() ?: return false
        val batch = queue.batch(deviceId)
        val battery = (getSystemService(BATTERY_SERVICE) as BatteryManager).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val statuses = JSONObject()
        listOf("heart_rate_bpm", "spo2_percent", "skin_temp_celsius", "hrv_rmssd_ms", "steps_count", "sleep_hours", "sdk").forEach {
            statuses.put(it, store.prefs.getString("status_$it", "Waiting for measurement."))
        }
        val payload = JSONObject().put("action", "ingest").put("upload_id", UUID.randomUUID().toString())
            .put("captured_at", Instant.now().toString()).put("monitoring", running).put("samples", batch)
            .put("sensor_status", statuses).put("gps_status", store.prefs.getString("gps_status", "Waiting for location.")?.take(240))
        if (battery in 0..100) payload.put("battery_percent", battery)
        fix?.let { (point, source) ->
            payload.put("latitude", point.latitude).put("longitude", point.longitude).put("accuracy_m", point.accuracy)
                .put("gps_measured_at", Instant.ofEpochMilli(point.time).toString()).put("location_source", source)
        }
        try {
            val response = WatchApi.post(payload, token)
            val accepted = response.optJSONArray("accepted_sample_ids")
                ?: throw IllegalStateException("Update the galaxy-watch backend before using this watch version.")
            // Acknowledge only IDs in this request, even if the server response is unexpected.
            val submitted = (0 until batch.length()).map { batch.getJSONObject(it).getString("id") }.toSet()
            for (i in 0 until accepted.length()) require(accepted.getString(i) in submitted)
            queue.acknowledge(deviceId, accepted)
            store.prefs.edit().putLong("uploaded_at", System.currentTimeMillis())
                .putLong("queued_count", queue.count(deviceId)).putString("upload_status", "Connected to ElderCareAI").apply()
            return true
        } catch (error: Exception) {
            store.prefs.edit().putLong("queued_count", queue.count(deviceId)).putString("upload_status", "Saved on watch; upload pending: ${error.message}").apply()
            return false
        }
    }
    private fun stopCollectors() { samsung.stop(); sensors.unregisterListener(this); location.stop(); fallback = false }
    override fun onDestroy() {
        running = false; isMonitoring = false
        if (::store.isInitialized) store.prefs.edit().putBoolean("running", false).apply()
        if (::samsung.isInitialized) stopCollectors()
        if (::internet.isInitialized) internet.stop()
        if (wakeLock?.isHeld == true) wakeLock?.release()
        try { connectivity?.unregisterNetworkCallback(networkCallback) } catch (_: Exception) { }
        worker.shutdown() // Let a final in-flight request finish; its outbox entries remain until acknowledged.
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    inner class LocalBinder : Binder() { val monitoringService: MonitoringService get() = this@MonitoringService }
    override fun onBind(intent: Intent?) = LocalBinder()
    fun beginOxygen(result: (Int, Long) -> Unit, error: (String) -> Unit): Boolean {
        if (!running) { error("Start monitoring first."); return false }
        if (opticalPaused) { error("A blood-oxygen measurement is already running."); return false }
        opticalPaused = true; stopFallback()
        val accepted = samsung.measureOxygen({ value, measured ->
            if (sample("spo2_percent", value.toDouble(), measured)) {
                status("spo2_percent", "Last spot measurement. Start another check for a new reading.")
                result(value, measured)
            } else error("The result could not be saved. Check watch storage and retry.")
        }, { message -> status("spo2_percent", message); error(message) }, {
            opticalPaused = false; if (running) startFallback()
        })
        if (!accepted) { opticalPaused = false; startFallback() }
        return accepted
    }
    fun cancelOxygen() { samsung.cancelOxygen() }
}
