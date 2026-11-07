package com.eldercareai.watch

/** One spot tracker on an existing Samsung connection. Old callbacks cannot end a newer attempt. */
class SpotOxygenSession(private val port: Port) {
    interface Port {
        fun pauseContinuous()
        fun startSpot(result: (Int, Long) -> Unit, error: (String) -> Unit)
        fun stopSpot()
        fun resumeContinuous()
    }
    var active = false; private set
    var attempt = 0L; private set
    private var failure: ((String) -> Unit)? = null
    fun start(result: (Int, Long) -> Unit, error: (String) -> Unit): Boolean {
        if (active) return false
        val current = ++attempt
        active = true; failure = error
        try {
            port.pauseContinuous()
            port.startSpot({ value, measured ->
                if (active && current == attempt) { finish(); result(value, measured) }
            }, { message -> fail(current, message) })
        } catch (exception: Exception) { fail(current, exception.message ?: "Unable to start blood oxygen.") }
        return true
    }
    fun fail(current: Long, message: String) {
        if (!active || current != attempt) return
        val callback = failure
        finish(); callback?.invoke(message)
    }
    fun cancel() { if (active) finish() }
    private fun finish() {
        active = false; failure = null
        try { port.stopSpot() } finally { port.resumeContinuous() }
    }
}
