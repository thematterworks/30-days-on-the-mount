import AVFoundation
import AVKit
import CoreTransferable
import OSLog
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Photos, videos and voice messages in a group's conversation: made ready on
// the phone (sized, compressed, a video's poster and a sheet of its frames
// for the screen), uploaded straight to storage, then posted — and screened
// before anyone else sees them (lib/community.ts).

/// A photo or video chosen from the library.
struct PickedMovie: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            let copy = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).\(received.file.pathExtension)")
            try FileManager.default.copyItem(at: received.file, to: copy)
            return PickedMovie(url: copy)
        }
    }
}

/// Media ready to upload.
struct PreparedMedia: Sendable {
    enum Kind: Sendable { case image, video, audio }
    let kind: Kind
    /// The file itself: a JPEG, an MP4 or an M4A.
    let file: URL
    var poster: Data?
    var frames: Data?
    var duration: Double?
    var width: Double?
    var height: Double?

    var remoteKind: SharedMedia.Kind {
        switch kind {
        case .image: .image
        case .video: .video
        case .audio: .audio
        }
    }

    var label: String {
        switch kind {
        case .image: "photo"
        case .video: "video"
        case .audio: "voice message"
        }
    }
}

enum MediaPreparation {
    /// Videos are kept short: this is a conversation, not a channel.
    static let maxVideoSeconds = 90.0
    static let maxVoiceSeconds = 180.0

    enum Problem: LocalizedError {
        case tooLong, unreadable
        var errorDescription: String? {
            switch self {
            case .tooLong: "Videos can be up to a minute and a half."
            case .unreadable: "That couldn't be opened."
            }
        }
    }

    /// A photo, at most 2048 points on its long side.
    static func image(_ data: Data) throws -> PreparedMedia {
        guard let original = UIImage(data: data) else { throw Problem.unreadable }
        let scale = min(1, 2048 / max(original.size.width, original.size.height))
        let size = CGSize(width: original.size.width * scale, height: original.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in original.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = resized.jpegData(compressionQuality: 0.82) else { throw Problem.unreadable }
        let file = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).jpg")
        try jpeg.write(to: file)
        return PreparedMedia(kind: .image, file: file, width: size.width, height: size.height)
    }

    /// A video, re-encoded to a modest MP4, with its poster frame and a
    /// two-by-two sheet of frames from through it.
    static func video(_ source: URL) async throws -> PreparedMedia {
        let asset = AVURLAsset(url: source)
        let duration = try await asset.load(.duration).seconds
        guard duration <= maxVideoSeconds + 0.5 else { throw Problem.tooLong }
        let natural = try await asset.loadTracks(withMediaType: .video).first?.load(.naturalSize) ?? .zero
        let transform = try await asset.loadTracks(withMediaType: .video).first?.load(.preferredTransform) ?? .identity
        let size = natural.applying(transform)

        let output = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).mp4")
        guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else { throw Problem.unreadable }
        try await export.export(to: output, as: .mp4)

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 720, height: 720)
        var images: [UIImage] = []
        for fraction in [0.05, 0.35, 0.65, 0.95] {
            let time = CMTime(seconds: duration * fraction, preferredTimescale: 600)
            if let frame = try? await generator.image(at: time).image { images.append(UIImage(cgImage: frame)) }
        }
        guard let first = images.first else { throw Problem.unreadable }
        let sheet = UIGraphicsImageRenderer(size: CGSize(width: 1024, height: 1024)).image { _ in
            for (index, image) in images.enumerated() {
                let cell = CGRect(x: CGFloat(index % 2) * 512, y: CGFloat(index / 2) * 512, width: 512, height: 512)
                let fit = AVMakeRect(aspectRatio: image.size, insideRect: cell)
                image.draw(in: fit)
            }
        }
        return PreparedMedia(
            kind: .video,
            file: output,
            poster: first.jpegData(compressionQuality: 0.8),
            frames: sheet.jpegData(compressionQuality: 0.7),
            duration: duration,
            width: abs(size.width),
            height: abs(size.height)
        )
    }
}

