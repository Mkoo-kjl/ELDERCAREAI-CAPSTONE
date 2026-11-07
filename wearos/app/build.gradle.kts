plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.eldercareai.watch"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.eldercareai.watch"
        minSdk = 30
        targetSdk = 36
        versionCode = 12
        versionName = "1.4.5"
        // Public project URL, never a service-role key or device credential.
        buildConfigField("String", "SUPABASE_URL", "\"https://iuhulbsgsmpezpmegeis.supabase.co\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation(fileTree("libs") { include("*.aar") })
    testImplementation("junit:junit:4.13.2")
}
