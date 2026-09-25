package com.audifyai

import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL

class DriveUploaderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DriveUploader"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun uploadFileToDrive(
        fileUriString: String,
        fileName: String,
        parentFolderId: String,
        accessToken: String,
        mimeTypeString: String,
        promise: Promise
    ) {
        Thread {
            var connection: HttpURLConnection? = null
            var uploadConnection: HttpURLConnection? = null
            var inputStream: InputStream? = null

            try {
                val uri = Uri.parse(fileUriString)

                // 1. Determine file size
                var fileSize = 0L
                if (fileUriString.startsWith("content://")) {
                    try {
                        val pfd = reactContext.contentResolver.openFileDescriptor(uri, "r")
                        if (pfd != null) {
                            fileSize = pfd.statSize
                            pfd.close()
                        }
                    } catch (_: Exception) {}
                } else {
                    val cleanPath = if (fileUriString.startsWith("file://")) {
                        fileUriString.substring(7)
                    } else {
                        fileUriString
                    }
                    val file = File(cleanPath)
                    if (file.exists()) {
                        fileSize = file.length()
                    }
                }

                // 2. Initiate Resumable Upload Session
                val initUrl = URL("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,size")
                connection = (initUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Authorization", "Bearer $accessToken")
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    setRequestProperty("X-Upload-Content-Type", mimeTypeString)
                    if (fileSize > 0) {
                        setRequestProperty("X-Upload-Content-Length", fileSize.toString())
                    }
                    connectTimeout = 30000
                    readTimeout = 30000
                }

                val metadataJson = JSONObject().apply {
                    put("name", fileName)
                    if (parentFolderId.isNotEmpty()) {
                        val parentsArray = org.json.JSONArray().apply { put(parentFolderId) }
                        put("parents", parentsArray)
                    }
                }

                OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                    writer.write(metadataJson.toString())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_CREATED) {
                    val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    promise.reject("DRIVE_INIT_FAILED", "Failed to initiate Drive upload ($responseCode): $errorBody")
                    return@Thread
                }

                val sessionLocation = connection.getHeaderField("Location")
                if (sessionLocation.isNullOrEmpty()) {
                    promise.reject("DRIVE_NO_LOCATION", "Drive did not return an upload session location.")
                    return@Thread
                }

                // 3. Upload Binary Data to Resumable Location
                val uploadUrl = URL(sessionLocation)
                uploadConnection = (uploadUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "PUT"
                    doOutput = true
                    setRequestProperty("Content-Type", mimeTypeString)
                    if (fileSize > 0) {
                        setFixedLengthStreamingMode(fileSize)
                    } else {
                        setChunkedStreamingMode(65536)
                    }
                    connectTimeout = 60000
                    readTimeout = 60000
                }

                inputStream = if (fileUriString.startsWith("content://")) {
                    reactContext.contentResolver.openInputStream(uri)
                } else {
                    val cleanPath = if (fileUriString.startsWith("file://")) {
                        fileUriString.substring(7)
                    } else {
                        fileUriString
                    }
                    FileInputStream(File(cleanPath))
                }

                if (inputStream == null) {
                    promise.reject("CANNOT_OPEN_FILE", "Could not open audio recording for reading: $fileUriString")
                    return@Thread
                }

                val buffer = ByteArray(65536)
                var bytesRead: Int
                var totalUploaded = 0L
                val outputStream = uploadConnection.outputStream

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalUploaded += bytesRead

                    if (fileSize > 0) {
                        val progressPercent = ((totalUploaded.toDouble() / fileSize.toDouble()) * 100).toInt()
                        val progMap = Arguments.createMap().apply {
                            putString("fileName", fileName)
                            putInt("progressPercent", progressPercent)
                            putDouble("bytesUploaded", totalUploaded.toDouble())
                            putDouble("totalBytes", fileSize.toDouble())
                        }
                        sendEvent("onDriveUploadProgress", progMap)
                    }
                }
                outputStream.flush()

                val uploadResponseCode = uploadConnection.responseCode
                if (uploadResponseCode == HttpURLConnection.HTTP_OK || uploadResponseCode == HttpURLConnection.HTTP_CREATED) {
                    val responseBody = uploadConnection.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(responseBody)
                    val fileId = json.optString("id", "")
                    val webViewLink = json.optString("webViewLink", "https://drive.google.com/file/d/$fileId/view")

                    val resultMap = Arguments.createMap().apply {
                        putString("fileId", fileId)
                        putString("fileName", fileName)
                        putString("webViewLink", webViewLink)
                        putDouble("sizeBytes", totalUploaded.toDouble())
                    }
                    promise.resolve(resultMap)
                } else {
                    val errorBody = uploadConnection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    promise.reject("DRIVE_UPLOAD_FAILED", "Upload chunk failed ($uploadResponseCode): $errorBody")
                }

            } catch (e: Exception) {
                promise.reject("DRIVE_UPLOAD_ERROR", "Error during Drive upload: ${e.message}", e)
            } finally {
                try { inputStream?.close() } catch (_: Exception) {}
                connection?.disconnect()
                uploadConnection?.disconnect()
            }
        }.start()
    }

    // Required for React Native NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
