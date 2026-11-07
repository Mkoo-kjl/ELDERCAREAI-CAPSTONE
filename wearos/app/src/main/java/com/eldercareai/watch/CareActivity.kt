package com.eldercareai.watch

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class CareActivity : Activity() {
    private var scroll: android.widget.ScrollView? = null
    private val handler=Handler(Looper.getMainLooper())
    private val ticker=object:Runnable { override fun run(){ render(); handler.postDelayed(this,5000) } }
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); render(); CareBridge.refresh(this,{ render() }) }
    private fun render() {
        if(isFinishing || isDestroyed) return
        val previousY=scroll?.scrollY ?: 0
        val ui=WatchUi(this); val content=ui.column()
        ui.add(content,ui.brand()); ui.add(content,ui.section("Medications"),8)
        val prefs=DeviceStore(this).prefs
        ui.add(content,ui.label(prefs.getString("care_status","Schedule updates while monitoring is running.") ?: "",10f,ui.muted),7)
        val doses=CareBridge.doses(this).filter { it.at<=Instant.now().plusSeconds(86400) }.take(12)
        if(doses.isEmpty()) ui.add(content,ui.label("No scheduled doses available. Add medications in the phone app, then refresh.",11f,ui.muted),8)
        for(dose in doses) {
            val card=ui.card(); ui.add(card,ui.label(dose.medication.name,13f,ui.text,true))
            val clock=DateTimeFormatter.ofPattern("EEE h:mm a").withZone(ZoneId.systemDefault()).format(dose.at)
            ui.add(card,ui.label("${dose.medication.dosage} · $clock",10f,ui.muted),4)
            when {
                CareBridge.isTaken(this,dose)->ui.add(card,ui.label("✓ Taken · saved in care app",10f,ui.sage),6)
                CareBridge.pending(this,dose)->ui.add(card,ui.label("Confirmation waiting to sync",10f,ui.warm),6)
                dose.at<=Instant.now().plusSeconds(300)->ui.add(card,ui.button("Taken",true) { CareBridge.taken(this,dose) { render() }; render() },7)
                else->ui.add(card,ui.label("Upcoming dose",10f,ui.muted),6)
            }
            ui.add(content,card,8)
        }
        ui.add(content,ui.button("Refresh schedule") { CareBridge.refresh(this,{ render() },true) },8)
        ui.add(content,ui.label("Taken records your confirmation. Check your medication instructions before taking a dose.",9f,ui.muted),10)
        ui.add(content,ui.button("Back") { finish() },8)
        val page=ui.page(content); scroll=page; setContentView(page); page.post { page.scrollTo(0,previousY) }
    }
    override fun onResume(){super.onResume();handler.postDelayed(ticker,5000)}
    override fun onPause(){handler.removeCallbacks(ticker);super.onPause()}
}
