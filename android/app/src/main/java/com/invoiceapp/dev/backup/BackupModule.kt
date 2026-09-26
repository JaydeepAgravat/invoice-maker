package com.invoiceapp.dev.backup

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.invoiceapp.dev.specs.NativeBackupSpec
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Backup files: a zip with backup.json and the private files it refers to.
 * Restores unpack into a staging folder first; files only replace the live
 * ones once the database restore has committed.
 */
class BackupModule(context: ReactApplicationContext) :
  NativeBackupSpec(context), ActivityEventListener {

  private val io = Executors.newSingleThreadExecutor()
  private var pendingPick: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName() = NAME

  private val filesDir get() = reactApplicationContext.filesDir
  private val stagingDir get() = File(reactApplicationContext.cacheDir, "restore")

  override fun getFilesDir(): String = filesDir.absolutePath

  override fun writeZip(json: String, files: ReadableArray, name: String, promise: Promise) {
    io.execute {
      try {
        val dir = File(reactApplicationContext.cacheDir, "export").apply { mkdirs() }
        val out = File(dir, name.replace(Regex("[\\\\/:*?\"<>|]"), "_"))
        ZipOutputStream(FileOutputStream(out)).use { zip ->
          zip.putNextEntry(ZipEntry(JSON_ENTRY))
          zip.write(json.toByteArray(Charsets.UTF_8))
          zip.closeEntry()
          for (i in 0 until files.size()) {
            val rel = files.getString(i) ?: continue
            val file = File(filesDir, rel)
            // Only files inside the app's own folder; missing ones are skipped.
            if (!file.canonicalPath.startsWith(filesDir.canonicalPath) || !file.isFile) continue
            zip.putNextEntry(ZipEntry("files/$rel"))
            FileInputStream(file).use { it.copyTo(zip) }
            zip.closeEntry()
          }
        }
        promise.resolve(
          Arguments.createMap().apply {
            putString("path", out.absolutePath)
            putDouble("bytes", out.length().toDouble())
          },
        )
      } catch (e: Exception) {
        promise.reject("E_BACKUP", e)
      }
    }
  }

  override fun pickFile(mimeTypes: ReadableArray, promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: return promise.reject("E_BACKUP", "No activity")
    pendingPick?.resolve(null)
    pendingPick = promise
    val types = (0 until mimeTypes.size()).mapNotNull { mimeTypes.getString(it) }.toTypedArray()
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = if (types.size == 1) types[0] else "*/*"
      if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types)
    }
    activity.startActivityForResult(intent, REQUEST_PICK)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_PICK) return
    val promise = pendingPick ?: return
    pendingPick = null
    promise.resolve(if (resultCode == Activity.RESULT_OK) data?.data?.toString() else null)
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun open(uri: String): InputStream {
    val parsed = Uri.parse(uri)
    return if (parsed.scheme == "file") FileInputStream(File(parsed.path!!))
    else reactApplicationContext.contentResolver.openInputStream(parsed)
      ?: throw IllegalStateException("Cannot open file")
  }

  override fun readText(uri: String, promise: Promise) {
    io.execute {
      try {
        val bytes = open(uri).use { input ->
          val buf = input.readBytes()
          if (buf.size > MAX_TEXT) throw IllegalStateException("File too large")
          buf
        }
        promise.resolve(decode(bytes))
      } catch (e: Exception) {
        promise.reject("E_READ", e)
      }
    }
  }

  /** UTF-8 when valid (with or without BOM), else Windows-1252 as older Excel writes. */
  private fun decode(bytes: ByteArray): String {
    val utf8 = Charsets.UTF_8.newDecoder()
    return try {
      utf8.decode(java.nio.ByteBuffer.wrap(bytes)).toString()
    } catch (_: java.nio.charset.CharacterCodingException) {
      String(bytes, charset("windows-1252"))
    }
  }

  override fun openZip(uri: String, promise: Promise) {
    io.execute {
      try {
        stagingDir.deleteRecursively()
        stagingDir.mkdirs()
        var json: String? = null
        var count = 0
        ZipInputStream(open(uri)).use { zip ->
          var entry = zip.nextEntry
          while (entry != null) {
            if (!entry.isDirectory) {
              if (entry.name == JSON_ENTRY) {
                json = zip.readBytes().toString(Charsets.UTF_8)
              } else if (entry.name.startsWith("files/")) {
                val target = File(stagingDir, entry.name)
                // Zip-slip guard: never write outside the staging folder.
                if (!target.canonicalPath.startsWith(stagingDir.canonicalPath + File.separator)) {
                  throw SecurityException("Invalid entry ${entry.name}")
                }
                target.parentFile?.mkdirs()
                FileOutputStream(target).use { zip.copyTo(it) }
                count++
              }
            }
            entry = zip.nextEntry
          }
        }
        val text = json ?: throw IllegalStateException("NOT_A_BACKUP")
        promise.resolve(
          Arguments.createMap().apply {
            putString("json", text)
            putInt("files", count)
          },
        )
      } catch (e: Exception) {
        promise.reject("E_RESTORE", e.message ?: "Restore failed", e)
      }
    }
  }

  override fun commitStaged(promise: Promise) {
    io.execute {
      try {
        val source = File(stagingDir, "files")
        var count = 0
        source.walkTopDown().filter { it.isFile }.forEach { f ->
          val target = File(filesDir, f.relativeTo(source).path)
          target.parentFile?.mkdirs()
          f.copyTo(target, overwrite = true)
          count++
        }
        stagingDir.deleteRecursively()
        promise.resolve(count)
      } catch (e: Exception) {
        promise.reject("E_RESTORE", e)
      }
    }
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    io.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeBackup"
    private const val JSON_ENTRY = "backup.json"
    private const val REQUEST_PICK = 4821
    private const val MAX_TEXT = 20 * 1024 * 1024
  }
}
