package com.invoiceapp.dev.lock

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.invoiceapp.dev.specs.NativeLockSpec

/**
 * App lock with the phone's own security: fingerprint or face, falling back
 * to the device PIN, pattern or password. The app never stores a PIN.
 */
class LockModule(context: ReactApplicationContext) : NativeLockSpec(context) {

  override fun getName() = NAME

  private val authenticators =
    if (Build.VERSION.SDK_INT >= 30) BIOMETRIC_WEAK or DEVICE_CREDENTIAL else BIOMETRIC_WEAK

  override fun status(promise: Promise) {
    val result = BiometricManager.from(reactApplicationContext).canAuthenticate(authenticators)
    promise.resolve(
      when (result) {
        BiometricManager.BIOMETRIC_SUCCESS -> "available"
        BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "none"
        else -> if (deviceSecure()) "available" else "unsupported"
      },
    )
  }

  private fun deviceSecure(): Boolean {
    val km = reactApplicationContext.getSystemService(android.app.KeyguardManager::class.java)
    return km?.isDeviceSecure == true
  }

  override fun authenticate(title: String, subtitle: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? FragmentActivity
      ?: return promise.reject("E_LOCK", "No activity")
    UiThreadUtil.runOnUiThread {
      val prompt = BiometricPrompt(
        activity,
        ContextCompat.getMainExecutor(activity),
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            promise.resolve(true)
          }

          override fun onAuthenticationError(code: Int, message: CharSequence) {
            promise.resolve(false)
          }
        },
      )
      val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .apply {
          if (Build.VERSION.SDK_INT >= 30) {
            setAllowedAuthenticators(authenticators)
          } else {
            @Suppress("DEPRECATION")
            setDeviceCredentialAllowed(true)
          }
        }
        .build()
      prompt.authenticate(info)
    }
  }

  override fun setSecureRecents(enabled: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    if (Build.VERSION.SDK_INT >= 33) {
      UiThreadUtil.runOnUiThread { activity.setRecentsScreenshotEnabled(!enabled) }
    }
  }

  companion object {
    const val NAME = "NativeLock"
  }
}
