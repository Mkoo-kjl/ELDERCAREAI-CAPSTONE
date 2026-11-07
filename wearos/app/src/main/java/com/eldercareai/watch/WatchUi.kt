package com.eldercareai.watch

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.widget.*

/** ElderCareAI brand tokens and small controls sized for the Watch6 round display. */
class WatchUi(val context: Context) {
    val background = Color.parseColor("#172321")
    val surface = Color.parseColor("#243330")
    val elevated = Color.parseColor("#293936")
    val primary = Color.parseColor("#8BCFD7")
    val sage = Color.parseColor("#B9DDAF")
    val text = Color.parseColor("#F1F6F3")
    val muted = Color.parseColor("#ACBDB6")
    val border = Color.parseColor("#3A4D47")
    val pink = Color.parseColor("#E3A6B6")
    val warm = Color.parseColor("#E3C392")
    val bold = context.resources.getFont(R.font.manrope_bold)
    val medium = context.resources.getFont(R.font.manrope_medium)
    fun dp(value: Int) = (value * context.resources.displayMetrics.density + .5f).toInt()
    fun shape(color: Int, radius: Int = 20, stroke: Int? = null): GradientDrawable = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
        if (stroke != null) setStroke(dp(1), stroke)
    }
    fun label(value: String, size: Float = 11f, color: Int = text, strong: Boolean = false) = TextView(context).apply {
        this.text = value; textSize = size; setTextColor(color); typeface = if (strong) bold else medium
        includeFontPadding = false
    }
    fun column() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    fun row() = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    fun add(parent: LinearLayout, child: View, top: Int = 0, height: Int = LinearLayout.LayoutParams.WRAP_CONTENT) {
        parent.addView(child, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
            if (height < 0) height else dp(height)).apply { topMargin = dp(top) })
    }
    fun card(): LinearLayout = column().apply { background = shape(surface); setPadding(dp(12), dp(12), dp(12), dp(12)) }
    fun section(value: String) = label(value.uppercase(), 9f, muted, true).apply {
        letterSpacing = .12f; gravity = Gravity.CENTER; setPadding(0, dp(5), 0, dp(3))
    }
    fun brand(): View = row().apply {
        gravity = Gravity.CENTER
        addView(ImageView(context).apply {
            setImageResource(R.drawable.brand_logo); contentDescription = "ElderCareAI logo"
            scaleType = ImageView.ScaleType.FIT_CENTER; background = shape(text, 30)
            setPadding(dp(2), dp(2), dp(2), dp(2))
        }, LinearLayout.LayoutParams(dp(26), dp(26)))
        addView(column().apply {
            addView(label("ElderCareAI", 12f, text, true))
            addView(label("WATCH COMPANION", 7f, muted).apply { letterSpacing = .1f; setPadding(0, dp(2), 0, 0) })
        }, LinearLayout.LayoutParams(-2, -2).apply { marginStart = dp(7) })
    }
    fun button(value: String, primaryStyle: Boolean = false, action: () -> Unit) = Button(context).apply {
        text = value; textSize = 11f; typeface = bold; isAllCaps = false
        setTextColor(if (primaryStyle) this@WatchUi.background else this@WatchUi.text)
        background = RippleDrawable(ColorStateList.valueOf(Color.parseColor("#337BC6CE")),
            shape(if (primaryStyle) primary else elevated, 28), null)
        minHeight = dp(44); minimumHeight = dp(44); minWidth = 0; minimumWidth = 0
        setPadding(dp(10), dp(8), dp(10), dp(8)); gravity = Gravity.CENTER
        setOnClickListener { action() }
    }
    fun icon(kind: String, color: Int, size: Int = 20) = ImageView(context).apply {
        setImageResource(when (kind) { "heart" -> R.drawable.ic_pulse; "skin_temp_celsius" -> R.drawable.ic_temperature
            "hrv_rmssd_ms" -> R.drawable.ic_variability; "steps_count" -> R.drawable.ic_steps
            "spo2_percent" -> R.drawable.ic_oxygen; else -> R.drawable.ic_location })
        imageTintList = ColorStateList.valueOf(color)
        layoutParams = LinearLayout.LayoutParams(dp(size), dp(size))
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    fun page(content: LinearLayout): ScrollView = ScrollView(context).apply {
        setBackgroundColor(this@WatchUi.background); isFillViewport = true; isVerticalScrollBarEnabled = true
        overScrollMode = View.OVER_SCROLL_NEVER; clipToPadding = false
        val side = (context.resources.displayMetrics.widthPixels * .09f).toInt()
        content.setPadding(side, dp(18), side, dp(40))
        addView(content)
    }
}
