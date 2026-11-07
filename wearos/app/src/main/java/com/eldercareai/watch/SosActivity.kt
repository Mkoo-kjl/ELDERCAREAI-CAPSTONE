package com.eldercareai.watch

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout

/** Compact explicit confirmation for a round watch; opening this screen never sends an SOS. */
class SosActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val ui=WatchUi(this);val content=ui.column()
        ui.add(content,ui.brand());ui.add(content,ui.section("Request assistance"),7)
        ui.add(content,ui.label("Alert your caregiver in ElderCareAI.\nInternet required. No emergency call.",10f,ui.muted),7)
        val row=ui.row();val status=ui.label("",10f,ui.warm).apply { visibility=View.GONE }
        var requested=false
        val send=ui.button("Send SOS",true) {}
        val cancel=ui.button("Cancel") { finish() }
        send.setOnClickListener {
            if(requested)return@setOnClickListener
            if(DeviceStore(this).token()==null){status.text="Pair your watch first.";status.visibility=View.VISIBLE;return@setOnClickListener}
            requested=true;send.isEnabled=false;send.alpha=.55f;cancel.text="Back"
            status.text="Sending request…";status.visibility=View.VISIBLE
            CareBridge.sendSos(this) { message -> if(!isFinishing && !isDestroyed){ status.text=message;send.text="Requested" } }
        }
        row.addView(send,LinearLayout.LayoutParams(0,ui.dp(44),1f))
        row.addView(cancel,LinearLayout.LayoutParams(0,ui.dp(44),1f).apply { marginStart=ui.dp(6) })
        ui.add(content,row,9);ui.add(content,status,8)
        setContentView(ui.page(content))
    }
}