enum MediaUploader {
    /// Puts a file at a signed upload URL.
    static func put(_ body: Data, to target: MediaUpload.Target) async throws {
        var request = URLRequest(url: target.uploadURL)
        request.httpMethod = "PUT"
        request.timeoutInterval = 180
        request.setValue(target.contentType, forHTTPHeaderField: "Content-Type")
        let (_, response) = try await URLSession.shared.upload(for: request, from: body)
        guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
            throw APIError.server("It couldn't be uploaded just now.")
        }
    }

    /// Uploads prepared media for a group, returning what the post carries.
    static func upload(_ media: PreparedMedia, group: String, service: any TogetherService) async throws -> PostMediaReference {
        let targets = try await service.mediaUpload(group: group, kind: media.remoteKind)
        try await put(try Data(contentsOf: media.file), to: targets.upload)
        var reference = PostMediaReference(kind: media.remoteKind.rawValue, path: targets.upload.path, duration: media.duration, width: media.width, height: media.height)
        if let poster = media.poster, let thumb = targets.thumb {
            try await put(poster, to: thumb)
            reference.thumbPath = thumb.path
        }
        if let frames = media.frames, let target = targets.frames {
            try await put(frames, to: target)
            reference.framesPath = target.path
        }
        try? FileManager.default.removeItem(at: media.file)
        return reference
    }
}

/// Records a voice message: tap to begin, then send or cancel. The music
/// rests while the microphone listens.
@MainActor
@Observable
final class VoiceRecorder {
    private(set) var isRecording = false
    private(set) var elapsed: TimeInterval = 0
    private var recorder: AVAudioRecorder?
    private var ticker: Task<Void, Never>?
    private let audio: AudioDirector

    init(audio: AudioDirector) {
        self.audio = audio
    }

    func start() async -> Bool {
        guard await AVAudioApplication.requestRecordPermission() else { return false }
        audio.pauseForRecording()
        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).m4a")
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
            let recorder = try AVAudioRecorder(url: url, settings: [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ])
            recorder.record(forDuration: MediaPreparation.maxVoiceSeconds)
            self.recorder = recorder
        } catch {
            Logger.app.error("Recording couldn't start: \(error.localizedDescription, privacy: .public)")
            audio.resumeAfterRecording()
            return false
        }
        isRecording = true
        elapsed = 0
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(200))
                guard let self, let recorder = self.recorder else { return }
                self.elapsed = recorder.currentTime
                if !recorder.isRecording { return }
            }
        }
        return true
    }

    /// Stops and returns the recording, if it's long enough to be one.
    func finish() -> PreparedMedia? {
        guard let recorder else { return nil }
        let duration = recorder.currentTime
        recorder.stop()
        cleanUp()
        guard duration >= 1 else {
            try? FileManager.default.removeItem(at: recorder.url)
            return nil
        }
        return PreparedMedia(kind: .audio, file: recorder.url, duration: duration)
    }

    func cancel() {
        guard let recorder else { return }
        recorder.stop()
        recorder.deleteRecording()
        cleanUp()
    }

    private func cleanUp() {
        ticker?.cancel()
        recorder = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        audio.resumeAfterRecording()
    }
}

// MARK: - In the thread

/// A photo, a video's poster, or a voice message, inside a message bubble.
struct MediaContent: View {
    let media: SharedMedia
    let mine: Bool

    @State private var isViewing = false

