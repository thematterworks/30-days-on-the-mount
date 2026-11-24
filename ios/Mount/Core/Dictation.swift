import AVFoundation
import Foundation
import Observation
import OSLog
import Speech

/// Speaking instead of typing — for the walk home or the car. Words appear
/// as they're said and can be edited before sending, exactly like typed
/// text. Recognition runs on the phone whenever the device supports it, so a
/// reflection isn't sent anywhere to be transcribed.
@MainActor
@Observable
final class Dictation {
    private(set) var isListening = false
    /// Which field is listening, so only its microphone lights up.
    private(set) var activeField: String?
    var problem: String?

    private let audio: AudioDirector
    private let engine = AVAudioEngine()
    private var task: SFSpeechRecognitionTask?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    init(audio: AudioDirector) {
        self.audio = audio
    }

    /// Starts listening. `update` receives the field's whole text each time
    /// the transcription changes — what was there before, then the words.
    func start(field: String, existing: String, update: @escaping @MainActor (String) -> Void) async {
        if isListening { stop() }
        problem = nil
        guard await Self.authorize() else {
            problem = "Allow speech recognition and the microphone in Settings to speak a reflection."
            return
        }
        guard let recognizer, recognizer.isAvailable else {
            problem = "Speaking isn't available right now. You can still type."
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        self.request = request

        do {
            audio.pauseForRecording()
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .defaultToSpeaker])
            try session.setActive(true)

            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            // The tap runs on the audio thread; the request only appends.
            nonisolated(unsafe) let feed = request
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                feed.append(buffer)
            }
            engine.prepare()
            try engine.start()
        } catch {
            Logger.app.error("Dictation couldn't start: \(error.localizedDescription, privacy: .public)")
            problem = "The microphone couldn't start. You can still type."
            stop()
            return
        }

        let prefix = existing.trimmingCharacters(in: .whitespacesAndNewlines)
        isListening = true
        activeField = field
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let words = result?.bestTranscription.formattedString
            let isFinal = result?.isFinal ?? false
            Task { @MainActor in
                guard let self, self.activeField == field else { return }
                if let words, !words.isEmpty {
                    update(prefix.isEmpty ? words : "\(prefix) \(words)")
                }
                if error != nil || isFinal { self.stop() }
            }
        }
    }

    func stop() {
        guard isListening || request != nil else { return }
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.finish()
        task = nil
        request = nil
        isListening = false
        activeField = nil
        audio.resumeAfterRecording()
    }

    private static func authorize() async -> Bool {
        let speech = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speech == .authorized else { return false }
        return await AVAudioApplication.requestRecordPermission()
    }
}
