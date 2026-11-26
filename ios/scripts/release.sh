#!/bin/zsh
# Builds the iPhone, iPad and Watch app for the App Store and uploads it.
#
#   ios/scripts/release.sh          # raises the build number, archives, uploads
#
# Uses the App Store Connect API key in ~/.appstoreconnect/private_keys/
# (Key ID and Issuer ID below aren't secret; the .p8 file is, and never
# leaves that folder). The build appears in App Store Connect → TestFlight
# about 15–30 minutes later; then select it on the version page and submit.
#
# For a new version people will see (1.1, 1.2…), first change
# MARKETING_VERSION in project.yml and create that version in App Store
# Connect.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY_ID="AB652382UH"
ISSUER_ID="3b5e1a2a-81d1-4f34-b541-e8b8221f2f12"
KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY_PATH" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER_ID")

# Every upload needs a new build number.
current=$(grep -E '^\s+CURRENT_PROJECT_VERSION:' project.yml | grep -oE '[0-9]+')
next=$((current + 1))
sed -i '' -E "s/(CURRENT_PROJECT_VERSION: )\"[0-9]+\"/\1\"${next}\"/" project.yml
version=$(grep -E '^\s+MARKETING_VERSION:' project.yml | grep -oE '[0-9.]+')
echo "Building ${version} (${next})"

xcodegen generate >/dev/null
rm -rf build/Mount.xcarchive build/export
xcodebuild -project Mount.xcodeproj -scheme Mount -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Mount.xcarchive "${AUTH[@]}" archive -quiet

cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>LUX5PGSCA8</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST

xcodebuild -exportArchive -archivePath build/Mount.xcarchive -exportOptionsPlist build/ExportOptions.plist \
  -exportPath build/export "${AUTH[@]}"
echo "Uploaded ${version} (${next}). It appears in TestFlight once Apple has processed it."
