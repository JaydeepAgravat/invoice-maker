package android.print

import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * Drives a PrintDocumentAdapter straight into a file, with no print dialog.
 *
 * Lives in `android.print` because the adapter's callback classes only have
 * package-visible constructors in the SDK stubs. This is the same approach
 * used by long-standing HTML-to-PDF libraries.
 */
class PdfFileWriter(private val attributes: PrintAttributes) {

  fun write(
    adapter: PrintDocumentAdapter,
    file: File,
    onDone: (error: String?) -> Unit,
  ) {
    adapter.onStart()
    adapter.onLayout(
      null,
      attributes,
      null,
      object : PrintDocumentAdapter.LayoutResultCallback() {
        override fun onLayoutFinished(info: PrintDocumentInfo?, changed: Boolean) {
          val fd = try {
            ParcelFileDescriptor.open(
              file,
              ParcelFileDescriptor.MODE_CREATE or
                ParcelFileDescriptor.MODE_TRUNCATE or
                ParcelFileDescriptor.MODE_READ_WRITE,
            )
          } catch (e: Exception) {
            adapter.onFinish()
            onDone(e.message ?: "Could not open the output file")
            return
          }
          adapter.onWrite(
            arrayOf(PageRange.ALL_PAGES),
            fd,
            CancellationSignal(),
            object : PrintDocumentAdapter.WriteResultCallback() {
              override fun onWriteFinished(pages: Array<out PageRange>?) {
                fd.close()
                adapter.onFinish()
                onDone(null)
              }

              override fun onWriteFailed(error: CharSequence?) {
                fd.close()
                adapter.onFinish()
                onDone(error?.toString() ?: "Writing the PDF failed")
              }

              override fun onWriteCancelled() {
                fd.close()
                adapter.onFinish()
                onDone("Cancelled")
              }
            },
          )
        }

        override fun onLayoutFailed(error: CharSequence?) {
          adapter.onFinish()
          onDone(error?.toString() ?: "Page layout failed")
        }

        override fun onLayoutCancelled() {
          adapter.onFinish()
          onDone("Cancelled")
        }
      },
      null,
    )
  }
}
