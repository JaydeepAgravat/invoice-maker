package com.invoiceapp.dev.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.Promise
import androidx.glance.appwidget.updateAll
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.invoiceapp.dev.specs.NativeWidgetSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class WidgetModule(context: ReactApplicationContext) : NativeWidgetSpec(context) {

  override fun getName() = NAME

  override fun update(data: ReadableMap) {
    val json = JSONObject()
    for (key in listOf("outstandingLabel", "outstanding", "overdue", "overdueTone", "newLabel")) {
      json.put(key, data.getString(key) ?: "")
    }
    val ctx = reactApplicationContext.applicationContext
    ctx.getSharedPreferences(InvoiceWidget.PREFS, Context.MODE_PRIVATE)
      .edit().putString(InvoiceWidget.KEY, json.toString()).apply()
    CoroutineScope(Dispatchers.Default).launch {
      runCatching { InvoiceWidget().updateAll(ctx) }
    }
  }

  override fun requestPin(promise: Promise) {
    val ctx = reactApplicationContext
    val manager = AppWidgetManager.getInstance(ctx)
    if (!manager.isRequestPinAppWidgetSupported) {
      promise.resolve(false)
      return
    }
    promise.resolve(manager.requestPinAppWidget(ComponentName(ctx, InvoiceWidgetReceiver::class.java), null, null))
  }

  companion object {
    const val NAME = "NativeWidget"
  }
}
