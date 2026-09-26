package com.invoiceapp.dev.reminders

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.invoiceapp.dev.R
import com.invoiceapp.dev.specs.NativeRemindersSpec
import org.json.JSONArray
import org.json.JSONObject

/**
 * Local reminders (overdue invoices, recurring invoices ready to send).
 * The set is kept in preferences so a reboot receiver can re-arm it; the
 * alarms are inexact on purpose: no exact-alarm permission, battery-friendly.
 */
class RemindersModule(context: ReactApplicationContext) : NativeRemindersSpec(context) {

  override fun getName() = NAME

  override fun setAll(reminders: ReadableArray, promise: Promise) {
    val ctx = reactApplicationContext
    val list = JSONArray()
    for (i in 0 until reminders.size()) {
      val r = reminders.getMap(i) ?: continue
      list.put(
        JSONObject()
          .put("id", r.getString("id"))
          .put("at", r.getDouble("at").toLong())
          .put("title", r.getString("title"))
          .put("body", r.getString("body"))
          .put("url", r.getString("url")),
      )
    }
    Scheduler.cancelAll(ctx)
    Scheduler.store(ctx, list)
    Scheduler.armAll(ctx)
    promise.resolve(null)
  }

  override fun enabled(promise: Promise) {
    promise.resolve(NotificationManagerCompat.from(reactApplicationContext).areNotificationsEnabled())
  }

  companion object {
    const val NAME = "NativeReminders"
  }
}

object Scheduler {
  private const val PREFS = "reminders"
  private const val KEY = "items"
  const val CHANNEL = "reminders"

  fun store(ctx: Context, list: JSONArray) =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, list.toString()).apply()

  private fun load(ctx: Context): JSONArray =
    JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"))

  private fun intentFor(ctx: Context, item: JSONObject): PendingIntent {
    val intent = Intent(ctx, ReminderReceiver::class.java).apply {
      action = "com.invoiceapp.REMINDER"
      putExtra("item", item.toString())
    }
    return PendingIntent.getBroadcast(
      ctx,
      item.getString("id").hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun armAll(ctx: Context) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val list = load(ctx)
    val now = System.currentTimeMillis()
    for (i in 0 until list.length()) {
      val item = list.getJSONObject(i)
      val at = item.getLong("at")
      if (at < now - 60_000) continue
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intentFor(ctx, item))
    }
  }

  fun cancelAll(ctx: Context) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val list = load(ctx)
    for (i in 0 until list.length()) alarms.cancel(intentFor(ctx, list.getJSONObject(i)))
  }

  fun show(ctx: Context, item: JSONObject) {
    val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL) == null) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL,
          ctx.getString(R.string.reminders_channel),
          NotificationManager.IMPORTANCE_DEFAULT,
        ),
      )
    }
    val open = Intent(Intent.ACTION_VIEW, Uri.parse(item.getString("url"))).apply {
      setPackage(ctx.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val tap = PendingIntent.getActivity(
      ctx,
      item.getString("id").hashCode(),
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setColor(0xFF3E63DD.toInt())
      .setContentTitle(item.getString("title"))
      .setContentText(item.getString("body"))
      .setStyle(NotificationCompat.BigTextStyle().bigText(item.getString("body")))
      .setContentIntent(tap)
      .setAutoCancel(true)
      .build()
    if (NotificationManagerCompat.from(ctx).areNotificationsEnabled()) {
      manager.notify(item.getString("id").hashCode(), notification)
    }
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Scheduler.armAll(context)
      else -> intent.getStringExtra("item")?.let { Scheduler.show(context, JSONObject(it)) }
    }
  }
}
