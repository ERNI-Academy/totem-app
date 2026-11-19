package com.erni.totem

import android.content.SharedPreferences
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipFile
import javax.net.ssl.HttpsURLConnection

/** Only the catalogue supplies download URLs. The WebView passes publication IDs. */
class KioskRepository(private val root: File, private val preferences: SharedPreferences) {
    private val catalogUrl = "https://totem-app-livid.vercel.app/api/totem/catalog"
    private val folderPattern = Regex("[0-9a-f-]{36}-[0-9a-f]{64}")
    private var latest = emptyMap<String, JSONObject>()

    init {
        root.mkdirs()
        root.listFiles()?.filter { it.name.startsWith(".download-") }?.forEach { it.deleteRecursively() }
    }

    private fun <T> read(url: String, timeout: Int, block: (InputStream) -> T): T {
        val connection = URL(url).openConnection() as HttpsURLConnection
        try {
            connection.useCaches = false
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 8000
            connection.readTimeout = timeout
            connection.setRequestProperty("Cache-Control", "no-cache")
            check(connection.responseCode == 200)
            return connection.inputStream.use(block)
        } finally {
            connection.disconnect()
        }
    }

    private fun catalog(): JSONObject {
        val result = read(catalogUrl, 10000) { JSONObject(it.bufferedReader().readText()) }
        val publications = result.getJSONArray("visualisations")
        val verified = mutableMapOf<String, JSONObject>()
        for (i in 0 until publications.length()) {
            val entry = publications.getJSONObject(i)
            val id = entry.getString("id")
            require(Regex("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}").matches(id))
            require(entry.getLong("size") in 1..1073741824L && entry.getInt("version") > 0)
            require(Regex("[0-9a-f]{64}").matches(entry.getString("sha256")))
            for (key in listOf("downloadUrl", "thumbnailUrl")) require(URL(entry.getString(key)).protocol == "https")
            verified[id] = entry
        }
        latest = verified
        return result
    }

    fun run(action: String, args: JSONObject, progress: (Int) -> Unit): JSONObject {
        return when (action) {
            "loadState" -> {
                val saved = preferences.getString("state", null)
                JSONObject().put("state", saved?.let { JSONObject(it) } ?: JSONObject.NULL)
            }
            "saveState" -> {
                // Acknowledge activation only after the state survives a process kill.
                val state = args.getJSONObject("state")
                check(preferences.edit().putString("state", state.toString()).commit())
                JSONObject()
            }
            "catalog" -> catalog()
            "stage" -> {
                val item = latest.getValue(args.getString("id"))
                require(item.getString("sha256") == args.getString("sha256"))
                stage(item, progress)
            }
            "remove" -> {
                val folder = args.getString("folder")
                require(folderPattern.matches(folder))
                File(root, folder).deleteRecursively()
                JSONObject()
            }
            else -> error("Unknown action")
        }
    }

    private fun stage(item: JSONObject, progress: (Int) -> Unit): JSONObject {
        val hash = item.getString("sha256")
        val folder = item.getString("id") + "-" + hash
        val destination = File(root, folder)
        val result = JSONObject().put("folder", folder)
        if (File(destination, "index.html").length() > 0) return result
        val temp = java.nio.file.Files.createTempDirectory(root.toPath(), ".download-").toFile()
        try {
            val zip = File(temp, "archive.zip")
            val content = File(temp, "content").apply { check(mkdir()) }
            val size = item.getLong("size")
            check(root.usableSpace >= size * 2)
            val digest = MessageDigest.getInstance("SHA-256")
            var written = 0L
            var previous = -1
            read(item.getString("downloadUrl"), 30000) { input ->
                zip.outputStream().buffered().use { output ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        written += count
                        require(written <= size)
                        digest.update(buffer, 0, count)
                        output.write(buffer, 0, count)
                        val percent = (100 * written / size).toInt()
                        if (percent != previous) { progress(percent); previous = percent }
                    }
                }
            }
            require(written == size && digest.digest().joinToString("") { "%02x".format(it) } == hash)
            extract(zip, content, size)
            read(item.getString("thumbnailUrl"), 15000) { input ->
                File(content, "__cover.webp").outputStream().use { input.copyTo(it) }
            }
            check(content.renameTo(destination))
            return result
        } finally {
            temp.deleteRecursively()
        }
    }

    private fun extract(zip: File, content: File, maxBytes: Long) {
        var total = 0L
        ZipFile(zip).use { archive ->
            for (entry in archive.entries()) {
                val name = entry.name
                require(name != "__cover.webp" && name.none { it == '\\' || it == ':' || it < ' ' })
                require(name.split('/').none { it.isEmpty() || it == "." || it == ".." })
                require(entry.method == java.util.zip.ZipEntry.STORED && entry.size == entry.compressedSize)
                total += entry.size
                require(entry.size >= 0 && total <= maxBytes)
                val target = File(content, name)
                require(target.canonicalPath.startsWith(content.canonicalPath + File.separator))
                target.parentFile?.mkdirs()
                check(target.createNewFile())
                archive.getInputStream(entry).use { input ->
                    target.outputStream().use { output -> require(input.copyTo(output) == entry.size) }
                }
            }
        }
        require(File(content, "index.html").length() > 0)
    }
}
