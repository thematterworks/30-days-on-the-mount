import AVFoundation
import Foundation
import MediaPlayer
import Observation
import OSLog

/// Everything the app plays: the ambient music under the whole hub, and the
/// voice that reads scripture and the companion aloud.
///
/// Two rules keep it polite:
/// - The music never interrupts the participant's own audio. The session
///   mixes with other apps, and if something else is already playing when
///   the app opens, the ambient bed stays silent rather than layering over it.
/// - Anything meant to be listened to (the voice, a teaching video, the
///   welcome film) ducks the music beneath it, and the music comes back up
///   when it ends — as the web journey does under its teaching video.
@MainActor
@Observable
final class AudioDirector {
    struct Track: Decodable, Hashable, Sendable {
        let title: String
        let artist: String
        let url: URL
        let credit: String?
    }

    /// The participant's choice, remembered. On by default: the music is
    /// part of the sanctuary, and one tap turns it off.
    var isAmbientOn: Bool {
        didSet {
            SharedStore.defaults.set(isAmbientOn, forKey: Self.ambientKey)
            // Tapping it on is a clear request: play even if another app's
            // audio is around, and on a fresh session (dictation or a call
            // may have changed it).
            if isAmbientOn {
                configureSession()
                startAmbient(requested: true)
            } else {
                stopAmbient()
            }
        }
    }
    private(set) var tracks: [Track] = AudioDirector.fallbackTracks
    private(set) var nowPlaying: Track?

    /// Which passage the voice is on, so its button can show progress.
    private(set) var speakingID: String?
    private(set) var isPreparingSpeech = false
    var speechError: String?

    private let media: any MediaService
    private var ambientPlayer: AVPlayer?
    private var voicePlayer: AVQueuePlayer?
    private var duckReasons: Set<String> = []
    private var fadeTask: Task<Void, Never>?
    private var trackIndex = 0
    private var observers: [NSObjectProtocol] = []
    private var hasRemoteCommands = false
    /// Later parts of a long passage still on their way.
    private var isFetchingParts = false

    private static let ambientKey = "audio.ambientOn.v1"
    private static let ambientVolume: Float = 0.32
    private static let duckedVolume: Float = 0.06

    /// What plays before the server's list arrives, and if it never does.
    nonisolated static let fallbackTracks = [Track(
        title: "Weightless Stillness",
        artist: "30 Days on the Mount",
        url: URL(string: "https://abhbwguyrpjgqbyhomll.supabase.co/storage/v1/object/public/audio/Weightless_Stillness_2026-06-01T180237.mp3")!,
        credit: nil
    )]

    init(media: any MediaService) {
        self.media = media
        isAmbientOn = SharedStore.defaults.object(forKey: Self.ambientKey) as? Bool ?? true
        #if DEBUG
        // Simulator walkthroughs stay silent on the developer's Mac.
        if ProcessInfo.processInfo.arguments.contains("-silent") { isAmbientOn = false }
        #endif
        trackIndex = Int.random(in: 0..<max(tracks.count, 1))
    }

    // MARK: Lifecycle

    /// Called once the participant is inside the hub.
    func begin() async {
        configureSession()
        if let remote = try? await media.ambientTracks(), !remote.isEmpty {
            // Rotating means a different track each time the app opens, then
            // each in turn.
            tracks = remote
            trackIndex = Int.random(in: 0..<remote.count)
        }
        startAmbient()
    }

    /// The phone locking, or the app going to the background, doesn't end
    /// the music or a passage being read: both carry on, like any audio app,
    /// and pause from the Lock Screen. Coming back only resumes the music if
    /// something else had silenced it.
    func enterForeground() {
        startAmbient()
    }


