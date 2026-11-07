package com.eldercareai.watch

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.MotionEvent
import android.widget.*
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var store: DeviceStore
    private lateinit var ui: WatchUi
    private lateinit var notice: TextView
    private lateinit var badge: TextView
    private lateinit var heartValue: TextView
    private lateinit var heartAge: TextView
    private lateinit var mainAction: Button
    private lateinit var pairing: LinearLayout
    private lateinit var code: EditText
    private lateinit var pairButton: Button
    private lateinit var scroll: ScrollView
    private lateinit var locationTitle: TextView
    private lateinit var locationDetail: TextView
    private lateinit var locationStatus: TextView
    private lateinit var syncTitle: TextView
    private lateinit var syncDetail: TextView
    private lateinit var sensorHelp: TextView
    private var paired = false
    private var actionRunning: Boolean? = null
    private data class MetricViews(val value: TextView, val age: TextView, val note: TextView)
    private val metricViews = mutableMapOf<String, MetricViews>()
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private val refresh = object : Runnable {
        override fun run() { updateReadings(); handler.postDelayed(this, 1_000) }
    }
    private val heartPermission: String get() = if (Build.VERSION.SDK_INT >= 36) "android.permission.health.READ_HEART_RATE" else Manifest.permission.BODY_SENSORS
    private val backgroundPermission: String? get() = when {
        Build.VERSION.SDK_INT >= 36 -> "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
        Build.VERSION.SDK_INT >= 33 -> "android.permission.BODY_SENSORS_BACKGROUND"
        else -> null
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = DeviceStore(this); ui = WatchUi(this); paired = store.token() != null
        val content = ui.column()
        ui.add(content, ui.brand())
        badge = ui.label("READY TO MONITOR", 9f, ui.sage, true).apply { gravity = Gravity.CENTER; letterSpacing = .1f }
        ui.add(content, badge, 6)
        val hero = ui.column().apply {
            setPadding(ui.dp(12), ui.dp(7), ui.dp(12), ui.dp(7))
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(ui.elevated, ui.surface)).apply { cornerRadius = ui.dp(22).toFloat() }
        }
        heartAge = ui.label("HEART RATE", 8f, ui.muted, true).apply { gravity = Gravity.CENTER; letterSpacing = .08f }
        ui.add(hero, heartAge)
        val heartLine = ui.row().apply { gravity = Gravity.CENTER }
        heartLine.addView(ui.icon("heart", ui.primary, 18))
        heartValue = ui.label("--", 30f, ui.text, true)
        heartLine.addView(heartValue, LinearLayout.LayoutParams(-2,-2).apply { marginStart = ui.dp(7) })
        heartLine.addView(ui.label("bpm", 10f, ui.muted), LinearLayout.LayoutParams(-2,-2).apply { marginStart = ui.dp(4); gravity = Gravity.BOTTOM; bottomMargin = ui.dp(5) })
        ui.add(hero, heartLine, 1)
        ui.add(content, hero, 6)
        mainAction = ui.button("Start monitoring", true) {
            if (!paired) { pairing.visibility = View.VISIBLE; scroll.smoothScrollTo(0, pairing.top - ui.dp(18)) }
            else if (MonitoringService.isMonitoring) {
                startService(Intent(this, MonitoringService::class.java).setAction(MonitoringService.STOP))
                notice.text = "Monitoring stopped. Saved readings will finish uploading."
            } else { notice.text = ""; requestMonitoring() }
        }
        val monitorActions=ui.row()
        monitorActions.addView(mainAction,LinearLayout.LayoutParams(0,ui.dp(44),1f))
        val sosButton=ui.button("SOS") {
            if (!paired) { notice.text="Pair your watch first."; return@button }
            startActivity(Intent(this,SosActivity::class.java))
        }.apply { setTextColor(ui.pink); contentDescription="SOS · request help" }
        monitorActions.addView(sosButton,LinearLayout.LayoutParams(ui.dp(50),ui.dp(44)).apply { marginStart=ui.dp(6) })
        ui.add(content,monitorActions,7)
        ui.add(content,ui.button("Medications") { startActivity(Intent(this,CareActivity::class.java)) },7)
        notice = ui.label("", 10f, ui.warm).apply { gravity = Gravity.CENTER; visibility = View.GONE }
        ui.add(content, notice, 6)
        pairing = ui.card()
        ui.add(pairing, ui.label("Connect your watch", 12f, ui.text, true))
        ui.add(pairing, ui.label("Enter the 8-digit code from the phone app.", 10f, ui.muted), 5)
        code = EditText(this).apply {
            hint = "00000000"; inputType = InputType.TYPE_CLASS_NUMBER; filters = arrayOf(InputFilter.LengthFilter(8))
            textSize = 19f; typeface = ui.bold; setTextColor(ui.text); setHintTextColor(ui.muted)
            gravity = Gravity.CENTER; setSingleLine(true); backgroundTintList = android.content.res.ColorStateList.valueOf(ui.primary)
            setSelectAllOnFocus(true)
        }
        ui.add(pairing, code, 5, 48)
        pairButton = ui.button("Pair watch", true) { pairWatch() }
        ui.add(pairing, pairButton, 7)
        pairing.visibility = if (paired) View.GONE else View.VISIBLE
        ui.add(content, pairing, 5)
        ui.add(content, ui.section("Your readings"), 10)
        metricCard(content, "skin_temp_celsius", "Skin temperature", "°C", ui.warm)
        metricCard(content, "hrv_rmssd_ms", "Stress estimate", "/100", ui.pink)
        metricCard(content, "steps_count", "Monitored steps", "steps", ui.sage)
        metricCard(content, "spo2_percent", "Blood oxygen", "%", ui.primary)
        ui.add(content, ui.section("Location & sharing"), 12)
        val location = ui.card()
        val locationHeading = ui.row()
        locationHeading.addView(ui.icon("location", ui.primary, 18))
        locationHeading.addView(ui.label("Location", 11f, ui.text, true), LinearLayout.LayoutParams(-2,-2).apply { marginStart = ui.dp(7) })
        ui.add(location, locationHeading)
        locationTitle = ui.label("Waiting for location", 12f, ui.text, true); ui.add(location, locationTitle, 9)
        locationDetail = ui.label("", 10f, ui.muted); ui.add(location, locationDetail, 5)
        locationStatus = ui.label("Start monitoring to request a fix.", 10f, ui.muted); ui.add(location, locationStatus, 6)
        ui.add(location, ui.button("Retry location") {
            if (MonitoringService.isMonitoring) startService(Intent(this, MonitoringService::class.java).setAction(MonitoringService.RETRY_LOCATION))
            else { notice.text = "Start monitoring first."; scroll.smoothScrollTo(0,0) }
        }, 10)
        ui.add(content, location, 6)
        val sync = ui.card()
        syncTitle = ui.label("Sharing paused", 11f, ui.text, true); ui.add(sync, syncTitle)
        syncDetail = ui.label("", 10f, ui.muted); ui.add(sync, syncDetail, 6)
        ui.add(content, sync, 8)
        val tools = ui.column().apply { visibility = View.GONE }
        val settingsToggle = ui.button("Watch settings  +") { tools.visibility = if (tools.visibility == View.VISIBLE) View.GONE else View.VISIBLE }
        ui.add(content, settingsToggle, 12)
        ui.add(tools, ui.button("Location settings") { openLocationSettings() }, 8)
        ui.add(tools,ui.button("Reminder timing permission") {
            try { startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:$packageName"))) }
            catch (_: Exception) { startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:$packageName"))) }
        },8)
        ui.add(tools, ui.button("App permissions") { startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))) }, 8)
        ui.add(tools, ui.button("Pair another watch") {
            if (MonitoringService.isMonitoring) notice.text = "Stop monitoring before pairing again."
            else { pairing.visibility = View.VISIBLE; code.requestFocus() }
            scroll.smoothScrollTo(0,0)
        }, 8)
        sensorHelp = ui.label("", 10f, ui.muted); ui.add(tools, sensorHelp, 12)
        ui.add(tools, ui.label("Sleep is not available from the live watch sensors. Skin temperature is a wrist reading; HRV is an estimate.", 10f, ui.muted), 10)
        ui.add(content, tools)
        ui.add(content, ui.label("ElderCareAI · Galaxy Watch6\nVersion ${BuildConfig.VERSION_NAME}", 9f, ui.muted).apply { gravity = Gravity.CENTER }, 18)
        scroll = ui.page(content)
        // Rotary scrolling supplements touch scrolling on supported watch hardware.
        scroll.setOnGenericMotionListener { _, event ->
            if (event.action == MotionEvent.ACTION_SCROLL) {
                scroll.smoothScrollBy(0, (-event.getAxisValue(MotionEvent.AXIS_SCROLL) * ui.dp(35)).toInt()); true
            } else false
        }
        setContentView(scroll)
    }
    private fun metricCard(parent: LinearLayout, metric: String, title: String, unit: String, color: Int) {
        val card = ui.card()
        val heading = ui.row()
        heading.addView(ui.icon(metric, color, 17))
        heading.addView(ui.label(title, 10f, ui.text, true), LinearLayout.LayoutParams(-1,-2).apply { marginStart = ui.dp(7) })
        ui.add(card, heading)
        val row = ui.row().apply { gravity = Gravity.BOTTOM }
        val value = ui.label("--", if (metric == "hrv_rmssd_ms") 20f else 25f, ui.text, true)
        row.addView(value)
        row.addView(ui.label(unit, 10f, color), LinearLayout.LayoutParams(-2,-2).apply { marginStart = ui.dp(5); bottomMargin = ui.dp(4) })
        ui.add(card, row, 6)
        val age = ui.label("No reading yet", 9f, ui.muted); ui.add(card, age, 3)
        val note = ui.label("", 9f, ui.muted).apply { maxLines = 3; ellipsize = android.text.TextUtils.TruncateAt.END }; ui.add(card, note, 6)
        if (metric == "spo2_percent") ui.add(card, ui.button("Measure blood oxygen") { requestOxygen() }, 9)
        metricViews[metric] = MetricViews(value, age, note)
        ui.add(parent, card, 8)
    }
    private fun pairWatch() {
        if (MonitoringService.isMonitoring) { notice.text = "Stop monitoring before pairing again."; return }
        val value = code.text.toString().trim()
        if (!value.matches(Regex("[0-9]{8}"))) { notice.text = "Enter the eight digits shown on your phone."; return }
        pairButton.isEnabled = false; notice.text = "Pairing your watch…"
        executor.execute {
            try {
                val result = WatchApi.post(JSONObject().put("action", "claim").put("code", value).put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}"))
                store.saveToken(result.getString("token")); store.prefs.edit().putString("device_id", result.getString("device_id")).apply()
                runOnUiThread { paired = true; code.text.clear(); pairing.visibility = View.GONE; notice.text = "Paired. You're ready to start."; scroll.smoothScrollTo(0,0) }
            } catch (error: Exception) { runOnUiThread { notice.text = error.message ?: "Pairing failed. Try again." } }
            finally { runOnUiThread { pairButton.isEnabled = true } }
        }
    }
    private fun requestOxygen() {
        val permission = if (Build.VERSION.SDK_INT >= 36) "android.permission.health.READ_OXYGEN_SATURATION" else Manifest.permission.BODY_SENSORS
        if (!granted(permission)) requestPermissions(arrayOf(permission), 12)
        else startActivity(Intent(this, OxygenActivity::class.java))
    }
    private fun openLocationSettings() {
        notice.text = "Enable Location on this watch. Satellite GPS resumes automatically while monitoring."
        startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
    }
    private fun granted(permission: String) = checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    private fun requestMonitoring() {
        if (store.token() == null) { notice.text = "Pair this watch first."; return }
        val needed = mutableListOf(heartPermission, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACTIVITY_RECOGNITION)
        if (Build.VERSION.SDK_INT >= 36) needed.add("android.permission.health.READ_SKIN_TEMPERATURE")
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) needed.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = needed.filter { !granted(it) }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 10) else requestBackgroundAccess()
    }
    private fun requestBackgroundAccess() {
        val permission = backgroundPermission
        if (permission != null && !granted(permission)) {
            notice.text = "Allow sensor access in the background for screen-off monitoring. If denied, use App permissions."
            requestPermissions(arrayOf(permission), 11)
        } else startMonitoring()
    }
    private fun startMonitoring() {
        try {
            startForegroundService(Intent(this, MonitoringService::class.java))
            notice.text = "Monitoring requested. Checking watch GPS, fused and network location."
        } catch (error: Exception) { notice.text = error.message }
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 10) {
            if (granted(heartPermission) && granted(Manifest.permission.ACCESS_FINE_LOCATION)) requestBackgroundAccess()
            else notice.text = "Heart-rate access and precise location are required. Open App permissions and allow them."
        } else if (requestCode == 12) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) startActivity(Intent(this, OxygenActivity::class.java))
            else notice.text = "Allow blood-oxygen sensor permission to measure SpO₂."
        } else if (requestCode == 11) {
            if (backgroundPermission?.let { granted(it) } != false) startMonitoring()
            else notice.text = "Background sensor access was not granted. Enable it under App permissions, then tap Start."
        }
    }
    private fun age(time: Long): String {
        if (time == 0L) return "No sample yet"
        val seconds = ((System.currentTimeMillis() - time) / 1000).coerceAtLeast(0)
        return when { seconds < 60 -> "${seconds}s ago"; seconds < 3600 -> "${seconds / 60}m ago"; else -> "${seconds / 3600}h ago" }
    }
    private fun updateReadings() {
        val prefs = store.prefs
        val running = MonitoringService.isMonitoring
        val hrAt = prefs.getLong("at_heart_rate_bpm", 0)
        val hr = prefs.getString("value_heart_rate_bpm", null)?.toDoubleOrNull()
        val fresh = running && hr != null && System.currentTimeMillis() - hrAt in 0..30_000
        badge.text = when { fresh -> "● LIVE MONITORING"; running -> "MONITORING · WAITING"; paired -> "READY TO MONITOR"; else -> "LET'S CONNECT" }
        badge.setTextColor(if (fresh || paired) ui.sage else ui.muted)
        heartValue.text = hr?.toInt()?.toString() ?: "--"
        heartValue.setTextColor(if (fresh) ui.sage else ui.text)
        heartAge.text = if (hrAt > 0) "HEART RATE · ${age(hrAt)}" else "HEART RATE"
        if (actionRunning != running) {
            actionRunning = running
            mainAction.setTextColor(if (running) ui.pink else ui.background)
            mainAction.background = android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x228BCFD7),
                ui.shape(if (running) ui.elevated else ui.primary, 28, if (running) ui.border else null), null)
        }
        mainAction.text = if (!paired) "Connect watch" else if (running) "Stop monitoring" else "Start monitoring"
        if (running && notice.text.startsWith("Monitoring requested")) notice.text = ""
        notice.visibility = if (notice.text.isNullOrBlank()) View.GONE else View.VISIBLE
        for ((metric, views) in metricViews) {
            val value = prefs.getString("value_$metric", null)?.toDoubleOrNull()
            val at = prefs.getLong("at_$metric", 0)
            views.value.text = value?.let { if (metric == "skin_temp_celsius" || metric == "hrv_rmssd_ms") String.format(Locale.getDefault(), "%.1f", it) else String.format(Locale.getDefault(), "%,.0f", it) } ?: "--"
            if (metric == "hrv_rmssd_ms") {
                val stress=CareBridge.cache(this).optJSONObject("stress")
                views.value.text=if(stress!=null && !stress.isNull("score")) stress.optInt("score").toString() else "--"
            }
            views.age.text = if (at > 0) "Measured · ${age(at)}" else "No reading yet"
            if(metric=="hrv_rmssd_ms") {
                val measured=CareBridge.cache(this).optJSONObject("stress")?.optString("measured_at")
                val stamp=runCatching { java.time.Instant.parse(measured).toEpochMilli() }.getOrDefault(0)
                views.age.text=if(stamp>0) "Index reference · ${age(stamp)}" else "Learning baseline"
            }
            views.note.text = when {
                value == null -> prefs.getString("status_$metric", when (metric) {
                    "spo2_percent" -> "Take a spot measurement below."
                    "hrv_rmssd_ms" -> "Keep still for valid beat intervals."
                    "skin_temp_celsius" -> "Waiting for skin-sensor access."
                    else -> "Steps recorded during monitoring."
                })
                metric == "skin_temp_celsius" -> "Wrist skin · not core temperature"
                metric == "hrv_rmssd_ms" -> "${value?.let { "HRV ${it.toInt()} ms · " } ?: ""}Experimental · not medical grade. ${if(CareBridge.cache(this).optJSONObject("stress")?.isNull("score")!=false) "Learning your baseline (about 1 hour)." else "Relative to your recent HRV."}"
                metric == "steps_count" -> "During monitoring today"
                else -> "Last spot measurement"
            }
        }
        val gpsAt = prefs.getLong("gps_at", 0)
        locationTitle.text = if (gpsAt == 0L) "Waiting for location" else when(prefs.getString("location_source", "")) {
            "watch_gps" -> "Watch satellite GPS"; "fused" -> "Fused / phone-assisted"; else -> "Network estimate"
        }
        locationDetail.text = if (gpsAt > 0) "${prefs.getString("gps_display", "")}\nMeasured · ${age(gpsAt)}" else "Enable Location on your watch."
        locationStatus.text = if (!running) "Start monitoring to request location." else prefs.getString("gps_status", "Finding your location…")
        val uploaded = prefs.getLong("uploaded_at", 0)
        val queued = prefs.getLong("queued_count", 0)
        syncTitle.text = when { !running -> "Sharing paused"; System.currentTimeMillis() - uploaded < 30_000 -> "Connected to your care app"; else -> "Readings saved on watch" }
        syncDetail.text = "${prefs.getString("connection_status", "Checking internet")}\nLast shared · ${age(uploaded)}\n$queued readings to send" +
            if (running && System.currentTimeMillis() - uploaded > 30_000) "\n${prefs.getString("upload_status", "Waiting for internet.")}" else ""
        sensorHelp.text = "Samsung sensor access\n${prefs.getString("status_sdk", "For skin temperature and HRV, enable Developer mode in Settings → Apps → Health Sensor Service on the watch.")}"
    }
    override fun onResume() {
        super.onResume()
        store.prefs.edit().putBoolean("running", MonitoringService.isMonitoring).apply()
        scroll.post { scroll.fullScroll(View.FOCUS_UP) }
        handler.post(refresh)
        CareBridge.refresh(this)
    }
    override fun onPause() { handler.removeCallbacks(refresh); super.onPause() }
    override fun onDestroy() { handler.removeCallbacks(refresh); executor.shutdown(); super.onDestroy() }
}
