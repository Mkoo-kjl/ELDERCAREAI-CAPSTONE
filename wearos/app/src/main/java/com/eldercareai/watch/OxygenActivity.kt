package com.eldercareai.watch

import android.app.Activity
import android.content.Intent
import android.content.ComponentName
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.content.res.ColorStateList
import android.view.View
import android.widget.ProgressBar
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Switch

/** SpO2 is an explicit, foreground-only spot check, capped at 30 seconds. */
class OxygenActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var reading: TextView
    private lateinit var measureButton: Button
    private lateinit var progress: ProgressBar
    private lateinit var countdown: TextView
    private var startedAt = 0L
    private var automatic = false
    private lateinit var autoToggle: Switch
    private val nextCheck = Runnable { if(automatic && !isFinishing) begin() }
    private val tick = object : Runnable {
        override fun run() {
            if (!measuring) return
            val remaining = (30 - (SystemClock.elapsedRealtime() - startedAt) / 1000).coerceAtLeast(0).toInt()
            progress.progress = remaining
            countdown.text = "$remaining seconds remaining"
            handler.postDelayed(this, 1000)
        }
    }
    private lateinit var store: DeviceStore
    private var monitoring: MonitoringService? = null
    private var bound = false
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            monitoring = (binder as MonitoringService.LocalBinder).monitoringService
            measureButton.isEnabled = MonitoringService.isMonitoring
            measureButton.alpha = if (measureButton.isEnabled) 1f else .55f
            if (!MonitoringService.isMonitoring) status.text = "Start monitoring on the dashboard first."
            else if(automatic) begin()
        }
        override fun onServiceDisconnected(name: ComponentName) {
            monitoring = null
            automatic=false; autoToggle.isChecked=false; handler.removeCallbacks(nextCheck)
            if (measuring) finishMeasurement("Monitoring stopped. Return to the dashboard and start again.")
        }
    }
    private val handler = Handler(Looper.getMainLooper())
    private var measuring = false
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = DeviceStore(this)
        val ui = WatchUi(this)
        val layout = ui.column()
        ui.add(layout, ui.brand())
        ui.add(layout, ui.section("Blood oxygen"), 7)
        val card = ui.card().apply { gravity = Gravity.CENTER_HORIZONTAL; setPadding(ui.dp(10), ui.dp(5), ui.dp(10), ui.dp(7)) }
        reading = ui.label("--", 32f, ui.text, true)
        ui.add(card, reading, 7)
        reading.gravity = Gravity.CENTER
        ui.add(card, ui.label("SpO₂  %", 11f, ui.primary).apply { gravity = Gravity.CENTER }, 2)
        status = ui.label("Rest your arm on a table. Keep the watch snug and hold still for a spot measurement.", 11f, ui.muted).apply { gravity = Gravity.CENTER }
        countdown = ui.label("", 10f, ui.sage).apply { gravity = Gravity.CENTER; visibility = View.GONE }
        ui.add(card, countdown, 9)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 30; this.progress = 30; progressTintList = ColorStateList.valueOf(ui.primary)
            progressBackgroundTintList = ColorStateList.valueOf(ui.border); visibility = View.GONE
        }
        ui.add(card, progress, 7, 4)
        ui.add(layout, card, 6)
        measureButton = ui.button("Measure blood oxygen", true) { begin() }
        measureButton.isEnabled = false
        ui.add(layout, measureButton, 8)
        autoToggle=Switch(this).apply {
            text="Auto checks · every 5 min"; textSize=10f; setTextColor(ui.text)
            setOnCheckedChangeListener { _, enabled ->
                automatic=enabled; handler.removeCallbacks(nextCheck)
                if(enabled) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    if(monitoring!=null) begin()
                } else if(!measuring) window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
        ui.add(layout,autoToggle,10)
        ui.add(layout, status, 10)
        ui.add(layout, ui.button("Back to dashboard") { finish() }, 8)
        ui.add(layout, ui.label("Auto checks require this screen to stay open and keep the screen on. Each check pauses heart-rate, HRV and skin-temperature collection for up to 30 seconds. Leaving stops auto checks. Not overnight or continuous SpO₂.", 9f, ui.muted).apply { gravity = Gravity.CENTER }, 12)
        setContentView(ui.page(layout))
    }

    private fun begin() {
        if (measuring) return
        handler.removeCallbacks(nextCheck)
        val service = monitoring
        if (!MonitoringService.isMonitoring || service == null) { autoToggle.isChecked=false; status.text = "Start monitoring on the dashboard first."; return }
        measuring = true; startedAt = SystemClock.elapsedRealtime()
        measureButton.isEnabled = false; measureButton.alpha = .55f
        reading.text = "--"; countdown.visibility = View.VISIBLE; progress.visibility = View.VISIBLE
        handler.post(tick)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        status.text = "Hold still. Measuring blood oxygen…"
        service.beginOxygen({ value, _ ->
            if (measuring && !isFinishing) {
                reading.text = value.toString()
                finishMeasurement("Measurement saved. Your care app will receive it during monitoring.")
            }
        }, { message -> if (measuring && !isFinishing) finishMeasurement(message) })
    }
    private fun finishMeasurement(message: String? = null) {
        val wasMeasuring = measuring
        measuring = false; handler.removeCallbacks(tick)
        if (wasMeasuring) monitoring?.cancelOxygen()
        measureButton.isEnabled = monitoring != null && MonitoringService.isMonitoring
        measureButton.alpha = if (measureButton.isEnabled) 1f else .55f
        countdown.visibility = View.GONE; progress.visibility = View.GONE
        if(!automatic) window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if(automatic && monitoring!=null && MonitoringService.isMonitoring) handler.postDelayed(nextCheck,5*60_000L)
        if (message != null) status.text = message
    }
    override fun onStart() {
        super.onStart()
        bound = bindService(Intent(this, MonitoringService::class.java), connection, 0)
        if (!bound) status.text = "Start monitoring on the dashboard first."
    }
    override fun onPause() { automatic=false; autoToggle.isChecked=false; handler.removeCallbacks(nextCheck); finishMeasurement(); super.onPause() }
    override fun onStop() {
        if (bound) { unbindService(connection); bound = false }; monitoring = null
        super.onStop()
    }
}
