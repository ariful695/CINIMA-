package com.euthopiar.app

import android.app.DownloadManager
import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Rational
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativePlayer")
class NativePlayerPlugin : Plugin() {

    @PluginMethod
    fun openNativePlayer(call: PluginCall) {
        val url = call.getString("url")?.trim().orEmpty()
        if (url.isEmpty()) {
            call.reject("Missing stream URL")
            return
        }
        val title = call.getString("title") ?: "EUTHOPIAR Stream"
        val subtitle = call.getString("subtitle") ?: ""
        val isLive = call.getBoolean("isLive") ?: false
        val bufferMb = call.getInt("bufferMb") ?: 50
        val headersObj = call.getObject("headers")
        val fallbackArray = call.getArray("fallbackUrls")
        val fallbackList = ArrayList<String>()
        if (fallbackArray != null) {
            for (i in 0 until fallbackArray.length()) {
                val u = fallbackArray.optString(i)?.trim().orEmpty()
                if (u.isNotEmpty()) fallbackList.add(u)
            }
        }

        val intent = Intent(context, NativeVideoPlayerActivity::class.java).apply {
            putExtra(NativeVideoPlayerActivity.EXTRA_URL, url)
            putExtra(NativeVideoPlayerActivity.EXTRA_TITLE, title)
            putExtra(NativeVideoPlayerActivity.EXTRA_SUBTITLE, subtitle)
            putExtra(NativeVideoPlayerActivity.EXTRA_IS_LIVE, isLive)
            putExtra(NativeVideoPlayerActivity.EXTRA_BUFFER_MB, bufferMb)
            if (fallbackList.isNotEmpty()) {
                putStringArrayListExtra(NativeVideoPlayerActivity.EXTRA_FALLBACK_URLS, fallbackList)
            }
            if (headersObj != null) {
                putExtra(NativeVideoPlayerActivity.EXTRA_HEADERS_JSON, headersObj.toString())
            }
        }

        activity?.runOnUiThread {
            activity.startActivity(intent)
            call.resolve(JSObject().apply { put("launched", true) })
        } ?: call.reject("Activity unavailable")
    }

    @PluginMethod
    fun setImmersiveFullscreen(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val landscape = call.getBoolean("landscape") ?: false
        val hostActivity = activity ?: run {
            call.resolve(JSObject().apply { put("ok", false) })
            return
        }

        hostActivity.runOnUiThread {
            val controller = WindowInsetsControllerCompat(
                hostActivity.window,
                hostActivity.window.decorView
            )
            if (enabled) {
                WindowCompat.setDecorFitsSystemWindows(hostActivity.window, false)
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(WindowInsetsCompat.Type.systemBars())
                hostActivity.requestedOrientation = if (landscape) {
                    ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                } else {
                    ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                }
            } else {
                WindowCompat.setDecorFitsSystemWindows(hostActivity.window, true)
                controller.show(WindowInsetsCompat.Type.systemBars())
                hostActivity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
            call.resolve(JSObject().apply { put("ok", true) })
        }
    }

    @PluginMethod
    fun enterPictureInPicture(call: PluginCall) {
        val hostActivity = activity ?: run {
            call.resolve(JSObject().apply { put("ok", false) })
            return
        }
        hostActivity.runOnUiThread {
            val entered = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
                hostActivity.enterPictureInPictureMode(params)
            } else {
                false
            }
            call.resolve(JSObject().apply { put("ok", entered) })
        }
    }

    @PluginMethod
    fun downloadMedia(call: PluginCall) {
        val url = call.getString("url")?.trim().orEmpty()
        if (url.isEmpty()) {
            call.reject("Missing download URL")
            return
        }
        val title = call.getString("title") ?: "EUTHOPIAR Media"
        val rawFileName = call.getString("fileName") ?: "euthopiar_video.mp4"
        val safeFileName = rawFileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")

        try {
            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val req = DownloadManager.Request(Uri.parse(url))
                .setTitle(title)
                .setDescription("Downloading via EUTHOPIAR")
                .setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeFileName)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)

            val downloadId = dm.enqueue(req)
            call.resolve(JSObject().apply { put("downloadId", downloadId) })
        } catch (err: Exception) {
            call.reject(err.message ?: "Download failed")
        }
    }
}
