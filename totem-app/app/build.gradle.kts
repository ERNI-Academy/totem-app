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

    sourceSets["main"].assets.srcDirs("../../packages/totem-original/dist/android")

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

val bundleTotemOriginal by tasks.registering(Exec::class) {
    workingDir(rootProject.projectDir.parentFile)
    commandLine("npm", "run", "build:totem-apk")
    inputs.dir(rootProject.file("../packages/totem-original/web"))
    inputs.dir(rootProject.file("../packages/totem-original/resources"))
    inputs.file(rootProject.file("../scripts/build-totem-apk.mjs"))
    inputs.file(rootProject.file("../scripts/verify-totem-resources.mjs"))
    inputs.file(rootProject.file("../packages/totem-original/manifest.json"))
    inputs.file(rootProject.file("../packages/totem-original/document.json"))
    outputs.dir(rootProject.file("../packages/totem-original/dist/android"))
}
tasks.named("preBuild") { dependsOn(bundleTotemOriginal) }

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
}
