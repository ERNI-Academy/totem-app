#!/usr/bin/env bash
# Load this script into the current shell before running Gradle.
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/share/jdks/jdk-17.0.21+9}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/share/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
