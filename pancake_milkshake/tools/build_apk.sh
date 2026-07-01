#!/usr/bin/env bash
# Build a signed debug APK for Bunny Pancake, Cat Milkshake using the Android
# SDK command-line tools directly (no Gradle). Run from the project root.
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/35.0.0"
PLAT="$SDK/platforms/android-35/android.jar"
PKG_DIR="com/kidsgames/pancakemilkshake"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/android"
BUILD="$AND/build"
KS="$AND/debug.keystore"

echo "SDK: $SDK"
[ -f "$PLAT" ] || { echo "android.jar not found: $PLAT"; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/dex"

echo "== 1/6 javac =="
javac --release 17 -classpath "$PLAT" -d "$BUILD/classes" \
    "$AND/src/$PKG_DIR/MainActivity.java"

echo "== 2/6 d8 (dex) =="
"$BT/d8" --min-api 21 --lib "$PLAT" \
    --output "$BUILD/dex" \
    "$BUILD/classes/$PKG_DIR/"*.class

echo "== 3/6 aapt package (manifest + assets) =="
"$BT/aapt" package -f \
    -M "$AND/AndroidManifest.xml" \
    -S "$AND/res" \
    -A "$AND/assets" \
    -I "$PLAT" \
    -F "$BUILD/app-unaligned.apk"

echo "== 4/6 add classes.dex =="
( cd "$BUILD/dex" && "$BT/aapt" add "$BUILD/app-unaligned.apk" classes.dex >/dev/null )

echo "== 5/6 zipalign =="
"$BT/zipalign" -f 4 "$BUILD/app-unaligned.apk" "$BUILD/app-aligned.apk"

echo "== 6/6 sign =="
if [ ! -f "$KS" ]; then
    echo "  creating debug keystore"
    keytool -genkeypair -v -keystore "$KS" \
        -storepass android -keypass android -alias androiddebugkey \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=Android Debug,O=KidsGames,C=US" >/dev/null 2>&1
fi
"$BT/apksigner" sign \
    --ks "$KS" --ks-pass pass:android --key-pass pass:android \
    --out "$BUILD/pancake_milkshake.apk" \
    "$BUILD/app-aligned.apk"

echo
echo "APK: $BUILD/pancake_milkshake.apk"
ls -lh "$BUILD/pancake_milkshake.apk"
