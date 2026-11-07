package com.eldercareai.watch

import org.json.JSONObject
import android.net.Network
import java.net.HttpURLConnection
import java.net.URL

object WatchApi {
    @Volatile var preferredNetwork: Network? = null
    class Error(val status: Int, message: String): IllegalStateException(message)
    fun post(body: JSONObject, token: String? = null): JSONObject {
        val url = URL("${BuildConfig.SUPABASE_URL}/functions/v1/galaxy-watch")
        val connection = (preferredNetwork?.openConnection(url) ?: url.openConnection()) as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val result = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
            val json = try { JSONObject(result) } catch (_: Exception) { JSONObject() }
            if (code !in 200..299) throw Error(code,json.optString("error", "Upload failed ($code). Check the backend deployment."))
            return json
        } finally { connection.disconnect() }
    }
}
