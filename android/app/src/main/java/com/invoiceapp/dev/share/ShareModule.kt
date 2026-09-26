package com.invoiceapp.dev.share

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Telephony
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.invoiceapp.dev.specs.NativeShareSpec
import java.io.File

/**
 * Hands generated files to other apps: WhatsApp (straight to the chat when a
 * phone number is known), email apps only, the default SMS app, or the system
 * share sheet. Also saves copies to Downloads without any storage permission.
 */
class ShareModule(context: ReactApplicationContext) :
  NativeShareSpec(context), ActivityEventListener {

  private var pendingSave: Pair<File, Promise>? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName() = NAME

  private val authority get() = reactApplicationContext.packageName + ".files"

  private fun installed(pkg: String): Boolean =
    try {
      reactApplicationContext.packageManager.getPackageInfo(pkg, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }

  override fun availableTargets(promise: Promise) {
    val pm = reactApplicationContext.packageManager
    val out = Arguments.createArray()
    if (installed(WHATSAPP)) out.pushString("whatsapp")
    if (installed(WHATSAPP_BUSINESS)) out.pushString("whatsapp_business")
    val mail = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"))
    if (pm.queryIntentActivities(mail, 0).isNotEmpty()) out.pushString("email")
    if (Telephony.Sms.getDefaultSmsPackage(reactApplicationContext) != null) out.pushString("sms")
    promise.resolve(out)
  }

  override fun share(request: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_SHARE", "No activity")
      return
    }
    try {
      val file = File(request.getString("path") ?: "")
      val uri = FileProvider.getUriForFile(reactApplicationContext, authority, file)
      val mime = request.getString("mime") ?: "application/pdf"
      val subject = request.getString("subject") ?: ""
      val text = request.getString("text") ?: ""
      val phone = (request.getString("phone") ?: "").filter { it.isDigit() }
      val emails = request.getArray("emails")?.toArrayList()?.map { it.toString() } ?: emptyList()

      val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        clipData = ClipData.newRawUri(file.name, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (text.isNotEmpty()) putExtra(Intent.EXTRA_TEXT, text)
        if (subject.isNotEmpty()) putExtra(Intent.EXTRA_SUBJECT, subject)
      }

      val intent = when (request.getString("target")) {
        "whatsapp", "whatsapp_business" -> send.apply {
          setPackage(if (request.getString("target") == "whatsapp") WHATSAPP else WHATSAPP_BUSINESS)
          // Opens the chat with this number directly when it is on WhatsApp.
          if (phone.length >= 8) putExtra("jid", "$phone@s.whatsapp.net")
        }
        "email" -> send.apply {
          if (emails.isNotEmpty()) putExtra(Intent.EXTRA_EMAIL, emails.toTypedArray())
          // Only email apps: the selector limits the chooser to mailto handlers.
          selector = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"))
        }
        "sms" -> send.apply {
          Telephony.Sms.getDefaultSmsPackage(reactApplicationContext)?.let { setPackage(it) }
          if (phone.isNotEmpty()) putExtra("address", phone)
          if (text.isNotEmpty()) putExtra("sms_body", text)
        }
        else -> Intent.createChooser(send, request.getString("chooserTitle") ?: "").apply {
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      }
      activity.startActivity(intent)
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.reject("E_NO_APP", e)
    } catch (e: Exception) {
      promise.reject("E_SHARE", e)
    }
  }

  override fun saveToDownloads(path: String, name: String, mime: String, promise: Promise) {
    val source = File(path)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        val resolver = reactApplicationContext.contentResolver
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, name)
          put(MediaStore.Downloads.MIME_TYPE, mime)
          put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: throw IllegalStateException("Could not create the file")
        resolver.openOutputStream(uri)!!.use { out -> source.inputStream().use { it.copyTo(out) } }
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        // MediaStore may rename on conflict ("name (1).pdf"); report the real name.
        val finalName = resolver.query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)
          ?.use { c -> if (c.moveToFirst()) c.getString(0) else null } ?: name
        promise.resolve(
          Arguments.createMap().apply {
            putString("uri", uri.toString())
            putString("name", finalName)
          },
        )
      } catch (e: Exception) {
        promise.reject("E_SAVE", e)
      }
      return
    }
    // Android 8–9: let the person pick where to save (no storage permission).
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_SAVE", "No activity")
      return
    }
    pendingSave = source to promise
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = mime
      putExtra(Intent.EXTRA_TITLE, name)
    }
    activity.startActivityForResult(intent, REQUEST_SAVE)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_SAVE) return
    val (source, promise) = pendingSave ?: return
    pendingSave = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      promise.reject("E_CANCELLED", "Cancelled")
      return
    }
    try {
      reactApplicationContext.contentResolver.openOutputStream(uri)!!.use { out ->
        source.inputStream().use { it.copyTo(out) }
      }
      promise.resolve(
        Arguments.createMap().apply {
          putString("uri", uri.toString())
          putString("name", source.name)
        },
      )
    } catch (e: Exception) {
      promise.reject("E_SAVE", e)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun open(uri: String, mime: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    try {
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(Uri.parse(uri), mime)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      (activity ?: reactApplicationContext).startActivity(
        if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) else intent,
      )
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.resolve(false)
    }
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeShare"
    private const val WHATSAPP = "com.whatsapp"
    private const val WHATSAPP_BUSINESS = "com.whatsapp.w4b"
    private const val REQUEST_SAVE = 4801
  }
}