    private func configureSession() {
        do {
            // .playback so the bed is heard with the ring switch on silent,
            // .mixWithOthers so it never stops someone's podcast.
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            Logger.app.error("Audio session failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: Ambient

    private func startAmbient(requested: Bool = false) {
        guard isAmbientOn, !tracks.isEmpty else { return }
        // Someone else's music is playing: let it be, unless the participant
        // just asked for ours.
        guard requested || !AVAudioSession.sharedInstance().secondaryAudioShouldBeSilencedHint else { return }
        if ambientPlayer == nil { load(trackIndex) }
        // Always play and fade up — even mid fade-out, which a quick
        // off-then-on would otherwise leave to finish in silence.
        ambientPlayer?.play()
        fade(to: targetVolume, over: requested ? 1.2 : 2.5)
    }

    private func stopAmbient(fade shouldFade: Bool = true) {
        guard let player = ambientPlayer else { return }
        if shouldFade {
            fade(to: 0, over: 1.2) { player.pause() }
        } else {
            fadeTask?.cancel()
            player.pause()
        }
    }

    private func load(_ index: Int) {
        guard tracks.indices.contains(index) else { return }
        let track = tracks[index]
        let item = AVPlayerItem(url: track.url)
        if let ambientPlayer {
            ambientPlayer.replaceCurrentItem(with: item)
        } else {
            let player = AVPlayer(playerItem: item)
            player.volume = 0
            player.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
            ambientPlayer = player
        }
        nowPlaying = track
        publishNowPlaying(track)
        observers.forEach(NotificationCenter.default.removeObserver)
        observers = [NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.advance() }
        }]
    }

    /// The next track in the rotation.
    private func advance() {
        trackIndex = (trackIndex + 1) % max(tracks.count, 1)
        load(trackIndex)
        if isAmbientOn { ambientPlayer?.play() }
    }

    private var targetVolume: Float {
        duckReasons.isEmpty ? Self.ambientVolume : Self.duckedVolume
    }

    private func fade(to volume: Float, over seconds: Double, then completion: (@MainActor () -> Void)? = nil) {
        fadeTask?.cancel()
        guard let player = ambientPlayer else { return }
        let start = player.volume
        let steps = 24
        fadeTask = Task { @MainActor in
            for step in 1...steps {
                try? await Task.sleep(for: .seconds(seconds / Double(steps)))
                if Task.isCancelled { return }
                player.volume = start + (volume - start) * Float(step) / Float(steps)
            }
            completion?()
        }
    }


    // MARK: Lock Screen

    /// The music on the Lock Screen and in Control Center, with play and
    /// pause that turn the ambient sound on and off.
    private func publishNowPlaying(_ track: Track) {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist.isEmpty ? "30 Days on the Mount" : track.artist,
        ]
        guard !hasRemoteCommands else { return }
        hasRemoteCommands = true
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.addTarget { [weak self] _ in
            MainActor.assumeIsolated { self?.isAmbientOn = true }
            return .success
        }
        commands.pauseCommand.addTarget { [weak self] _ in
            MainActor.assumeIsolated { self?.isAmbientOn = false }
            return .success
        }
        commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            MainActor.assumeIsolated { self?.isAmbientOn.toggle() }
            return .success
        }
    }

    // MARK: Recording

    /// The microphone would hear the music, so it rests while someone
    /// speaks a reflection.
    func pauseForRecording() {
        stopSpeaking()
        stopAmbient(fade: false)
    }

    func resumeAfterRecording() {
        configureSession()
        startAmbient()
    }

    // MARK: Ducking

    /// Lowers the music while something meant to be listened to plays.
    /// Reasons are counted, so overlapping sources don't restore it early.
    func duck(_ reason: String) {
        duckReasons.insert(reason)
        guard isPlayingAmbient else { return }
        fade(to: Self.duckedVolume, over: 0.6)
    }

    func unduck(_ reason: String) {
        duckReasons.remove(reason)
        guard isPlayingAmbient else { return }
        fade(to: targetVolume, over: 1.5)
    }

    /// Whether the music should be heard at all right now. A fade only ever
    /// moves the volume while this holds, so ducking can't revive music the
    /// participant has turned off.
    private var isPlayingAmbient: Bool {
        isAmbientOn && ambientPlayer?.timeControlStatus != .paused
    }

    // MARK: Voice

    /// Reads `text` aloud in the app's voice, or stops if this passage is
    /// already being read. Long text — a whole chapter — is read in parts,
    /// back to back.
    func toggleSpeaking(_ text: String, id: String) {
        if speakingID == id {
            stopSpeaking()
            return
        }
        stopSpeaking()
        speakingID = id
        isPreparingSpeech = true
        speechError = nil
        duck("voice")
        Task {
            isFetchingParts = true
            defer { isFetchingParts = false }
            do {
                var urls: [URL] = []
                for part in Self.parts(of: text) {
                    urls.append(try await media.speechURL(for: part))
                    // Begin as soon as the first part is ready.
                    if urls.count == 1 { play(urls, id: id) } else { voicePlayer?.insert(AVPlayerItem(url: urls.last!), after: nil) }
                }
            } catch {
                guard speakingID == id else { return }
                speechError = error.localizedDescription
                stopSpeaking()
            }
        }
    }

    func stopSpeaking() {
        voicePlayer?.pause()
        voicePlayer?.removeAllItems()
        voicePlayer = nil
        speakingID = nil
        isPreparingSpeech = false
        unduck("voice")
    }

    private func play(_ urls: [URL], id: String) {
        guard speakingID == id else { return }
        let player = AVQueuePlayer(items: urls.map(AVPlayerItem.init(url:)))
        player.actionAtItemEnd = .advance
        voicePlayer = player
        isPreparingSpeech = false
        player.play()
        // Watching for the queue to run dry is what restores the music.
        Task { @MainActor [weak self, weak player] in
            while let player, let self, self.speakingID == id {
                try? await Task.sleep(for: .milliseconds(400))
                if player.items().isEmpty, !self.isFetchingParts {
                    self.stopSpeaking()
                    return
                }
            }
        }
    }

    /// Splits at sentence ends into parts the voice service accepts.
    static func parts(of text: String, limit: Int = 2400) -> [String] {
        guard text.count > limit else { return [text] }
        var parts: [String] = []
        var current = ""
        text.enumerateSubstrings(in: text.startIndex..., options: .bySentences) { sentence, _, _, _ in
            guard let sentence else { return }
            if current.count + sentence.count > limit, !current.isEmpty {
                parts.append(current)
                current = ""
            }
            current += sentence
        }
        if !current.isEmpty { parts.append(current) }
        return parts
    }
}
