package com.invoiceapp.dev

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.invoiceapp.dev.backup.BackupModule
import com.invoiceapp.dev.drive.DriveModule
import com.invoiceapp.dev.haptics.HapticsModule
import com.invoiceapp.dev.lock.LockModule
import com.invoiceapp.dev.media.MediaModule
import com.invoiceapp.dev.pdf.PdfModule
import com.invoiceapp.dev.reminders.RemindersModule
import com.invoiceapp.dev.share.ShareModule
import com.invoiceapp.dev.widget.WidgetModule

/** Registers the app's own Turbo Modules. */
class AppPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      HapticsModule.NAME -> HapticsModule(reactContext)
      PdfModule.NAME -> PdfModule(reactContext)
      ShareModule.NAME -> ShareModule(reactContext)
      MediaModule.NAME -> MediaModule(reactContext)
      BackupModule.NAME -> BackupModule(reactContext)
      DriveModule.NAME -> DriveModule(reactContext)
      RemindersModule.NAME -> RemindersModule(reactContext)
      LockModule.NAME -> LockModule(reactContext)
      WidgetModule.NAME -> WidgetModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    listOf(
      HapticsModule.NAME,
      PdfModule.NAME,
      ShareModule.NAME,
      MediaModule.NAME,
      BackupModule.NAME,
      DriveModule.NAME,
      RemindersModule.NAME,
      LockModule.NAME,
      WidgetModule.NAME,
    )
      .associateWith { turboModuleInfo(it) }
  }

  private fun turboModuleInfo(name: String) =
    ReactModuleInfo(
      name,
      name,
      false, // canOverrideExistingModule
      false, // needsEagerInit
      false, // isCxxModule
      true, // isTurboModule
    )
}
