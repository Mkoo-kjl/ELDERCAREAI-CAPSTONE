package com.eldercareai.watch

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.google.android.gms.location.*
import com.google.android.gms.tasks.CancellationTokenSource

/** Hybrid collection. Every fix retains its actual GPS/fused/network source. */
class WatchLocation(private val context: Context, private val onFix: (Location, String) -> Unit, private val onStatus: (String) -> Unit) {
    private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val fused = LocationServices.getFusedLocationProviderClient(context)
    private val handler = Handler(Looper.getMainLooper())
    private val policy = LocationFixPolicy()
    private var active = false
    private var requested = false
    private var generation = 0
    private var requestedAt = 0L
    private var lastSatellite: Long? = null
    private var lastProbeAt = -30_000L
    private var probe: CancellationSignal? = null
    private var probeTimeout: Runnable? = null
    private var fusedProbe: CancellationTokenSource? = null
    private var gps: LocationListener? = null
    private var network: LocationListener? = null
    private var callback: LocationCallback? = null
    private var gnss: GnssStatus.Callback? = null
    private var satelliteStatus = "Waiting for satellites"
    private var providerError = ""
    private val watchdog = object : Runnable {
        override fun run() {
            if (!active) return
            try {
                when {
                    context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED -> {
                        if (requested) stopRequests()
                        onStatus("Allow precise Location for ElderCareAI Watch in watch App permissions.")
                    }
                    !manager.isLocationEnabled -> {
                        if (requested) stopRequests()
                        onStatus("Watch Location is OFF. Enable Location on the watch; tracking resumes automatically.")
                    }
                    else -> {
                        if (!requested) startRequests()
                        val now = SystemClock.elapsedRealtime()
                        if (requested && GpsRecoveryPolicy.restartNeeded(now, requestedAt, lastSatellite)) {
                            stopRequests(); startRequests()
                        }
                        if (requested && GpsRecoveryPolicy.probeNeeded(now, requestedAt, lastSatellite, lastProbeAt)) requestCurrent()
                        publish()
                    }
                }
            } catch (e: Exception) { onStatus("Location needs attention: ${e.message}. Check Location settings.") }
            handler.postDelayed(this, 5_000)
        }
    }
    fun start() {
        stop(); active = true; policy.reset(); lastSatellite = null; lastProbeAt = -30_000
        satelliteStatus = "Waiting for satellites"; providerError = ""
        handler.post(watchdog)
    }
    @SuppressLint("MissingPermission")
    private fun startRequests() {
        requested = true; requestedAt = SystemClock.elapsedRealtime()
        val current = ++generation
        fun listener(source: String) = object : LocationListener {
            override fun onLocationChanged(point: Location) { accept(point, source, current) }
            override fun onProviderDisabled(provider: String) { if (current == generation) publish() }
            override fun onProviderEnabled(provider: String) { if (current == generation) publish() }
        }
        gps = listener("watch_gps"); network = listener("network")
        gnss = object : GnssStatus.Callback() {
            override fun onSatelliteStatusChanged(status: GnssStatus) {
                if (!active || current != generation) return
                val used = (0 until status.satelliteCount).count { status.usedInFix(it) }
                satelliteStatus = "$used / ${status.satelliteCount} satellites used / visible"; publish()
            }
        }
        try { manager.registerGnssStatusCallback(gnss!!, handler) }
        catch (_: Exception) { gnss = null; satelliteStatus = "Satellite count unavailable" }
        try {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1_000L, 0f, gps!!, Looper.getMainLooper())
            manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { accept(it, "watch_gps", current) }
        } catch (e: Exception) { providerError = "Satellite GPS: ${e.message}" }
        try {
            manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2_000L, 0f, network!!, Looper.getMainLooper())
            manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)?.let { accept(it, "network", current) }
        } catch (_: Exception) { network = null }
        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) { result.locations.forEach { accept(it, "fused", current) } }
        }
        try {
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2_000)
                .setMinUpdateIntervalMillis(1_000).setMinUpdateDistanceMeters(0f).setMaxUpdateDelayMillis(0)
                .setMaxUpdateAgeMillis(0).setWaitForAccurateLocation(false).build()
            fused.requestLocationUpdates(request, callback!!, Looper.getMainLooper()).addOnFailureListener {
                if (active && current == generation) { providerError = "Fused location: ${it.message}"; publish() }
            }
            fused.lastLocation.addOnSuccessListener { if (it != null) accept(it, "fused", current) }
        } catch (e: Exception) { providerError = "Fused location: ${e.message}" }
    }
    @SuppressLint("MissingPermission")
    private fun requestCurrent() {
        lastProbeAt = SystemClock.elapsedRealtime()
        val current = generation
        if (probe == null) {
            val signal = CancellationSignal(); probe = signal
            val timeout = Runnable { if (probe === signal) { signal.cancel(); probe = null; probeTimeout = null } }
            probeTimeout = timeout; handler.postDelayed(timeout, 30_000)
            try {
                manager.getCurrentLocation(LocationManager.GPS_PROVIDER, signal, context.mainExecutor) { point ->
                    if (probe === signal) { handler.removeCallbacks(timeout); probe = null; probeTimeout = null }
                    if (point != null) accept(point, "watch_gps", current)
                }
            } catch (_: Exception) { handler.removeCallbacks(timeout); signal.cancel(); probe = null; probeTimeout = null }
        }
        if (fusedProbe == null) {
            val token = CancellationTokenSource(); fusedProbe = token
            try {
                val request = CurrentLocationRequest.Builder().setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                    .setMaxUpdateAgeMillis(0).setDurationMillis(15_000).build()
                fused.getCurrentLocation(request, token.token).addOnSuccessListener { if (it != null) accept(it, "fused", current) }
                    .addOnCompleteListener { if (fusedProbe === token) fusedProbe = null }
            } catch (_: Exception) { token.cancel(); fusedProbe = null }
        }
    }
    private fun accept(point: Location, source: String, current: Int) {
        @Suppress("DEPRECATION")
        if (!active || current != generation || point.isFromMockProvider || !point.hasAccuracy() || source == "watch_gps" && point.provider != LocationManager.GPS_PROVIDER) return
        val now = SystemClock.elapsedRealtime()
        val fix = LocationFixPolicy.Fix(point.latitude, point.longitude, point.accuracy, point.elapsedRealtimeNanos / 1_000_000, source)
        if (source == "watch_gps" && now - fix.elapsed in 0..30_000) lastSatellite = fix.elapsed
        if (!policy.accept(fix, now)) return
        providerError = ""; onFix(Location(point), source); publish()
    }
    private fun publish() {
        if (!active) return
        val point = policy.latest
        val age = point?.let { (SystemClock.elapsedRealtime() - it.elapsed) / 1000 }
        val source = when (point?.source) { "watch_gps" -> "Watch satellite GPS"; "network" -> "Network location estimate"; else -> "Fused location (may use paired phone)" }
        val message = if (point != null && age != null && age < 15) "$source · ${age}s ago · ±${point.accuracy.toInt()}m. $satelliteStatus"
            else "Finding a fresh location. $satelliteStatus. ${if (providerError.isNotBlank()) providerError else "Enable Location on the watch and paired phone for hybrid estimates."}"
        onStatus(message.take(240))
    }
    private fun stopRequests() {
        generation++; requested = false
        probe?.cancel(); probe = null; probeTimeout?.let { handler.removeCallbacks(it) }; probeTimeout = null
        fusedProbe?.cancel(); fusedProbe = null
        gps?.let { runCatching { manager.removeUpdates(it) } }; gps = null
        network?.let { runCatching { manager.removeUpdates(it) } }; network = null
        gnss?.let { runCatching { manager.unregisterGnssStatusCallback(it) } }; gnss = null
        callback?.let { runCatching { fused.removeLocationUpdates(it) } }; callback = null
    }
    fun stop() { active = false; handler.removeCallbacks(watchdog); stopRequests() }
}
