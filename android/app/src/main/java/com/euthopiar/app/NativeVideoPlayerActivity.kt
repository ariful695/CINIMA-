package com.euthopiar.app

import android.app.PictureInPictureParams
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.View
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.media3.ui.TrackSelectionDialogBuilder
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.util.concurrent.TimeUnit

@OptIn(UnstableApi::class)
class NativeVideoPlayerActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_URL = "extra_stream_url"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_SUBTITLE = "extra_subtitle"
        const val EXTRA_IS_LIVE = "extra_is_live"
        const val EXTRA_HEADERS_JSON = "extra_headers_json"
        const val EXTRA_BUFFER_MB = "extra_buffer_mb"
        const val EXTRA_FALLBACK_URLS = "extra_fallback_urls"
    }

    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView
    private lateinit var topBar: View
    private lateinit var loadingSpinner: ProgressBar
    private lateinit var titleText: TextView
    private lateinit var subtitleText: TextView
    private lateinit var errorText: TextView

    private var streamUrl: String = ""
    private var streamTitle: String = "EUTHOPIAR"
    private var streamSubtitle: String = ""
    private var isLiveStream: Boolean = false
    private var bufferCapMb: Int = 50
    private var fallbackUrls: List<String> = emptyList()
    private var currentFallbackIdx: Int = -1
    private var customHeaders: Map<String, String> = emptyMap()
    private var currentSpeedIndex = 1
    private val speedOptions = floatArrayOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    private var resizeModeIndex = 0
    private val resizeModes = intArrayOf(
        AspectRatioFrameLayout.RESIZE_MODE_FIT,
        AspectRatioFrameLayout.RESIZE_MODE_FILL,
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_native_player)

        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        enterImmersiveMode()

        playerView = findViewById(R.id.nativePlayerView)
        topBar = findViewById(R.id.nativePlayerTopBar)
        loadingSpinner = findViewById(R.id.nativePlayerLoading)
        titleText = findViewById(R.id.nativePlayerTitle)
        subtitleText = findViewById(R.id.nativePlayerSubtitle)
        errorText = findViewById(R.id.nativePlayerError)

        streamUrl = intent.getStringExtra(EXTRA_URL).orEmpty()
        streamTitle = intent.getStringExtra(EXTRA_TITLE) ?: "EUTHOPIAR"
        streamSubtitle = intent.getStringExtra(EXTRA_SUBTITLE) ?: ""
        isLiveStream = intent.getBooleanExtra(EXTRA_IS_LIVE, false)
        val rawBuf = intent.getIntExtra(EXTRA_BUFFER_MB, 50)
        bufferCapMb = if (rawBuf in listOf(25, 50, 75, 100)) rawBuf else 50
        fallbackUrls = intent.getStringArrayListExtra(EXTRA_FALLBACK_URLS)?.filter { it.isNotBlank() } ?: emptyList()
        currentFallbackIdx = -1
        customHeaders = parseHeaders(intent.getStringExtra(EXTRA_HEADERS_JSON))

        titleText.text = streamTitle
        subtitleText.text = if (isLiveStream) "LIVE · $streamSubtitle".trimEnd(' ', '·') else streamSubtitle
        subtitleText.visibility = if (subtitleText.text.isNullOrBlank()) View.GONE else View.VISIBLE

        findViewById<ImageButton>(R.id.btnNativeBack).setOnClickListener {
            finish()
        }

        findViewById<ImageButton>(R.id.btnNativeTracks).setOnClickListener {
            openTrackSelector()
        }

        findViewById<ImageButton>(R.id.btnNativeSpeed).setOnClickListener {
            cyclePlaybackSpeed()
        }

        findViewById<ImageButton>(R.id.btnNativeAspect).setOnClickListener {
            resizeModeIndex = (resizeModeIndex + 1) % resizeModes.size
            playerView.resizeMode = resizeModes[resizeModeIndex]
        }

        findViewById<ImageButton>(R.id.btnNativePip).setOnClickListener {
            triggerPictureInPicture()
        }

        playerView.setControllerVisibilityListener(
            PlayerView.ControllerVisibilityListener { visibility ->
                topBar.visibility = visibility
            }
        )
    }

    private fun parseHeaders(rawJson: String?): Map<String, String> {
        if (rawJson.isNullOrBlank()) return emptyMap()
        return try {
            val json = JSONObject(rawJson)
            val map = mutableMapOf<String, String>()
            val keys = json.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val value = json.optString(key)
                if (value.isNotBlank()) map[key] = value
            }
            map
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    private fun buildMediaItem(url: String): MediaItem {
        val builder = MediaItem.Builder().setUri(Uri.parse(url))
        if (url.contains(".m3u8", ignoreCase = true)) {
            builder.setMimeType(MimeTypes.APPLICATION_M3U8)
        }
        if (isLiveStream) {
            builder.setLiveConfiguration(
                MediaItem.LiveConfiguration.Builder()
                    .setTargetOffsetMs(2_500L)
                    .build()
            )
        }
        return builder.build()
    }

    private fun initializePlayer() {
        if (player != null || streamUrl.isBlank()) return

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(25, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()

        val defaultHeaders = HashMap(customHeaders)
        if (!defaultHeaders.containsKey("User-Agent")) {
            defaultHeaders["User-Agent"] =
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/134.0 Mobile Safari/537.36"
        }

        val dataSourceFactory = OkHttpDataSource.Factory(okHttpClient)
            .setDefaultRequestProperties(defaultHeaders)

        val renderersFactory = DefaultRenderersFactory(this)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
            .setEnableDecoderFallback(true)

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(15_000, 50_000, 1_200, 2_500)
            .setTargetBufferBytes(bufferCapMb * 1024 * 1024)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        val exo = ExoPlayer.Builder(this, renderersFactory)
            .setMediaSourceFactory(DefaultMediaSourceFactory(dataSourceFactory))
            .setLoadControl(loadControl)
            .build()

        exo.setMediaItem(buildMediaItem(streamUrl))
        exo.playWhenReady = true
        exo.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                loadingSpinner.visibility =
                    if (playbackState == Player.STATE_BUFFERING) View.VISIBLE else View.GONE
                if (playbackState == Player.STATE_READY) {
                    errorText.visibility = View.GONE
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val nextIdx = currentFallbackIdx + 1
                if (nextIdx < fallbackUrls.size) {
                    currentFallbackIdx = nextIdx
                    val nextUrl = fallbackUrls[nextIdx]
                    errorText.visibility = View.GONE
                    loadingSpinner.visibility = View.VISIBLE
                    exo.setMediaItem(buildMediaItem(nextUrl))
                    exo.prepare()
                    exo.playWhenReady = true
                    return
                }
                loadingSpinner.visibility = View.GONE
                errorText.text = "Playback error: ${error.errorCodeName}"
                errorText.visibility = View.VISIBLE
            }
        })

        exo.prepare()
        player = exo
        playerView.player = exo
    }

    private fun releasePlayer() {
        player?.let {
            it.release()
        }
        player = null
        playerView.player = null
    }

    private fun openTrackSelector() {
        val exo = player ?: return
        val options = arrayOf("Audio Tracks", "Subtitles (CC)")
        AlertDialog.Builder(this)
            .setTitle("Select Track Type")
            .setItems(options) { _, which ->
                val trackType = if (which == 0) {
                    androidx.media3.common.C.TRACK_TYPE_AUDIO
                } else {
                    androidx.media3.common.C.TRACK_TYPE_TEXT
                }
                TrackSelectionDialogBuilder(
                    this,
                    options[which],
                    exo,
                    trackType
                ).setAllowAdaptiveSelections(true)
                    .setShowDisableOption(which == 1)
                    .build()
                    .show()
            }
            .show()
    }

    private fun cyclePlaybackSpeed() {
        val exo = player ?: return
        if (isLiveStream) return
        currentSpeedIndex = (currentSpeedIndex + 1) % speedOptions.size
        val rate = speedOptions[currentSpeedIndex]
        exo.playbackParameters = PlaybackParameters(rate)
        AlertDialog.Builder(this)
            .setMessage("Playback speed set to ${rate}x")
            .setPositiveButton("OK", null)
            .show()
    }

    private fun triggerPictureInPicture() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            enterPictureInPictureMode(params)
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (player?.isPlaying == true) {
            triggerPictureInPicture()
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        topBar.visibility = if (isInPictureInPictureMode) View.GONE else View.VISIBLE
        playerView.useController = !isInPictureInPictureMode
    }

    override fun onStart() {
        super.onStart()
        initializePlayer()
    }

    override fun onResume() {
        super.onResume()
        enterImmersiveMode()
        if (player == null) initializePlayer()
    }

    override fun onStop() {
        super.onStop()
        releasePlayer()
    }
}