    var body: some View {
        switch media.kind {
        case .image, .video:
            Button { isViewing = true } label: {
                AsyncImage(url: media.kind == .image ? media.url : media.thumbURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Rectangle().fill(Zoe.ink.opacity(0.08)).overlay(ProgressView().tint(Zoe.peach))
                }
                .frame(width: 230, height: 230 * aspect)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay {
                    if media.kind == .video {
                        Image(systemName: "play.fill")
                            .font(.title2)
                            .foregroundStyle(Zoe.ink)
                            .frame(width: 54, height: 54)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(media.kind == .image ? "Photo" : "Video")
            .fullScreenCover(isPresented: $isViewing) {
                MediaViewer(media: media)
            }
        case .audio:
            VoiceMessagePlayer(media: media, mine: mine)
        }
    }

    /// Height over width, kept between square-ish limits so a thread stays calm.
    private var aspect: CGFloat {
        guard let width = media.width, let height = media.height, width > 0 else { return 1 }
        return min(max(height / width, 0.6), 1.35)
    }
}

/// A photo or video, full screen.
private struct MediaViewer: View {
    let media: SharedMedia
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model
    @State private var player: AVPlayer?

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            if media.kind == .image {
                AsyncImage(url: media.url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    ProgressView().tint(.white)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let player {
                VideoPlayer(player: player).ignoresSafeArea()
            }
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .padding(20)
            .accessibilityLabel("Close")
        }
        .onAppear {
            guard media.kind == .video else { return }
            model.audio.duck("group-video")
            let player = AVPlayer(url: media.url)
            self.player = player
            player.play()
        }
        .onDisappear {
            player?.pause()
            model.audio.unduck("group-video")
        }
    }
}

/// A voice message: play, how far through, how long — and the words, for
/// anyone who'd rather read.
private struct VoiceMessagePlayer: View {
    let media: SharedMedia
    let mine: Bool

    @Environment(AppModel.self) private var model
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var progress: Double = 0
    @State private var showsWords = false
    @State private var observer: Any?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button(action: toggle) {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.body)
                        .frame(width: 36, height: 36)
                        .background((mine ? Zoe.deep : Zoe.peach).opacity(0.18), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isPlaying ? "Pause" : "Play voice message")
                Capsule()
                    .fill((mine ? Zoe.deep : Zoe.ink).opacity(0.2))
                    .frame(height: 4)
                    .overlay(alignment: .leading) {
                        GeometryReader { proxy in
                            Capsule().fill(mine ? Zoe.deep : Zoe.peach).frame(width: proxy.size.width * progress)
                        }
                    }
                    .frame(width: 120, height: 4)
                Text(Duration.seconds(media.duration ?? 0).formatted(.time(pattern: .minuteSecond)))
                    .font(.caption.monospacedDigit())
                    .opacity(0.75)
            }
            if let words = media.transcript, !words.isEmpty {
                Button { withAnimation { showsWords.toggle() } } label: {
                    Text(showsWords ? words : "Show words")
                        .font(.caption)
                        .opacity(0.75)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(.plain)
            }
        }
        .foregroundStyle(mine ? Zoe.deep : Zoe.ink)
        .onDisappear { stop() }
    }

    private func toggle() {
        if isPlaying {
            player?.pause()
            isPlaying = false
            model.audio.unduck("voice-message")
            return
        }
        let player = player ?? AVPlayer(url: media.url)
        if self.player == nil {
            self.player = player
            observer = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.1, preferredTimescale: 600), queue: .main) { time in
                MainActor.assumeIsolated {
                    let total = media.duration ?? player.currentItem?.duration.seconds ?? 1
                    progress = total > 0 ? min(time.seconds / total, 1) : 0
                    if progress >= 0.999 { finished() }
                }
            }
        }
        if progress >= 0.999 { player.seek(to: .zero) }
        model.audio.duck("voice-message")
        player.play()
        isPlaying = true
    }

    private func finished() {
        isPlaying = false
        progress = 0
        player?.seek(to: .zero)
        model.audio.unduck("voice-message")
    }

    private func stop() {
        player?.pause()
        if let observer { player?.removeTimeObserver(observer) }
        observer = nil
        if isPlaying { model.audio.unduck("voice-message") }
        isPlaying = false
    }
}
