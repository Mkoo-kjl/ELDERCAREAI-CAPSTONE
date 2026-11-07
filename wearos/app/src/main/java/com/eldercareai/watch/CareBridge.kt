package com.eldercareai.watch

import android.Manifest
import android.app.*
import android.app.job.*
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.*
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** A separate durable action outbox keeps SOS and dose confirmations independent of vital batches. */
object CareBridge {
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val handler = Handler(Looper.getMainLooper())
    private fun store(context: Context) = DeviceStore(context.applicationContext)
    private fun device(context: Context) = store(context).prefs.getString("device_id", "") ?: ""
    @Synchronized private fun actions(context: Context) = JSONArray(store(context).prefs.getString("care_outbox", "[]"))
    @Synchronized private fun queue(context: Context, action: JSONObject) {
        val rows = actions(context); rows.put(action.put("device", device(context)))
        check(store(context).prefs.edit().putString("care_outbox", rows.toString()).commit()) { "Watch storage unavailable. Action was not saved." }
        val jobs=context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
        jobs.schedule(JobInfo.Builder(7201,ComponentName(context,CareRetryJob::class.java)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPersisted(true).setBackoffCriteria(30_000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).build())
    }
    @Synchronized private fun remove(context: Context, id: String) {
        val rows = actions(context); val keep = JSONArray()
        for (i in 0 until rows.length()) if (rows.getJSONObject(i).getJSONObject("payload").getString("id") != id) keep.put(rows.getJSONObject(i))
        check(store(context).prefs.edit().putString("care_outbox", keep.toString()).commit())
    }
    fun pending(context: Context, dose: MedicationPlan.Dose): Boolean {
        val rows = actions(context)
        return (0 until rows.length()).any { val row=rows.getJSONObject(it); val payload=row.getJSONObject("payload")
            row.optString("device")==device(context) && payload.optString("schedule_id")==dose.medication.id && payload.optString("scheduled_time")==dose.at.toString() }
    }
    fun hasPending(context: Context): Boolean { val rows=actions(context); return (0 until rows.length()).any { rows.getJSONObject(it).optString("device")==device(context) } }
    fun sendSos(context: Context, done: (String)->Unit) {
        try {
            queue(context, JSONObject().put("operation","sos").put("payload",JSONObject().put("id",UUID.randomUUID().toString())))
            status(context,"SOS saved on watch; sending to caregiver…")
            refresh(context, done, true)
        } catch (e: Exception) { done(e.message ?: "SOS not saved. Contact your caregiver directly.") }
    }
    fun taken(context: Context, dose: MedicationPlan.Dose, done: (String)->Unit = {}) {
        try {
            if (!pending(context,dose)) queue(context,JSONObject().put("operation","medication_taken").put("payload",JSONObject()
                .put("id",UUID.randomUUID().toString()).put("schedule_id",dose.medication.id).put("scheduled_time",dose.at.toString())
                .put("taken_at",Instant.now().toString()).put("timezone",ZoneId.systemDefault().id)))
            notify(context,dose,"Confirmation pending — reconnecting",false)
            refresh(context,done,true)
        } catch (e: Exception) { done(e.message ?: "Dose was not recorded.") }
    }
    private fun status(context: Context, value: String) { store(context).prefs.edit().putString("care_status",value).apply() }
    fun refresh(context: Context, done: (String)->Unit = {}, userAction: Boolean = false) {
        val app = context.applicationContext
        if (!userAction && !busy.compareAndSet(false,true)) return
        worker.execute {
            var savedMessage: String? = null
            try {
                val current = device(app); val token=store(app).token() ?: throw IllegalStateException("Pair the watch first.")
                val rows=actions(app)
                val ordered=(0 until rows.length()).map { rows.getJSONObject(it) }.filter { it.optString("device")==current }
                    .sortedBy { if(it.optString("operation")=="sos") 0 else 1 }
                for (row in ordered) {
                    val payload=row.getJSONObject("payload"); val operation=row.getString("operation")
                    try {
                        WatchApi.post(JSONObject().put("action","care").put("operation",operation).put("payload",payload),token)
                        remove(app,payload.getString("id"))
                        if(device(app)!=current) { handler.post { done("Watch pairing changed. Open the dashboard.") }; return@execute }
                        if(operation=="sos" || savedMessage==null) savedMessage=if(operation=="sos") "SOS saved for your caregiver. This does not call emergency services." else "Taken confirmation saved in your care app."
                        status(app,savedMessage!!)
                        if(operation=="medication_taken") {
                            val key="${payload.getString("schedule_id")}:${Instant.parse(payload.getString("scheduled_time")).epochSecond}"
                            val prefs=store(app).prefs; val confirmed=(prefs.getStringSet("care_confirmed_$current",emptySet()) ?: emptySet())+key
                            prefs.edit().putStringSet("care_confirmed_$current",confirmed.filter { (it.substringAfterLast(':').toLongOrNull() ?: 0)>Instant.now().epochSecond-172800 }.toSet()).commit()
                            cancelNotification(app,key)
                        }
                    } catch(e: WatchApi.Error) {
                        if(e.status==400 && operation=="medication_taken") {
                            remove(app,payload.getString("id")); status(app,"Dose not recorded: schedule changed or confirmation expired. Check the care app.")
                        } else throw e
                    }
                }
                val response=WatchApi.post(JSONObject().put("action","care").put("operation","sync").put("payload",JSONObject()),token)
                if(device(app)!=current) { handler.post { done("Watch pairing changed. Open the dashboard.") }; return@execute }
                store(app).prefs.edit().putString("care_cache_$current",response.toString()).putLong("care_synced_at",System.currentTimeMillis()).apply()
                schedule(app)
                if(!hasPending(app)) (app.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).cancel(7201)
                handler.post { done(store(app).prefs.getString("care_status","Medication schedule updated.") ?: "Medication schedule updated.") }
            } catch(e: Exception) {
                val message=savedMessage?.let { "$it Other updates are waiting to refresh." }
                    ?: if(hasPending(app)) "Action waiting for internet. Not confirmed by caregiver app yet." else "Schedule refresh pending. Check watch internet and pairing."
                status(app,message); handler.post { done(message) }
            } finally { if(!userAction) busy.set(false) }
        }
    }
    fun cache(context: Context): JSONObject = try { JSONObject(store(context).prefs.getString("care_cache_${device(context)}","{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    fun doses(context: Context): List<MedicationPlan.Dose> {
        val rows=cache(context).optJSONArray("medications") ?: JSONArray()
        val meds=(0 until rows.length()).mapNotNull { try {
            val row=rows.getJSONObject(it); val times=row.optJSONArray("times_of_day") ?: JSONArray()
            MedicationPlan.Medication(row.getString("id"),row.getString("medication_name"),row.optString("dosage").takeUnless { it=="null" } ?: "",
                row.getString("frequency"),(0 until times.length()).map { times.getString(it) },LocalDate.parse(row.getString("start_date")),
                row.optString("end_date").takeUnless { it.isBlank() || it=="null" }?.let { LocalDate.parse(it) },row.optBoolean("reminder_enabled",true))
        }catch (_: Exception) { null } }
        return MedicationPlan.doses(meds,Instant.now(),ZoneId.systemDefault())
    }
    fun isTaken(context: Context, dose: MedicationPlan.Dose): Boolean {
        if(dose.key in (store(context).prefs.getStringSet("care_confirmed_${device(context)}",emptySet()) ?: emptySet())) return true
        val rows=cache(context).optJSONArray("taken_doses") ?: JSONArray()
        return (0 until rows.length()).any { val row=rows.getJSONObject(it)
            row.optString("schedule_id")==dose.medication.id && runCatching { Instant.parse(row.getString("scheduled_time"))==dose.at }.getOrDefault(false) }
    }
    private fun intent(context: Context, key: String, action: String): PendingIntent = PendingIntent.getBroadcast(context,0,
        Intent(context,CareReceiver::class.java).setAction(action).setData(Uri.parse("eldercare://dose/${device(context)}/$key"))
            .putExtra("key",key).putExtra("device",device(context)),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun schedule(context: Context) {
        val alarms=context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs=store(context).prefs
        val old=prefs.getStringSet("care_alarm_keys",emptySet()) ?: emptySet()
        val desired=doses(context).filter { it.medication.reminders && !isTaken(context,it) && !pending(context,it) && it.at>=Instant.now().minusSeconds(900) }
        val keys=desired.map { it.key }.toSet()
        (old-keys).forEach { alarms.cancel(intent(context,it,"REMIND")); cancelNotification(context,it) }
        val notified=prefs.getStringSet("care_notified_keys",emptySet()) ?: emptySet()
        for(dose in desired) {
            if(dose.key in notified) continue
            val at=maxOf(System.currentTimeMillis()+1000,dose.at.toEpochMilli())
            if(Build.VERSION.SDK_INT<31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(context,dose.key,"REMIND"))
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(context,dose.key,"REMIND"))
        }
        prefs.edit().putStringSet("care_alarm_keys",keys).putStringSet("care_notified_keys",notified.intersect(keys)).apply()
    }
    fun remind(context: Context, key: String) {
        val dose=doses(context).find { it.key==key } ?: return
        if(isTaken(context,dose) || pending(context,dose)) return
        val prefs=store(context).prefs; val sent=(prefs.getStringSet("care_notified_keys",emptySet()) ?: emptySet())+key
        prefs.edit().putStringSet("care_notified_keys",sent).apply()
        notify(context,dose,"Time for ${dose.medication.name} ${dose.medication.dosage}",true)
        schedule(context)
    }
    private fun cancelNotification(context: Context,key: String) { (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(key,2) }
    private fun notify(context: Context,dose: MedicationPlan.Dose,message: String,canTake: Boolean) {
        if(Build.VERSION.SDK_INT>=33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) {
            status(context,"Allow Notifications in App permissions to receive medication reminders."); return
        }
        val manager=context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel("watch-medications-v1","Medication reminders",NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true) })
        val open=PendingIntent.getActivity(context,0,Intent(context,CareActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification=Notification.Builder(context,"watch-medications-v1").setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Medication reminder").setContentText(message.trim()).setStyle(Notification.BigTextStyle().bigText(message.trim()))
            .setContentIntent(open).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER)
        if(canTake) notification.addAction(android.R.drawable.checkbox_on_background,"Taken",intent(context,dose.key,"TAKEN"))
        manager.notify(dose.key,2,notification.build())
    }
}

class CareReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if(intent.action in listOf(Intent.ACTION_BOOT_COMPLETED,Intent.ACTION_TIMEZONE_CHANGED,Intent.ACTION_TIME_CHANGED)) { CareBridge.schedule(context); CareBridge.refresh(context); return }
        if(intent.getStringExtra("device")!=DeviceStore(context).prefs.getString("device_id","")) return
        val key=intent.getStringExtra("key") ?: return
        if(intent.action=="REMIND") CareBridge.remind(context,key)
        else if(intent.action=="TAKEN") {
            val dose=CareBridge.doses(context).find { it.key==key } ?: return
            val pending=goAsync(); val finished=AtomicBoolean(false)
            val finish={ if(finished.compareAndSet(false,true)) pending.finish() }
            Handler(Looper.getMainLooper()).postDelayed({ finish() },18_000)
            CareBridge.taken(context,dose) { finish() }
        }
    }
}

class CareRetryJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        CareBridge.refresh(this,{ jobFinished(params,CareBridge.hasPending(this)) },true)
        return true
    }
    override fun onStopJob(params: JobParameters)=true
}
