package com.invoiceapp.dev.pdf

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.print.PdfFileWriter
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.invoiceapp.dev.specs.NativePdfSpec
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * HTML → PDF through an off-screen WebView and Chromium's print pipeline:
 * real selectable text, embedded font subsets, CSS paged media (repeated
 * table headers, page-break rules, page-number margin boxes).
 */
class PdfModule(context: ReactApplicationContext) : NativePdfSpec(context) {

  private val io = Executors.newSingleThreadExecutor()

  /** Keeps WebViews alive until their job finishes (they are not attached to a window). */
  private val active = mutableSetOf<WebView>()

  override fun getName() = NAME

  override fun toPdf(html: String, paper: String, fileName: String, promise: Promise) {
    val dir = File(reactApplicationContext.cacheDir, "pdf").apply { mkdirs() }
    val safe = fileName.replace(Regex("[\\\\/:*?\"<>|\\n\\r]"), "_").ifBlank { "document.pdf" }
    val file = File(dir, safe)
    UiThreadUtil.runOnUiThread {
      val web = newWebView()
      web.webViewClient = object : WebViewClient() {
        private var started = false

        override fun onPageFinished(view: WebView, url: String?) {
          if (started) return
          started = true
          val adapter = view.createPrintDocumentAdapter(safe)
          PdfFileWriter(attributesFor(paper)).write(adapter, file) { error ->
            UiThreadUtil.runOnUiThread { release(view) }
            if (error != null) {
              promise.reject("E_PDF", error)
              return@write
            }
            io.execute {
              try {
                val pages = pageCount(file)
                val result = Arguments.createMap().apply {
                  putString("path", file.absolutePath)
                  putInt("pages", pages)
                  putDouble("bytes", file.length().toDouble())
                }
                promise.resolve(result)
              } catch (e: Exception) {
                promise.reject("E_PDF", e)
              }
            }
          }
        }
      }
      load(web, html)
    }
  }

  override fun renderPages(path: String, width: Double, promise: Promise) {
    io.execute {
      try {
        val source = File(path)
        val outDir = File(reactApplicationContext.cacheDir, "preview").apply { mkdirs() }
        // Unique names so the image cache never shows a stale page.
        val stamp = System.currentTimeMillis()
        outDir.listFiles()?.forEach { f ->
          if (f.name.startsWith(source.nameWithoutExtension + "@")) f.delete()
        }
        val images = Arguments.createArray()
        ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
          PdfRenderer(fd).use { renderer ->
            for (i in 0 until renderer.pageCount) {
              renderer.openPage(i).use { page ->
                val w = width.toInt().coerceIn(200, 2400)
                val h = (w.toDouble() * page.height / page.width).toInt()
                val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                bitmap.eraseColor(Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                val out = File(outDir, "${source.nameWithoutExtension}@$stamp-$i.png")
                FileOutputStream(out).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
                images.pushMap(
                  Arguments.createMap().apply {
                    putString("uri", "file://" + out.absolutePath)
                    putInt("width", w)
                    putInt("height", h)
                  },
                )
              }
            }
          }
        }
        promise.resolve(images)
      } catch (e: Exception) {
        promise.reject("E_RENDER", e)
      }
    }
  }

  override fun print(html: String, paper: String, jobName: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_PRINT", "No activity")
      return
    }
    UiThreadUtil.runOnUiThread {
      val web = newWebView(activity)
      web.webViewClient = object : WebViewClient() {
        private var started = false

        override fun onPageFinished(view: WebView, url: String?) {
          if (started) return
          started = true
          try {
            val manager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
            manager.print(jobName, view.createPrintDocumentAdapter(jobName), attributesFor(paper))
            promise.resolve(null)
          } catch (e: Exception) {
            promise.reject("E_PRINT", e)
          }
          // The print framework holds the adapter; free the view a little later.
          view.postDelayed({ release(view) }, 60_000)
        }
      }
      load(web, html)
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun newWebView(context: Context = reactApplicationContext.currentActivity ?: reactApplicationContext): WebView =
    WebView(context).also { web ->
      web.settings.apply {
        javaScriptEnabled = false
        // Logos, signatures and photos live in the app's private files.
        allowFileAccess = true
        blockNetworkLoads = true
        loadsImagesAutomatically = true
      }
      active.add(web)
    }

  private fun load(web: WebView, html: String) {
    // Base URL lets templates reference bundled fonts as fonts/Inter-Regular.ttf.
    web.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "utf-8", null)
  }

  private fun release(web: WebView) {
    active.remove(web)
    web.destroy()
  }

  private fun pageCount(file: File): Int =
    ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
      PdfRenderer(fd).use { it.pageCount }
    }

  private fun attributesFor(paper: String): PrintAttributes =
    PrintAttributes.Builder()
      .setMediaSize(
        if (paper == "LETTER") PrintAttributes.MediaSize.NA_LETTER
        else PrintAttributes.MediaSize.ISO_A4,
      )
      .setResolution(PrintAttributes.Resolution("pdf", "pdf", 600, 600))
      .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
      .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
      .build()

  override fun invalidate() {
    io.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "NativePdf"
  }
}
