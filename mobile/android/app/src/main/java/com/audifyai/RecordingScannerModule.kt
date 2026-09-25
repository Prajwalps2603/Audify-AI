package com.audifyai

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.CallLog
import android.provider.DocumentsContract
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.*
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern

class RecordingScannerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RecordingScanner"

    private var pickerPromise: Promise? = null
    private val REQUEST_CODE_OPEN_DIRECTORY = 4210
    private val PREFS_NAME = "telecaller_saf"
    private val KEY_FOLDER_URI = "selected_folder_uri"
    private val KEY_FOLDER_NAME = "selected_folder_name"

    // Supported audio extensions for call recordings
    private val supportedExtensions = setOf(
        "m4a", "mp3", "wav", "aac", "amr", "3gp", "ogg", "opus", "flac"
    )

    // Keywords that indicate a call recording
    private val callKeywords = listOf(
        "call", "recording", "rec", "phone", "outgoing", "incoming", "dial"
    )

    // Data class for device call log entries
    private data class CallLogEntry(
        val number: String,
        val name: String,
        val date: Long,
        val duration: Long,
        val type: Int
    )

    // Activity result listener for Storage Access Framework (SAF) folder picker
    private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?
        ) {
            if (requestCode == REQUEST_CODE_OPEN_DIRECTORY) {
                if (resultCode == Activity.RESULT_OK && data != null && data.data != null) {
                    val uri: Uri = data.data!!
                    try {
                        val takeFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                                Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        reactApplicationContext.contentResolver.takePersistableUriPermission(
                            uri,
                            takeFlags
                        )

                        val folderName = getFolderNameFromUri(uri)
                        val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString(KEY_FOLDER_URI, uri.toString())
                            .putString(KEY_FOLDER_NAME, folderName)
                            .apply()

                        val result = Arguments.createMap()
                        result.putString("uri", uri.toString())
                        result.putString("name", folderName)
                        pickerPromise?.resolve(result)
                    } catch (e: Exception) {
                        pickerPromise?.reject("SAF_PERSIST_ERROR", "Failed to persist folder permission: ${e.message}", e)
                    }
                } else {
                    pickerPromise?.reject("PICKER_CANCELLED", "Folder selection was cancelled by user.")
                }
                pickerPromise = null
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    // Standard OEM call recording directories
    private fun getKnownRecordingDirectories(): List<File> {
        val root = Environment.getExternalStorageDirectory()
        return listOf(
            // Samsung
            File(root, "Recordings/Call"),
            File(root, "Sounds/Call"),
            File(root, "Call"),
            // Xiaomi / MIUI / Redmi
            File(root, "MIUI/sound_recorder/call_rec"),
            File(root, "MIUI/sound_recorder"),
            // OnePlus / Oppo / Realme (ColorOS / OxygenOS)
            File(root, "Recordings/PhoneCall"),
            File(root, "Record/Call"),
            File(root, "Record/Phone"),
            // Vivo (FuntouchOS / OriginOS)
            File(root, "Record/Call"),
            File(root, "Recordings"),
            // Huawei / Honor (EMUI / HarmonyOS)
            File(root, "record"),
            File(root, "Sounds/CallRecord"),
            // Stock Android / Google Pixel
            File(root, "Recordings"),
            File(root, "CallRecordings"),
            File(root, "Call Recordings"),
            File(root, "PhoneRecord"),
            File(root, "Phone Records"),
            File(root, "Music/Recordings"),
            File(root, "Audio")
        )
    }

    // ─────────────────────────────────────────────────────────────
    // Permission Methods
    // ─────────────────────────────────────────────────────────────

    @ReactMethod
    fun checkStoragePermission(promise: Promise) {
        try {
            val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                android.Manifest.permission.READ_MEDIA_AUDIO
            } else {
                android.Manifest.permission.READ_EXTERNAL_STORAGE
            }
            val status = ContextCompat.checkSelfPermission(reactApplicationContext, permission)
            promise.resolve(status == PackageManager.PERMISSION_GRANTED)
        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun checkCallLogPermission(promise: Promise) {
        try {
            val status = ContextCompat.checkSelfPermission(
                reactApplicationContext,
                android.Manifest.permission.READ_CALL_LOG
            )
            promise.resolve(status == PackageManager.PERMISSION_GRANTED)
        } catch (e: Exception) {
            promise.reject("CALL_LOG_PERMISSION_ERROR", e.message, e)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 5: Query Authorized Call Log
    // ─────────────────────────────────────────────────────────────

    private fun queryRecentCallLogs(): List<CallLogEntry> {
        val list = mutableListOf<CallLogEntry>()
        val hasPerm = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            android.Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasPerm) return list

        try {
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE
            )
            val cursor = reactApplicationContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                "${CallLog.Calls.DATE} DESC"
            )
            cursor?.use { c ->
                val numCol = c.getColumnIndex(CallLog.Calls.NUMBER)
                val nameCol = c.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val dateCol = c.getColumnIndex(CallLog.Calls.DATE)
                val durCol = c.getColumnIndex(CallLog.Calls.DURATION)
                val typeCol = c.getColumnIndex(CallLog.Calls.TYPE)

                var count = 0
                while (c.moveToNext() && count < 250) {
                    val num = if (numCol >= 0) c.getString(numCol) ?: "" else ""
                    val name = if (nameCol >= 0) c.getString(nameCol) ?: "" else ""
                    val date = if (dateCol >= 0) c.getLong(dateCol) else 0L
                    val dur = if (durCol >= 0) c.getLong(durCol) else 0L
                    val type = if (typeCol >= 0) c.getInt(typeCol) else 0

                    if (num.isNotEmpty() && date > 0) {
                        list.add(CallLogEntry(num, name, date, dur, type))
                        count++
                    }
                }
            }
        } catch (_: Exception) {}
        return list
    }

    private fun findMatchingCallLog(
        recordingTimestamp: Long,
        parsedNumber: String,
        callLogs: List<CallLogEntry>
    ): CallLogEntry? {
        if (callLogs.isEmpty()) return null

        fun normalize(n: String): String {
            val digits = n.filter { it.isDigit() }
            return if (digits.length > 10) digits.takeLast(10) else digits
        }

        val normParsed = normalize(parsedNumber)

        for (entry in callLogs) {
            val normEntry = normalize(entry.number)
            val numberMatches = normParsed.isNotEmpty() && (normParsed == normEntry)

            val callEndTime = entry.date + (entry.duration * 1000L)
            val diffEndMs = Math.abs(recordingTimestamp - callEndTime)
            val diffStartMs = Math.abs(recordingTimestamp - entry.date)

            // High confidence match: number matches AND within 15 min window
            if (numberMatches && (diffEndMs < 900_000L || diffStartMs < 900_000L)) {
                return entry
            }

            // Timestamp proximity match if no number in filename: within 60s of call end
            if (normParsed.isEmpty() && diffEndMs < 60_000L && entry.duration > 0) {
                return entry
            }
        }
        return null
    }

    @ReactMethod
    fun getCommonFolders(promise: Promise) {
        try {
            val array = Arguments.createArray()
            val dirs = getKnownRecordingDirectories()
            for (dir in dirs) {
                val map = Arguments.createMap()
                map.putString("path", dir.absolutePath)
                map.putString("name", dir.name)
                map.putBoolean("exists", dir.exists())
                map.putBoolean("canRead", dir.canRead())
                val filesCount = if (dir.exists() && dir.isDirectory) {
                    dir.listFiles()?.count { file ->
                        file.isFile && supportedExtensions.contains(file.extension.lowercase(Locale.ROOT))
                    } ?: 0
                } else 0
                map.putInt("audioFilesCount", filesCount)
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("FOLDER_CHECK_ERROR", e.message, e)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Storage Access Framework Folder Picker & Persistence
    // ─────────────────────────────────────────────────────────────

    @ReactMethod
    fun openFolderPicker(promise: Promise) {
        val currentActivity = reactApplicationContext.currentActivity
        if (currentActivity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is not available")
            return
        }

        if (pickerPromise != null) {
            promise.reject("ALREADY_PICKING", "Folder picker is already open")
            return
        }

        pickerPromise = promise

        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
            intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
                Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
            )
            currentActivity.startActivityForResult(intent, REQUEST_CODE_OPEN_DIRECTORY)
        } catch (e: Exception) {
            pickerPromise = null
            promise.reject("INTENT_ERROR", "Cannot open folder picker: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getPersistedFolder(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val uriStr = prefs.getString(KEY_FOLDER_URI, null)
            val name = prefs.getString(KEY_FOLDER_NAME, null)

            if (uriStr != null) {
                val uri = Uri.parse(uriStr)
                val hasPermission = reactApplicationContext.contentResolver.persistedUriPermissions.any {
                    it.uri == uri && it.isReadPermission
                }

                if (hasPermission) {
                    val map = Arguments.createMap()
                    map.putString("uri", uriStr)
                    map.putString("name", name ?: getFolderNameFromUri(uri))
                    promise.resolve(map)
                    return
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("GET_FOLDER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearPersistedFolder(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val uriStr = prefs.getString(KEY_FOLDER_URI, null)
            if (uriStr != null) {
                try {
                    val uri = Uri.parse(uriStr)
                    reactApplicationContext.contentResolver.releasePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    )
                } catch (_: Exception) {}
            }
            prefs.edit().clear().apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_FOLDER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun scanFolderUri(treeUriStr: String, promise: Promise) {
        Thread {
            try {
                val uri = Uri.parse(treeUriStr)
                val rootDoc = DocumentFile.fromTreeUri(reactApplicationContext, uri)
                if (rootDoc == null || !rootDoc.exists() || !rootDoc.canRead()) {
                    promise.reject("SAF_CANNOT_READ", "Cannot access or read the selected folder URI.")
                    return@Thread
                }

                val callLogs = queryRecentCallLogs()
                val discoveredMap = LinkedHashMap<String, WritableMap>()
                scanDocumentFolderRecursively(rootDoc, discoveredMap, 0, callLogs)

                val resultArray = Arguments.createArray()
                for (entry in discoveredMap.values) {
                    resultArray.pushMap(entry)
                }
                promise.resolve(resultArray)
            } catch (e: Exception) {
                promise.reject("SAF_SCAN_FAILED", "Failed scanning selected folder: ${e.message}", e)
            }
        }.start()
    }

    private fun scanDocumentFolderRecursively(
        docDir: DocumentFile,
        discoveredMap: LinkedHashMap<String, WritableMap>,
        depth: Int,
        callLogs: List<CallLogEntry>
    ) {
        if (depth > 3) return
        val children = docDir.listFiles()

        for (child in children) {
            if (child.isDirectory) {
                scanDocumentFolderRecursively(child, discoveredMap, depth + 1, callLogs)
            } else if (child.isFile) {
                val name = child.name ?: ""
                val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
                if (supportedExtensions.contains(ext)) {
                    val uriStr = child.uri.toString()
                    if (!discoveredMap.containsKey(uriStr)) {
                        var durationMs = 0L
                        var mime = child.type ?: "audio/$ext"

                        try {
                            val retriever = MediaMetadataRetriever()
                            retriever.setDataSource(reactApplicationContext, child.uri)
                            val durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                            durationMs = durStr?.toLongOrNull() ?: 0L
                            val extractedMime = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE)
                            if (!extractedMime.isNullOrEmpty()) mime = extractedMime
                            retriever.release()
                        } catch (_: Exception) {}

                        val item = buildRecordingMetadata(
                            id = "saf_${name.hashCode()}_${child.length()}",
                            fileName = name,
                            filePath = uriStr,
                            fileUri = uriStr,
                            durationMs = durationMs,
                            sizeBytes = child.length(),
                            timestamp = child.lastModified(),
                            mimeType = mime,
                            source = "saf",
                            callLogs = callLogs
                        )
                        discoveredMap[uriStr] = item
                    }
                }
            }
        }
    }

    private fun getFolderNameFromUri(uri: Uri): String {
        try {
            val doc = DocumentFile.fromTreeUri(reactApplicationContext, uri)
            if (doc != null && doc.name != null) {
                return doc.name!!
            }
            val path = uri.path ?: ""
            if (path.contains(":")) {
                val segment = path.substringAfterLast(":")
                return segment.substringAfterLast("/")
            }
        } catch (_: Exception) {}
        return "Custom Folder"
    }

    // ─────────────────────────────────────────────────────────────
    // Full Recording Discovery Scan (MediaStore + OEM Folders + SAF + CallLog Matching)
    // ─────────────────────────────────────────────────────────────

    @ReactMethod
    fun scanRecordings(options: ReadableMap?, promise: Promise) {
        Thread {
            try {
                val discoveredMap = LinkedHashMap<String, WritableMap>()
                val callLogs = queryRecentCallLogs()

                // 1. Scan via MediaStore Audio Media
                scanMediaStore(discoveredMap, callLogs)

                // 2. Scan via Direct Filesystem on Known OEM Folders
                scanPhysicalFolders(discoveredMap, callLogs)

                // 3. Scan Persisted SAF Folder if configured
                val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val persistedUriStr = prefs.getString(KEY_FOLDER_URI, null)
                if (persistedUriStr != null) {
                    try {
                        val treeUri = Uri.parse(persistedUriStr)
                        val docDir = DocumentFile.fromTreeUri(reactApplicationContext, treeUri)
                        if (docDir != null && docDir.exists() && docDir.canRead()) {
                            scanDocumentFolderRecursively(docDir, discoveredMap, 0, callLogs)
                        }
                    } catch (_: Exception) {}
                }

                // Convert map to WritableArray
                val resultArray = Arguments.createArray()
                for (entry in discoveredMap.values) {
                    resultArray.pushMap(entry)
                }

                promise.resolve(resultArray)
            } catch (e: Exception) {
                promise.reject("SCAN_FAILED", "Failed scanning recordings: ${e.message}", e)
            }
        }.start()
    }

    private fun scanMediaStore(
        discoveredMap: LinkedHashMap<String, WritableMap>,
        callLogs: List<CallLogEntry>
    ) {
        val resolver = reactApplicationContext.contentResolver ?: return

        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.MIME_TYPE
        )

        val selection = "${MediaStore.Audio.Media.DURATION} >= ?"
        val selectionArgs = arrayOf("1000") // at least 1 second
        val sortOrder = "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"

        val cursor = resolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            sortOrder
        )

        cursor?.use { c ->
            val idCol = c.getColumnIndex(MediaStore.Audio.Media._ID)
            val nameCol = c.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
            val dataCol = c.getColumnIndex(MediaStore.Audio.Media.DATA)
            val durCol = c.getColumnIndex(MediaStore.Audio.Media.DURATION)
            val sizeCol = c.getColumnIndex(MediaStore.Audio.Media.SIZE)
            val dateCol = c.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED)
            val mimeCol = c.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE)

            while (c.moveToNext()) {
                val id = if (idCol >= 0) c.getLong(idCol) else -1L
                val name = if (nameCol >= 0) c.getString(nameCol) ?: "" else ""
                val path = if (dataCol >= 0) c.getString(dataCol) ?: "" else ""
                val durationMs = if (durCol >= 0) c.getLong(durCol) else 0L
                val sizeBytes = if (sizeCol >= 0) c.getLong(sizeCol) else 0L
                val dateModified = if (dateCol >= 0) c.getLong(dateCol) * 1000L else System.currentTimeMillis()
                val mimeType = if (mimeCol >= 0) c.getString(mimeCol) ?: "audio/mpeg" else "audio/mpeg"

                if (path.isEmpty()) continue

                if (isCallRecordingFile(name, path)) {
                    val contentUri = ContentUris.withAppendedId(
                        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                        id
                    ).toString()

                    val item = buildRecordingMetadata(
                        id = "ms_$id",
                        fileName = name.ifEmpty { File(path).name },
                        filePath = path,
                        fileUri = contentUri,
                        durationMs = durationMs,
                        sizeBytes = sizeBytes,
                        timestamp = dateModified,
                        mimeType = mimeType,
                        source = "media_store",
                        callLogs = callLogs
                    )
                    discoveredMap[path] = item
                }
            }
        }
    }

    private fun scanPhysicalFolders(
        discoveredMap: LinkedHashMap<String, WritableMap>,
        callLogs: List<CallLogEntry>
    ) {
        val folders = getKnownRecordingDirectories()
        for (folder in folders) {
            if (!folder.exists() || !folder.isDirectory || !folder.canRead()) continue
            scanDirectoryRecursively(folder, discoveredMap, 0, callLogs)
        }
    }

    private fun scanDirectoryRecursively(
        dir: File,
        discoveredMap: LinkedHashMap<String, WritableMap>,
        depth: Int,
        callLogs: List<CallLogEntry>
    ) {
        if (depth > 2) return
        val files = dir.listFiles() ?: return

        for (file in files) {
            if (file.isDirectory) {
                scanDirectoryRecursively(file, discoveredMap, depth + 1, callLogs)
            } else if (file.isFile) {
                val ext = file.extension.lowercase(Locale.ROOT)
                if (supportedExtensions.contains(ext)) {
                    val path = file.absolutePath
                    if (!discoveredMap.containsKey(path)) {
                        var durationMs = 0L
                        var mime = "audio/$ext"
                        try {
                            val retriever = MediaMetadataRetriever()
                            retriever.setDataSource(path)
                            val durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                            durationMs = durStr?.toLongOrNull() ?: 0L
                            val extractedMime = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE)
                            if (!extractedMime.isNullOrEmpty()) mime = extractedMime
                            retriever.release()
                        } catch (_: Exception) {}

                        val item = buildRecordingMetadata(
                            id = "fs_${file.name.hashCode()}_${file.length()}",
                            fileName = file.name,
                            filePath = path,
                            fileUri = Uri.fromFile(file).toString(),
                            durationMs = durationMs,
                            sizeBytes = file.length(),
                            timestamp = file.lastModified(),
                            mimeType = mime,
                            source = "filesystem",
                            callLogs = callLogs
                        )
                        discoveredMap[path] = item
                    }
                }
            }
        }
    }

    private fun isCallRecordingFile(name: String, path: String): Boolean {
        val lowerName = name.lowercase(Locale.ROOT)
        val lowerPath = path.lowercase(Locale.ROOT)

        for (keyword in callKeywords) {
            if (lowerPath.contains(keyword)) return true
        }

        for (keyword in callKeywords) {
            if (lowerName.contains(keyword)) return true
        }

        val phonePattern = Pattern.compile("(\\+?[0-9]{8,15})")
        if (phonePattern.matcher(name).find()) return true

        return false
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 5: Build Comprehensive Call Metadata (CallLog Matching & Filename Extraction)
    // ─────────────────────────────────────────────────────────────

    private fun buildRecordingMetadata(
        id: String,
        fileName: String,
        filePath: String,
        fileUri: String,
        durationMs: Long,
        sizeBytes: Long,
        timestamp: Long,
        mimeType: String,
        source: String,
        callLogs: List<CallLogEntry>
    ): WritableMap {
        val map = Arguments.createMap()
        map.putString("id", id)
        map.putString("fileName", fileName)
        map.putString("filePath", filePath)
        map.putString("fileUri", fileUri)
        map.putDouble("duration", (durationMs / 1000.0))
        map.putDouble("sizeBytes", sizeBytes.toDouble())
        map.putDouble("timestamp", timestamp.toDouble())
        map.putString("mimeType", mimeType)
        map.putString("discoverySource", source)

        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        map.putString("createdAt", sdf.format(Date(timestamp)))

        // 1. Filename parser
        val parsed = parseFilenameDetails(fileName)

        // 2. CallLog matching
        val matchedCall = findMatchingCallLog(timestamp, parsed.phone, callLogs)

        var finalPhone = parsed.phone
        var finalName = parsed.name
        var finalCallType = parsed.callType
        var matched = false

        if (matchedCall != null) {
            matched = true
            finalPhone = matchedCall.number
            if (matchedCall.name.isNotEmpty()) {
                finalName = matchedCall.name
            }
            finalCallType = when (matchedCall.type) {
                CallLog.Calls.INCOMING_TYPE -> "incoming"
                CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                CallLog.Calls.MISSED_TYPE -> "missed"
                else -> parsed.callType
            }
        }

        if (finalName.isEmpty()) {
            finalName = if (finalPhone.isNotEmpty()) finalPhone else fileName
        }

        val isIncoming = finalCallType == "incoming"
        val from = if (isIncoming) finalName else "Telecaller"
        val to = if (isIncoming) "Telecaller" else finalName

        map.putString("phoneNumber", finalPhone)
        map.putString("contactName", finalName)
        map.putString("callType", finalCallType)
        map.putString("from", from)
        map.putString("to", to)
        map.putBoolean("matchedWithCallLog", matched)

        return map
    }

    private data class ParsedDetails(val phone: String, val name: String, val callType: String)

    private fun parseFilenameDetails(fileName: String): ParsedDetails {
        var phone = ""
        var name = ""
        var callType = "unknown"

        val lower = fileName.lowercase(Locale.ROOT)
        if (lower.contains("outgoing") || lower.contains("out_") || lower.contains("_out")) {
            callType = "outgoing"
        } else if (lower.contains("incoming") || lower.contains("in_") || lower.contains("_in")) {
            callType = "incoming"
        }

        val phoneMatcher = Pattern.compile("(\\+?[0-9]{8,15})").matcher(fileName)
        if (phoneMatcher.find()) {
            phone = phoneMatcher.group(1) ?: ""
        }

        val nameMatcher = Pattern.compile("([A-Za-z\\s]{2,25})[\\(_-]").matcher(fileName)
        if (nameMatcher.find()) {
            val potential = (nameMatcher.group(1) ?: "").trim()
            val lowerPot = potential.lowercase(Locale.ROOT)
            if (!callKeywords.contains(lowerPot)) {
                name = potential
            }
        }

        return ParsedDetails(phone, name, callType)
    }
}
