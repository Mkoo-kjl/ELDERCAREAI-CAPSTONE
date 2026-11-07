package com.eldercareai.watch

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/** Durable per-device outbox. Only server-acknowledged IDs are deleted. */
class SampleQueue(context: Context) : SQLiteOpenHelper(context, "watch-samples.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE samples (id TEXT PRIMARY KEY, device TEXT NOT NULL, metric TEXT NOT NULL, measured INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(device,metric,measured))")
        db.execSQL("CREATE INDEX samples_device_time ON samples(device,measured)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    fun add(device: String, metric: String, value: Double, measured: Long) {
        val id = UUID.randomUUID().toString()
        val json = JSONObject().put("id", id).put("metric", metric).put("value", value)
            .put("measured_at", Instant.ofEpochMilli(measured).toString())
        val values = ContentValues().apply {
            put("id", id); put("device", device); put("metric", metric); put("measured", measured); put("payload", json.toString())
        }
        writableDatabase.insertWithOnConflict("samples", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }
    fun batch(device: String, limit: Int = 120): JSONArray {
        val result = JSONArray()
        // Include each metric's newest point first, then drain older backlog. New live readings
        // stay responsive while every older event is retained for history.
        readableDatabase.rawQuery("SELECT payload FROM samples WHERE device=? ORDER BY id IN (SELECT id FROM samples WHERE device=? GROUP BY metric HAVING measured=MAX(measured)) DESC, measured ASC LIMIT ?",
            arrayOf(device, device, limit.toString())).use { cursor ->
            while (cursor.moveToNext()) result.put(JSONObject(cursor.getString(0)))
        }
        return result
    }
    fun acknowledge(device: String, ids: JSONArray) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (index in 0 until ids.length()) db.delete("samples", "device=? AND id=?", arrayOf(device, ids.getString(index)))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }
    fun count(device: String): Long = readableDatabase.rawQuery("SELECT COUNT(*) FROM samples WHERE device=?", arrayOf(device)).use {
        it.moveToFirst(); it.getLong(0)
    }
}
