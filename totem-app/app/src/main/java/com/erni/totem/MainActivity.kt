package com.erni.totem

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import androidx.activity.ComponentActivity
import java.io.File
import java.util.concurrent.Executors
import org.json.JSONObject
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    private val worker = Executors.newSingleThreadExecutor()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )

        val host = "appassets.androidplatform.net"
        val local = File(filesDir, "kiosk")
        val repository = KioskRepository(local, getSharedPreferences("catalog", MODE_PRIVATE))
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/installed/", WebViewAssetLoader.InternalStoragePathHandler(this, local))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                    assetLoader.shouldInterceptRequest(request.url)?.apply {
                        responseHeaders = responseHeaders.orEmpty() + ("Access-Control-Allow-Origin" to "*")
                    }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.isForMainFrame
            }
        }
        check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            "Actualiza Android System WebView para usar el catálogo."
        }
        WebViewCompat.addWebMessageListener(webView, "TotemNative", setOf("https://$host")) {
                _, message, _, mainFrame, reply ->
            if (mainFrame) {
                val request = JSONObject(message.data ?: "{}")
                val id = request.getString("request")
                fun send(key: String, value: Any) {
                    val json = JSONObject().put("request", id).put(key, value).toString()
                    runOnUiThread { if (!isDestroyed) reply.postMessage(json) }
                }
                worker.execute {
                    try {
                        val result = repository.run(request.getString("action"), request.getJSONObject("args")) {
                            send("progress", it)
                        }
                        send("result", result)
                    } catch (_: Exception) {
                        send("error", "No se pudo completar la petición.")
                    }
                }
            }
        }
        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/launcher.html")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        worker.shutdownNow()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
