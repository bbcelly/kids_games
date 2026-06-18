# Cleanup — what was installed to build Beskar Run

Everything added to this Mac while building/exporting the game, so you can remove
it later. Roughly **~13–14 GB** total is reclaimable. Items are grouped by where
they live. Commands are safe to copy-paste.

> ⚠️ **Do NOT remove** the pre-existing `openjdk` (JDK 25) Homebrew formula, the
> rest of `~/Library/Android/sdk`, or `~/Library/Application Support/Godot` data
> for *other* Godot projects — those were already on your machine.

---

## 1. Homebrew packages (newly installed)

| Package | Type | Size | Installed for |
|---|---|---|---|
| `godot` | cask → `/Applications/Godot.app` | ~150 MB | The engine |
| `openjdk@17` | formula → `/opt/homebrew/opt/openjdk@17` | ~300 MB | Gradle needs JDK 17 (not 25) |

```bash
brew uninstall --cask godot
brew uninstall openjdk@17
```

---

## 2. Godot export templates  (~1.9 GB)

Downloaded for Android/APK export, version-pinned to 4.6.3.

```bash
rm -rf "$HOME/Library/Application Support/Godot/export_templates/4.6.3.stable"
# (or remove the whole export_templates dir if you have no other Godot exports)
```

---

## 3. Android SDK packages (newly installed into `~/Library/Android/sdk`)

Added by `sdkmanager` because Godot 4.6.3 targets SDK 36:

| Package | Path | Size |
|---|---|---|
| `build-tools;36.1.0` | `~/Library/Android/sdk/build-tools/36.1.0` | ~192 MB |
| `platforms;android-36` | `~/Library/Android/sdk/platforms/android-36` | ~134 MB |

```bash
rm -rf "$HOME/Library/Android/sdk/build-tools/36.1.0"
rm -rf "$HOME/Library/Android/sdk/platforms/android-36"
```

> The rest of your Android SDK (platform-tools, build-tools 30–35, platforms
> 33–35, NDK, etc.) was already there — leave it.

---

## 4. Gradle distribution + caches  (~8 GB — the big one)

The gradle wrapper downloaded Gradle 8.11.1 plus Android Gradle Plugin and
dependency caches when building the APK. If you don't use Gradle elsewhere:

```bash
rm -rf "$HOME/.gradle"
```

> If you use Gradle for other projects, only remove the Beskar-specific bits:
> `rm -rf "$HOME/.gradle/wrapper/dists/gradle-8.11.1-bin"`

---

## 5. Temp downloads in `/tmp`  (~3.4 GB — safe to delete now)

These were one-time downloads/extractions and aren't needed anymore:

```bash
rm -f  /tmp/godot_templates.tpz          # 1.2 GB
rm -f  /tmp/cmdtools.zip                  # 146 MB (Android command-line tools)
rm -rf /tmp/cmdtools_extract /tmp/tpz_extract /tmp/andsrc /tmp/export_plugin.cpp /tmp/etm.cpp
rm -f  /tmp/shot_*.png /tmp/check.log /tmp/ec.log /tmp/ep.log /tmp/exp*.log /tmp/beskar_play.log /tmp/finish_export.sh
```

> Note: the Android **command-line tools** were only unzipped under `/tmp`
> (never installed into the SDK), so deleting `/tmp/cmdtools*` fully removes them.

---

## 6. Inside this project (`/Users/celly/q_projects/beskar_run_mobile`)

Generated locally; delete only if you're discarding the project:

```bash
rm -rf .venv                 # Python venv with Pillow (asset generation), ~50 MB
rm -rf .godot                # Godot import cache (regenerated on open)
rm -rf build                 # exported APK output
rm -rf android/build/build android/build/.gradle android/build/.cxx   # gradle outputs
```

`android/build/` (the Android build template, ~200 MB) and `debug.keystore` are
part of the project; remove the whole repo to clear them.

---

## 7. Config change to revert (only if you uninstall JDK 17)

I pointed Godot's Android Java SDK path at JDK 17 in your global editor settings.
If you remove `openjdk@17`, change this line back (or blank it) so Godot doesn't
error:

- File: `~/Library/Application Support/Godot/editor_settings-4.6.tres`
- Line: `export/android/java_sdk_path = "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"`

Also, per-game save data lives at
`~/Library/Application Support/Godot/app_userdata/Beskar Run/` (tiny) — remove if
you want a clean slate.

---

## One-shot "remove it all" (if you don't keep Godot/Gradle for anything else)

```bash
brew uninstall --cask godot
brew uninstall openjdk@17
rm -rf "$HOME/Library/Application Support/Godot/export_templates/4.6.3.stable"
rm -rf "$HOME/Library/Android/sdk/build-tools/36.1.0" "$HOME/Library/Android/sdk/platforms/android-36"
rm -rf "$HOME/.gradle"
rm -f  /tmp/godot_templates.tpz /tmp/cmdtools.zip
rm -rf /tmp/cmdtools_extract /tmp/tpz_extract /tmp/andsrc
rm -rf "$HOME/Library/Application Support/Godot/app_userdata/Beskar Run"
```
