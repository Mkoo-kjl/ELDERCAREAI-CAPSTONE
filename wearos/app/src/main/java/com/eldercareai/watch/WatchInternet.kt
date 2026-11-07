package com.eldercareai.watch

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper

/** Keep saved Wi-Fi available while monitoring, with normal system networking as fallback. */
class WatchInternet(context: Context, private val status: (String) -> Unit, private val changed: () -> Unit) {
    private val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var registered = false
    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            if (!registered) return
            val usable = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            if (usable && WatchApi.preferredNetwork != network) {
                WatchApi.preferredNetwork = network; status("Direct watch Wi-Fi internet"); changed()
            } else if (!usable && WatchApi.preferredNetwork == network) {
                WatchApi.preferredNetwork = null; status("Wi-Fi internet unavailable; trying the system connection"); changed()
            }
        }
        override fun onLost(network: Network) {
            if (!registered) return
            if (WatchApi.preferredNetwork == network) {
                WatchApi.preferredNetwork = null
                if (registered) { status("Wi-Fi disconnected; trying the system connection"); changed() }
            }
        }
    }
    fun start() {
        if (registered) return
        status("Checking watch Wi-Fi / system internet")
        try {
            registered = true
            manager.requestNetwork(NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(), callback, Handler(Looper.getMainLooper()))
        } catch (_: Exception) { registered = false; status("Using the system internet connection") }
    }
    fun stop() {
        val wasRegistered = registered; registered = false; WatchApi.preferredNetwork = null
        if (wasRegistered) runCatching { manager.unregisterNetworkCallback(callback) }
    }
}
