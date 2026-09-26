package com.invoiceapp.dev.haptics

import android.os.Build
import android.view.HapticFeedbackConstants
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.invoiceapp.dev.specs.NativeHapticsSpec

/**
 * Haptics through View.performHapticFeedback: no VIBRATE permission, and the
 * user's system "touch feedback" setting is always respected. Newer semantic
 * constants are used when available, with the closest older one as fallback.
 */
class HapticsModule(context: ReactApplicationContext) : NativeHapticsSpec(context) {

  override fun getName() = NAME

  override fun perform(kind: String) {
    val constant = constantFor(kind)
    UiThreadUtil.runOnUiThread {
      reactApplicationContext.currentActivity?.window?.decorView?.performHapticFeedback(constant)
    }
  }

  private fun constantFor(kind: String): Int {
    val sdk = Build.VERSION.SDK_INT
    return when (kind) {
      "selection" ->
        if (sdk >= 34) HapticFeedbackConstants.SEGMENT_FREQUENT_TICK
        else HapticFeedbackConstants.CLOCK_TICK
      "light" ->
        if (sdk >= 27) HapticFeedbackConstants.KEYBOARD_PRESS
        else HapticFeedbackConstants.VIRTUAL_KEY
      "medium" -> HapticFeedbackConstants.CONTEXT_CLICK
      "threshold" ->
        if (sdk >= 34) HapticFeedbackConstants.GESTURE_THRESHOLD_ACTIVATE
        else HapticFeedbackConstants.CONTEXT_CLICK
      "success" ->
        if (sdk >= 30) HapticFeedbackConstants.CONFIRM
        else HapticFeedbackConstants.CONTEXT_CLICK
      "warning", "error" ->
        if (sdk >= 30) HapticFeedbackConstants.REJECT
        else HapticFeedbackConstants.LONG_PRESS
      else -> HapticFeedbackConstants.CLOCK_TICK
    }
  }

  companion object {
    const val NAME = "NativeHaptics"
  }
}
