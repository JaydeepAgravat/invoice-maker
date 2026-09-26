package com.invoiceapp.dev.media

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.provider.ContactsContract
import android.provider.MediaStore
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.invoiceapp.dev.specs.NativeMediaSpec
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Photos without permissions: the system photo picker and the camera app
 * (via an output URI). Images are downscaled, rotated upright and stored in
 * the app's private files so documents and backups stay small.
 */
class MediaModule(context: ReactApplicationContext) :
  NativeMediaSpec(context), ActivityEventListener {

  private val io = Executors.newSingleThreadExecutor()
  private var pending: Triple<Int, ReadableMap, Promise>? = null
  private var captureFile: File? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName() = NAME

  override fun pickImage(options: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: return promise.reject("E_MEDIA", "No activity")
    val intent = ActivityResultContracts.PickVisualMedia().createIntent(
      activity,
      PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
    )
    start(activity, intent, REQUEST_PICK, options, promise)
  }

  override fun pickContact(promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: return promise.reject("E_MEDIA", "No activity")
    // Picking a phone row grants read access to just that row: no permission.
    val intent = Intent(Intent.ACTION_PICK).setType(ContactsContract.CommonDataKinds.Phone.CONTENT_TYPE)
    start(activity, intent, REQUEST_CONTACT, Arguments.createMap(), promise)
  }

  override fun takePhoto(options: ReadableMap, promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: return promise.reject("E_MEDIA", "No activity")
    val dir = File(reactApplicationContext.cacheDir, "capture").apply { mkdirs() }
    val file = File(dir, "capture-${System.currentTimeMillis()}.jpg")
    captureFile = file
    val uri = FileProvider.getUriForFile(reactApplicationContext, reactApplicationContext.packageName + ".files", file)
    val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
      putExtra(MediaStore.EXTRA_OUTPUT, uri)
      addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    start(activity, intent, REQUEST_CAPTURE, options, promise)
  }

  private fun start(activity: Activity, intent: Intent, code: Int, options: ReadableMap, promise: Promise) {
    pending?.third?.resolve(null)
    pending = Triple(code, options, promise)
    try {
      activity.startActivityForResult(intent, code)
    } catch (e: ActivityNotFoundException) {
      pending = null
      promise.reject("E_NO_APP", e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    val (code, options, promise) = pending ?: return
    if (code != requestCode) return
    pending = null
    if (resultCode != Activity.RESULT_OK) {
      promise.resolve(null)
      return
    }
    if (code == REQUEST_CONTACT) {
      promise.resolve(data?.data?.let { readContact(it) })
      return
    }
    val source: Uri? = when (code) {
      REQUEST_PICK -> data?.data
      else -> captureFile?.let { Uri.fromFile(it) }
    }
    if (source == null) {
      promise.resolve(null)
      return
    }
    io.execute {
      try {
        promise.resolve(process(source, options))
      } catch (e: Exception) {
        promise.reject("E_MEDIA", e)
      } finally {
        if (code == REQUEST_CAPTURE) captureFile?.delete()
      }
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun readContact(uri: Uri) = try {
    reactApplicationContext.contentResolver.query(
      uri,
      arrayOf(
        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
        ContactsContract.CommonDataKinds.Phone.NUMBER,
      ),
      null,
      null,
      null,
    )?.use { c ->
      if (!c.moveToFirst()) null
      else Arguments.createMap().apply {
        putString("name", c.getString(0) ?: "")
        putString("phone", c.getString(1))
      }
    }
  } catch (_: Exception) {
    null
  }

  private fun process(source: Uri, options: ReadableMap) = run {
    val resolver = reactApplicationContext.contentResolver
    val maxSize = options.getInt("maxSize").coerceIn(64, 4096)
    val png = options.getString("format") == "png"
    val folder = (options.getString("folder") ?: "media").replace(Regex("[^a-z0-9_-]"), "")

    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(source)!!.use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= maxSize || bounds.outHeight / (sample * 2) >= maxSize) {
      sample *= 2
    }
    var bitmap = resolver.openInputStream(source)!!.use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: throw IllegalStateException("Unsupported image")

    val rotation = resolver.openInputStream(source)?.use {
      when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
    } ?: 0f

    val scale = minOf(1f, maxSize.toFloat() / maxOf(bitmap.width, bitmap.height))
    if (scale < 1f || rotation != 0f) {
      val m = Matrix().apply {
        postScale(scale, scale)
        postRotate(rotation)
      }
      val next = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
      if (next != bitmap) bitmap.recycle()
      bitmap = next
    }

    val dir = File(reactApplicationContext.filesDir, folder).apply { mkdirs() }
    val out = File(dir, UUID.randomUUID().toString() + if (png) ".png" else ".jpg")
    FileOutputStream(out).use {
      bitmap.compress(if (png) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG, if (png) 100 else 82, it)
    }
    val result = Arguments.createMap().apply {
      putString("path", out.absolutePath)
      putInt("width", bitmap.width)
      putInt("height", bitmap.height)
    }
    bitmap.recycle()
    result
  }

  override fun writeFile(folder: String, name: String, contents: String, promise: Promise) {
    io.execute {
      try {
        val dir = File(reactApplicationContext.filesDir, folder.replace(Regex("[^a-z0-9_-]"), "")).apply { mkdirs() }
        val file = File(dir, name.replace(Regex("[^A-Za-z0-9._-]"), "_"))
        file.writeText(contents)
        promise.resolve(file.absolutePath)
      } catch (e: Exception) {
        promise.reject("E_MEDIA", e)
      }
    }
  }

  override fun readFile(path: String, promise: Promise) {
    io.execute {
      try {
        val file = File(path)
        if (!inside(file)) throw SecurityException("Outside app storage")
        promise.resolve(file.readText())
      } catch (e: Exception) {
        promise.reject("E_MEDIA", e)
      }
    }
  }

  override fun writeExport(name: String, contents: String, promise: Promise) {
    io.execute {
      try {
        val dir = File(reactApplicationContext.cacheDir, "export").apply { mkdirs() }
        val file = File(dir, name.replace(Regex("[\\\\/:*?\"<>|\n\r]"), "_"))
        file.writeText(contents)
        promise.resolve(file.absolutePath)
      } catch (e: Exception) {
        promise.reject("E_MEDIA", e)
      }
    }
  }

  private fun inside(file: File): Boolean =
    file.canonicalPath.startsWith(reactApplicationContext.filesDir.canonicalPath) ||
      file.canonicalPath.startsWith(reactApplicationContext.cacheDir.canonicalPath)

  override fun deleteFile(path: String, promise: Promise) {
    val file = File(path)
    // Only ever delete inside the app's own storage.
    promise.resolve(inside(file) && file.delete())
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeMedia"
    private const val REQUEST_PICK = 4811
    private const val REQUEST_CAPTURE = 4812
    private const val REQUEST_CONTACT = 4813
  }
}
