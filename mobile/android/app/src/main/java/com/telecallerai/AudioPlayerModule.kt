package com.telecallerai

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class AudioPlayerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    override fun getName(): String = "AudioPlayer"

    private var mediaPlayer: MediaPlayer? = null
    private var currentUri: String? = null
    private var playbackStatus: String = "idle" // idle, loading, playing, paused, completed, error
    private val handler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private val PROGRESS_INTERVAL_MS = 250L

    init {
        reactContext.addLifecycleEventListener(this)
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    private fun startProgressUpdates() {
        stopProgressUpdates()
        progressRunnable = object : Runnable {
            override fun run() {
                val player = mediaPlayer
                if (player != null && player.isPlaying) {
                    try {
                        val currentPos = player.currentPosition
                        val duration = player.duration

                        val map = Arguments.createMap()
                        map.putDouble("positionMs", currentPos.toDouble())
                        map.putDouble("durationMs", if (duration > 0) duration.toDouble() else 0.0)
                        map.putBoolean("isPlaying", true)
                        sendEvent("onPlaybackProgress", map)

                        handler.postDelayed(this, PROGRESS_INTERVAL_MS)
                    } catch (_: Exception) {
                        stopProgressUpdates()
                    }
                }
            }
        }
        handler.post(progressRunnable!!)
    }

    private fun stopProgressUpdates() {
        progressRunnable?.let {
            handler.removeCallbacks(it)
            progressRunnable = null
        }
    }

    private fun emitStatus(status: String, error: String? = null) {
        playbackStatus = status
        val map = Arguments.createMap()
        map.putString("status", status)
        map.putString("currentUri", currentUri ?: "")
        if (error != null) {
            map.putString("error", error)
        }
        sendEvent("onPlaybackStatus", map)
    }

    @ReactMethod
    fun play(uriOrPath: String, promise: Promise) {
        try {
            // If already prepared with same URI and paused, simply resume
            if (mediaPlayer != null && currentUri == uriOrPath) {
                if (!mediaPlayer!!.isPlaying) {
                    mediaPlayer!!.start()
                    startProgressUpdates()
                    emitStatus("playing")
                    val result = Arguments.createMap()
                    result.putBoolean("resumed", true)
                    result.putDouble("durationMs", mediaPlayer!!.duration.toDouble())
                    promise.resolve(result)
                    return
                } else {
                    val result = Arguments.createMap()
                    result.putBoolean("alreadyPlaying", true)
                    promise.resolve(result)
                    return
                }
            }

            // Release any existing player
            releasePlayer()

            currentUri = uriOrPath
            emitStatus("loading")

            val player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
            }

            // Set data source based on URI type
            if (uriOrPath.startsWith("content://")) {
                val contentUri = Uri.parse(uriOrPath)
                try {
                    val pfd = reactContext.contentResolver.openFileDescriptor(contentUri, "r")
                    if (pfd != null) {
                        player.setDataSource(pfd.fileDescriptor)
                        pfd.close()
                    } else {
                        player.setDataSource(reactContext, contentUri)
                    }
                } catch (_: Exception) {
                    player.setDataSource(reactContext, contentUri)
                }
            } else {
                val cleanPath = if (uriOrPath.startsWith("file://")) {
                    uriOrPath.substring(7)
                } else {
                    uriOrPath
                }
                player.setDataSource(cleanPath)
            }

            player.setOnPreparedListener { mp ->
                try {
                    mp.start()
                    startProgressUpdates()
                    emitStatus("playing")

                    val result = Arguments.createMap()
                    result.putBoolean("started", true)
                    result.putDouble("durationMs", mp.duration.toDouble())
                    result.putDouble("positionMs", 0.0)
                    promise.resolve(result)
                } catch (e: Exception) {
                    emitStatus("error", e.message)
                    promise.reject("PLAY_START_ERROR", e.message, e)
                }
            }

            player.setOnCompletionListener {
                stopProgressUpdates()
                emitStatus("completed")

                // Reset position to start on completion
                val map = Arguments.createMap()
                map.putDouble("positionMs", player.duration.toDouble())
                map.putDouble("durationMs", player.duration.toDouble())
                map.putBoolean("isPlaying", false)
                sendEvent("onPlaybackProgress", map)
            }

            player.setOnErrorListener { _, what, extra ->
                stopProgressUpdates()
                val errMsg = "MediaPlayer error: what=$what, extra=$extra"
                emitStatus("error", errMsg)
                false
            }

            player.prepareAsync()
            mediaPlayer = player

        } catch (e: Exception) {
            releasePlayer()
            emitStatus("error", e.message)
            promise.reject("PLAY_ERROR", "Failed to start audio playback: ${e.message}", e)
        }
    }

    @ReactMethod
    fun pause(promise: Promise) {
        try {
            val player = mediaPlayer
            if (player != null && player.isPlaying) {
                player.pause()
                stopProgressUpdates()
                emitStatus("paused")
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun resume(promise: Promise) {
        try {
            val player = mediaPlayer
            if (player != null && !player.isPlaying) {
                player.start()
                startProgressUpdates()
                emitStatus("playing")
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun seekTo(positionMs: Double, promise: Promise) {
        try {
            val player = mediaPlayer
            if (player != null) {
                val targetMs = positionMs.toInt().coerceIn(0, player.duration)
                player.seekTo(targetMs)

                val map = Arguments.createMap()
                map.putDouble("positionMs", targetMs.toDouble())
                map.putDouble("durationMs", player.duration.toDouble())
                map.putBoolean("isPlaying", player.isPlaying)
                sendEvent("onPlaybackProgress", map)

                promise.resolve(targetMs.toDouble())
            } else {
                promise.reject("NOT_INITIALIZED", "Audio player is not loaded.")
            }
        } catch (e: Exception) {
            promise.reject("SEEK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            releasePlayer()
            emitStatus("idle")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val player = mediaPlayer
            val map = Arguments.createMap()
            map.putString("status", playbackStatus)
            map.putString("currentUri", currentUri ?: "")
            if (player != null) {
                map.putBoolean("isPlaying", player.isPlaying)
                map.putDouble("positionMs", player.currentPosition.toDouble())
                map.putDouble("durationMs", player.duration.toDouble())
            } else {
                map.putBoolean("isPlaying", false)
                map.putDouble("positionMs", 0.0)
                map.putDouble("durationMs", 0.0)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_STATUS_ERROR", e.message, e)
        }
    }

    // Required for React Native NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun releasePlayer() {
        stopProgressUpdates()
        mediaPlayer?.let {
            try {
                if (it.isPlaying) {
                    it.stop()
                }
                it.reset()
                it.release()
            } catch (_: Exception) {}
        }
        mediaPlayer = null
    }

    override fun onHostResume() {}

    override fun onHostPause() {
        // Automatically pause when app enters background
        try {
            if (mediaPlayer?.isPlaying == true) {
                mediaPlayer?.pause()
                stopProgressUpdates()
                emitStatus("paused")
            }
        } catch (_: Exception) {}
    }

    override fun onHostDestroy() {
        releasePlayer()
    }
}
