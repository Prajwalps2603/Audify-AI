# ProGuard & R8 Optimization Rules for TeleCaller AI (Phase 16)

# React Native Core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.telecallerai.** { *; }

# React Native Encrypted Storage & Android KeyStore
-keep class androidx.security.crypto.** { *; }
-keep class com.emeraldsanto.encryptedstorage.** { *; }

# Google Sign-In & Play Services Auth
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.reactnativegooglesignin.** { *; }

# AndroidX DocumentFile & Storage Access Framework (SAF)
-keep class androidx.documentfile.provider.** { *; }

# Kotlin Coroutines & Reflection
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }
