# APK releases

Each signed APK release is stored in a versioned folder, for example:

```text
release/1.0.0/totem-1.0.0-1.apk
release/1.0.0/checksums.sha256
release/1.0.0/release.json
```

Generated APKs are ignored by Git. Keep a copy in GitHub Releases and use the same signing keystore for every update. Increment `versionCode` in `version.properties` for each new APK.
