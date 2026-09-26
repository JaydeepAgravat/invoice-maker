package com.invoiceapp.dev.drive

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import com.invoiceapp.dev.specs.NativeDriveSpec
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Google Drive backups in the hidden app-data folder (drive.appdata): the
 * person's other Drive files are never visible to the app. Uses the Google
 * Identity authorization API (no sign-in screen of our own, no client secret).
 */
class DriveModule(context: ReactApplicationContext) :
  NativeDriveSpec(context), ActivityEventListener {

  private val io = Executors.newSingleThreadExecutor()
  private var pendingAuth: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName() = NAME

  override fun authorize(interactive: Boolean, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
      ?: return promise.reject("E_DRIVE", "No activity")
    val request = AuthorizationRequest.builder()
      .setRequestedScopes(listOf(Scope(SCOPE)))
      .build()
    Identity.getAuthorizationClient(activity).authorize(request)
      .addOnSuccessListener { result ->
        if (!result.hasResolution()) {
          promise.resolve(result.accessToken)
        } else if (!interactive) {
          promise.resolve(null)
        } else {
          pendingAuth?.resolve(null)
          pendingAuth = promise
          activity.startIntentSenderForResult(
            result.pendingIntent!!.intentSender, REQUEST_AUTH, null, 0, 0, 0, null,
          )
        }
      }
      .addOnFailureListener { e -> promise.reject("E_DRIVE_AUTH", e.message, e) }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_AUTH) return
    val promise = pendingAuth ?: return
    pendingAuth = null
    try {
      val result = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data)
      promise.resolve(result.accessToken)
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun connect(url: String, method: String, token: String): HttpURLConnection =
    (URL(url).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      connectTimeout = 20_000
      readTimeout = 60_000
      setRequestProperty("Authorization", "Bearer $token")
    }

  private fun check(conn: HttpURLConnection): HttpURLConnection {
    val code = conn.responseCode
    if (code !in 200..299) {
      val body = conn.errorStream?.bufferedReader()?.readText().orEmpty()
      throw IllegalStateException("HTTP $code ${body.take(300)}")
    }
    return conn
  }

  private fun fileMap(o: JSONObject) = Arguments.createMap().apply {
    putString("id", o.getString("id"))
    putString("name", o.optString("name"))
    putDouble("size", o.optString("size", "0").toDoubleOrNull() ?: 0.0)
    putString("modified", o.optString("modifiedTime"))
  }

  override fun upload(token: String, path: String, name: String, promise: Promise) {
    io.execute {
      try {
        val boundary = "b" + UUID.randomUUID().toString().replace("-", "")
        val meta = JSONObject().put("name", name).put("parents", org.json.JSONArray().put("appDataFolder"))
        val conn = connect(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime",
          "POST",
          token,
        )
        conn.doOutput = true
        conn.setChunkedStreamingMode(64 * 1024)
        conn.setRequestProperty("Content-Type", "multipart/related; boundary=$boundary")
        conn.outputStream.use { out ->
          out.write("--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n".toByteArray())
          out.write("--$boundary\r\nContent-Type: application/zip\r\n\r\n".toByteArray())
          FileInputStream(File(path)).use { it.copyTo(out) }
          out.write("\r\n--$boundary--\r\n".toByteArray())
        }
        val body = check(conn).inputStream.bufferedReader().readText()
        promise.resolve(fileMap(JSONObject(body)))
      } catch (e: Exception) {
        promise.reject("E_DRIVE", e.message, e)
      }
    }
  }

  override fun list(token: String, promise: Promise) {
    io.execute {
      try {
        val q = URLEncoder.encode("trashed = false", "UTF-8")
        val conn = connect(
          "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=$q&orderBy=modifiedTime%20desc" +
            "&pageSize=50&fields=files(id,name,size,modifiedTime)",
          "GET",
          token,
        )
        val files = JSONObject(check(conn).inputStream.bufferedReader().readText()).getJSONArray("files")
        val out = Arguments.createArray()
        for (i in 0 until files.length()) out.pushMap(fileMap(files.getJSONObject(i)))
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("E_DRIVE", e.message, e)
      }
    }
  }

  override fun download(token: String, id: String, promise: Promise) {
    io.execute {
      try {
        val dir = File(reactApplicationContext.cacheDir, "drive").apply { mkdirs() }
        val target = File(dir, "backup.zip")
        val conn = connect("https://www.googleapis.com/drive/v3/files/$id?alt=media", "GET", token)
        check(conn).inputStream.use { input -> FileOutputStream(target).use { input.copyTo(it) } }
        promise.resolve("file://" + target.absolutePath)
      } catch (e: Exception) {
        promise.reject("E_DRIVE", e.message, e)
      }
    }
  }

  override fun remove(token: String, id: String, promise: Promise) {
    io.execute {
      try {
        check(connect("https://www.googleapis.com/drive/v3/files/$id", "DELETE", token))
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_DRIVE", e.message, e)
      }
    }
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeDrive"
    private const val SCOPE = "https://www.googleapis.com/auth/drive.appdata"
    private const val REQUEST_AUTH = 4831
  }
}
