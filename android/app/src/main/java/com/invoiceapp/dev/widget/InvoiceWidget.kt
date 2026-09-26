package com.invoiceapp.dev.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import org.json.JSONObject

/**
 * Home-screen widget: what's still to be paid, what's overdue, and a
 * one-tap "New invoice". Numbers arrive pre-formatted from the app.
 */
class InvoiceWidget : GlanceAppWidget() {

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
    val data = raw?.let { JSONObject(it) }
    provideContent { Content(context, data) }
  }

  @Composable
  private fun Content(context: Context, data: JSONObject?) {
    val surface = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF18191B))
    val primary = ColorProvider(day = Color(0xFF1C2024), night = Color(0xFFEDEEF0))
    val secondary = ColorProvider(day = Color(0xFF60646C), night = Color(0xFFB0B4BA))
    val danger = ColorProvider(day = Color(0xFFCE2C31), night = Color(0xFFFF9592))
    val accent = ColorProvider(day = Color(0xFF5B5BD6), night = Color(0xFF5B5BD6))
    val onAccent = ColorProvider(day = Color.White, night = Color.White)

    val open = Intent(Intent.ACTION_VIEW, Uri.parse("invoiceapp://inbox/unpaid"))
      .setPackage(context.packageName)
    val create = Intent(Intent.ACTION_VIEW, Uri.parse("invoiceapp://new/invoice"))
      .setPackage(context.packageName)

    Column(
      modifier = GlanceModifier
        .fillMaxSize()
        .background(surface)
        .cornerRadius(24.dp)
        .padding(16.dp)
        .clickable(actionStartActivity(open)),
    ) {
      Text(
        text = data?.optString("outstandingLabel") ?: "",
        style = TextStyle(color = secondary, fontSize = 13.sp),
      )
      Text(
        text = data?.optString("outstanding") ?: "—",
        style = TextStyle(color = primary, fontSize = 26.sp, fontWeight = FontWeight.Bold),
        maxLines = 1,
      )
      Text(
        text = data?.optString("overdue") ?: "",
        style = TextStyle(
          color = if (data?.optString("overdueTone") == "danger") danger else secondary,
          fontSize = 13.sp,
        ),
        maxLines = 1,
      )
      Spacer(GlanceModifier.defaultWeight())
      Box(
        modifier = GlanceModifier
          .fillMaxWidth()
          .height(40.dp)
          .background(accent)
          .cornerRadius(12.dp)
          .clickable(actionStartActivity(create)),
        contentAlignment = Alignment.Center,
      ) {
        Text(
          text = "+  " + (data?.optString("newLabel") ?: "New invoice"),
          style = TextStyle(color = onAccent, fontSize = 14.sp, fontWeight = FontWeight.Medium),
        )
      }
    }
  }

  companion object {
    const val PREFS = "widget"
    const val KEY = "data"
  }
}

class InvoiceWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = InvoiceWidget()
}
