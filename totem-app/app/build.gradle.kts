plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val versionProperties = java.util.Properties().apply {
    load(rootProject.file("version.properties").inputStream())
}

android {
    namespace = "com.erni.totem"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.erni.totem"
        minSdk = 30
        targetSdk = 35
        versionName = versionProperties.getProperty("versionName")
        versionCode = versionProperties.getProperty("versionCode").toInt()
    }

    sourceSets["main"].assets.srcDirs("../../totem-web")

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
}
