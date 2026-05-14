import AVFoundation
import Foundation
import Speech

private struct IncomingCommand: Codable {
  let command: String
  let locale: String?
  let pcmBase64: String?
  let sampleRate: Double?
  let localOnly: Bool?
}

private struct OutgoingEvent: Codable {
  let type: String
  let text: String?
  let isFinal: Bool?
  let level: Double?
  let code: String?
  let message: String?
  let microphoneStatus: String?
  let speechStatus: String?
  let reason: String?
}

final class SpeechHelper {
  private var recognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private let audioEngine = AVAudioEngine()
  private var stdinBuffer = ""
  private var latestTranscript = ""
  private var lastStopReason = "completed"
  private var stopTimer: DispatchSourceTimer?
  private var sessionActive = false
  private var stopEmittedForSession = false
  private var audioTapInstalled = false
  private var usingExternalPcm = false

  func run() {
    FileHandle.standardInput.readabilityHandler = { [weak self] handle in
      guard let self else { return }
      let data = handle.availableData
      if data.isEmpty {
        self.shutdown()
        return
      }
      self.stdinBuffer += String(decoding: data, as: UTF8.self)
      self.consumeInputBuffer()
    }

    emit(
      type: "ready",
      microphoneStatus: microphoneStatusString(),
      speechStatus: speechStatusString()
    )
    RunLoop.current.run()
  }

  private func consumeInputBuffer() {
    while let newlineIndex = stdinBuffer.firstIndex(of: "\n") {
      let line = String(stdinBuffer[..<newlineIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
      stdinBuffer = String(stdinBuffer[stdinBuffer.index(after: newlineIndex)...])
      if line.isEmpty {
        continue
      }
      handle(line: line)
    }
  }

  private func handle(line: String) {
    guard let data = line.data(using: .utf8) else {
      emit(type: "error", code: "invalid_input", message: "Unable to decode command input")
      return
    }

    do {
      let command = try JSONDecoder().decode(IncomingCommand.self, from: data)
      switch command.command {
      case "start":
        requestPermissionsAndStart(localeIdentifier: command.locale)
      case "pcm_start":
        requestSpeechAccessAndStartPcm(localeIdentifier: command.locale, localOnly: command.localOnly ?? true)
      case "pcm_chunk":
        appendPcmBase64Chunk(command.pcmBase64, sampleRate: command.sampleRate ?? 16000)
      case "pcm_end":
        stopListening(reason: "pcm_completed")
      case "stop":
        stopListening(reason: "completed")
      case "cancel":
        cancelListening(reason: "cancelled")
      case "shutdown":
        shutdown()
      default:
        emit(type: "error", code: "unknown_command", message: "Unknown speech command: \(command.command)")
      }
    } catch {
      emit(type: "error", code: "invalid_json", message: "Unable to parse speech command JSON")
    }
  }

  private func requestPermissionsAndStart(localeIdentifier: String?) {
    requestMicrophoneAccess { [weak self] microphoneGranted, microphoneStatus in
      guard let self else { return }
      self.requestSpeechAccess { speechGranted, speechStatus in
        guard microphoneGranted && speechGranted else {
          let code = !microphoneGranted ? "microphone_denied" : "speech_denied"
          let message = !microphoneGranted
            ? "Microphone permission is required"
            : "Speech Recognition permission is required"
          self.emit(
            type: "error",
            code: code,
            message: message,
            microphoneStatus: microphoneStatus,
            speechStatus: speechStatus
          )
          return
        }

        do {
          try self.startRecognition(localeIdentifier: localeIdentifier)
        } catch {
          self.emit(
            type: "error",
            code: "speech_start_failed",
            message: error.localizedDescription,
            microphoneStatus: microphoneStatus,
            speechStatus: speechStatus
          )
        }
      }
    }
  }

  private func requestSpeechAccessAndStartPcm(localeIdentifier: String?, localOnly: Bool) {
    requestSpeechAccess { [weak self] speechGranted, speechStatus in
      guard let self else { return }
      guard speechGranted else {
        self.emit(
          type: "error",
          code: "speech_denied",
          message: "Speech Recognition permission is required",
          microphoneStatus: self.microphoneStatusString(),
          speechStatus: speechStatus
        )
        return
      }

      do {
        try self.startPcmRecognition(localeIdentifier: localeIdentifier, localOnly: localOnly)
      } catch {
        self.emit(
          type: "error",
          code: "speech_start_failed",
          message: error.localizedDescription,
          microphoneStatus: self.microphoneStatusString(),
          speechStatus: speechStatus
        )
      }
    }
  }

  private func startRecognition(localeIdentifier: String?) throws {
    cancelListening(reason: nil, emitStopped: false)

    let locale = Locale(identifier: localeIdentifier?.isEmpty == false ? localeIdentifier! : Locale.preferredLanguages.first ?? "zh-CN")
    guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer() else {
      throw NSError(domain: "DoubaoBridgeSpeechHelper", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Speech recognizer is unavailable for this locale",
      ])
    }

    if !recognizer.isAvailable {
      throw NSError(domain: "DoubaoBridgeSpeechHelper", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "Speech recognizer is currently unavailable",
      ])
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true

    latestTranscript = ""
    lastStopReason = "completed"
    stopEmittedForSession = false
    usingExternalPcm = false
    request.taskHint = .dictation

    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)
    if audioTapInstalled {
      inputNode.removeTap(onBus: 0)
      audioTapInstalled = false
    }
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
      guard let self else { return }
      request.append(buffer)
      self.emitAmplitude(buffer)
    }
    audioTapInstalled = true

    audioEngine.prepare()
    try audioEngine.start()

    self.recognizer = recognizer
    recognitionRequest = request
    sessionActive = true

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      guard self.sessionActive else { return }

      if let result {
        self.latestTranscript = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
        self.emit(type: "transcript", text: self.latestTranscript, isFinal: result.isFinal)
        if result.isFinal {
          self.finishSession(reason: self.lastStopReason, emitStopped: true)
          return
        }
      }

      if let error {
        let nsError = error as NSError
        let code = "speech_error_\(nsError.code)"
        self.emit(type: "error", code: code, message: nsError.localizedDescription)
        self.finishSession(reason: "error", emitStopped: !self.latestTranscript.isEmpty)
      }
    }

    emit(
      type: "started",
      microphoneStatus: microphoneStatusString(),
      speechStatus: speechStatusString()
    )
  }

  private func startPcmRecognition(localeIdentifier: String?, localOnly: Bool) throws {
    cancelListening(reason: nil, emitStopped: false)

    let locale = Locale(identifier: localeIdentifier?.isEmpty == false ? localeIdentifier! : "en-US")
    guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer() else {
      throw NSError(domain: "DoubaoBridgeSpeechHelper", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Speech recognizer is unavailable for this locale",
      ])
    }

    if !recognizer.isAvailable {
      throw NSError(domain: "DoubaoBridgeSpeechHelper", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "Speech recognizer is currently unavailable",
      ])
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.taskHint = .dictation
    if localOnly {
      if #available(macOS 10.15, *) {
        guard recognizer.supportsOnDeviceRecognition else {
          throw NSError(domain: "DoubaoBridgeSpeechHelper", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "On-device speech recognition is unavailable for this locale",
          ])
        }
        request.requiresOnDeviceRecognition = true
      } else {
        throw NSError(domain: "DoubaoBridgeSpeechHelper", code: 4, userInfo: [
          NSLocalizedDescriptionKey: "On-device speech recognition requires macOS 10.15 or newer",
        ])
      }
    }

    latestTranscript = ""
    lastStopReason = "completed"
    stopEmittedForSession = false
    usingExternalPcm = true
    audioTapInstalled = false

    self.recognizer = recognizer
    recognitionRequest = request
    sessionActive = true

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      guard self.sessionActive else { return }

      if let result {
        self.latestTranscript = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
        self.emit(type: "transcript", text: self.latestTranscript, isFinal: result.isFinal)
        if result.isFinal {
          self.finishSession(reason: self.lastStopReason, emitStopped: true)
          return
        }
      }

      if let error {
        let nsError = error as NSError
        let code = "speech_error_\(nsError.code)"
        self.emit(type: "error", code: code, message: nsError.localizedDescription)
        self.finishSession(reason: "error", emitStopped: !self.latestTranscript.isEmpty)
      }
    }

    emit(
      type: "started",
      microphoneStatus: microphoneStatusString(),
      speechStatus: speechStatusString()
    )
  }

  private func appendPcmBase64Chunk(_ pcmBase64: String?, sampleRate: Double) {
    guard sessionActive, usingExternalPcm, let request = recognitionRequest else {
      emit(type: "error", code: "pcm_session_inactive", message: "PCM speech session is not active")
      return
    }
    guard let pcmBase64, let data = Data(base64Encoded: pcmBase64), data.count >= 2 else {
      return
    }

    let sampleCount = data.count / MemoryLayout<Int16>.size
    guard let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(sampleCount)) else {
      emit(type: "error", code: "pcm_format_failed", message: "Unable to create PCM buffer")
      return
    }

    buffer.frameLength = AVAudioFrameCount(sampleCount)
    guard let channel = buffer.floatChannelData?[0] else {
      return
    }

    data.withUnsafeBytes { rawBuffer in
      let samples = rawBuffer.bindMemory(to: Int16.self)
      for index in 0..<sampleCount {
        channel[index] = Float(samples[index]) / 32768.0
      }
    }
    request.append(buffer)
    emitAmplitude(buffer)
  }

  private func stopListening(reason: String) {
    guard sessionActive else {
      emit(type: "stopped", text: latestTranscript, isFinal: true, reason: reason)
      return
    }

    lastStopReason = reason
    recognitionRequest?.endAudio()
    stopAudioCaptureIfNeeded()

    cancelStopTimer()
    let timer = DispatchSource.makeTimerSource(queue: .main)
    timer.schedule(deadline: .now() + .milliseconds(900))
    timer.setEventHandler { [weak self] in
      guard let self else { return }
      self.finishSession(reason: reason, emitStopped: true)
    }
    stopTimer = timer
    timer.resume()
  }

  private func cancelListening(reason: String?, emitStopped: Bool = true) {
    cancelStopTimer()
    if sessionActive {
      stopAudioCaptureIfNeeded()
      recognitionRequest?.endAudio()
      recognitionTask?.cancel()
    }
    finishSession(reason: reason ?? "cancelled", emitStopped: emitStopped)
  }

  private func finishSession(reason: String, emitStopped: Bool) {
    guard sessionActive || (emitStopped && !stopEmittedForSession) else {
      return
    }

    cancelStopTimer()
    sessionActive = false

    stopAudioCaptureIfNeeded()
    recognitionRequest?.endAudio()
    recognitionRequest = nil
    recognitionTask?.cancel()
    recognitionTask = nil
    recognizer = nil
    usingExternalPcm = false

    if emitStopped && !stopEmittedForSession {
      stopEmittedForSession = true
      emit(type: "stopped", text: latestTranscript, isFinal: true, reason: reason)
    }
    emit(type: "amplitude", level: 0.14)
  }

  private func shutdown() {
    cancelListening(reason: "shutdown", emitStopped: false)
    FileHandle.standardInput.readabilityHandler = nil
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(40)) {
      exit(0)
    }
  }

  private func stopAudioCaptureIfNeeded() {
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    if audioTapInstalled {
      audioEngine.inputNode.removeTap(onBus: 0)
      audioTapInstalled = false
    }
  }

  private func cancelStopTimer() {
    stopTimer?.cancel()
    stopTimer = nil
  }

  private func emitAmplitude(_ buffer: AVAudioPCMBuffer) {
    guard let channelData = buffer.floatChannelData else {
      return
    }
    let frameLength = Int(buffer.frameLength)
    guard buffer.format.channelCount > 0, frameLength > 0 else {
      return
    }

    var sum: Float = 0
    let samples = channelData[0]
    for index in 0..<frameLength {
      let sample = samples[index]
      sum += sample * sample
    }

    let rms = sqrt(sum / Float(frameLength))
    let normalized = max(0.08, min(1.0, Double(rms) * 7.5))
    emit(type: "amplitude", level: normalized)
  }

  private func requestMicrophoneAccess(completion: @escaping (Bool, String) -> Void) {
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized:
      completion(true, "authorized")
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .audio) { granted in
        DispatchQueue.main.async {
          completion(granted, granted ? "authorized" : "denied")
        }
      }
    case .restricted:
      completion(false, "restricted")
    case .denied:
      completion(false, "denied")
    @unknown default:
      completion(false, "unknown")
    }
  }

  private func requestSpeechAccess(completion: @escaping (Bool, String) -> Void) {
    switch SFSpeechRecognizer.authorizationStatus() {
    case .authorized:
      completion(true, "authorized")
    case .notDetermined:
      SFSpeechRecognizer.requestAuthorization { status in
        DispatchQueue.main.async {
          completion(status == .authorized, self.speechStatusString())
        }
      }
    case .denied:
      completion(false, "denied")
    case .restricted:
      completion(false, "restricted")
    @unknown default:
      completion(false, "unknown")
    }
  }

  private func microphoneStatusString() -> String {
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized:
      return "authorized"
    case .notDetermined:
      return "not_determined"
    case .restricted:
      return "restricted"
    case .denied:
      return "denied"
    @unknown default:
      return "unknown"
    }
  }

  private func speechStatusString() -> String {
    switch SFSpeechRecognizer.authorizationStatus() {
    case .authorized:
      return "authorized"
    case .notDetermined:
      return "not_determined"
    case .restricted:
      return "restricted"
    case .denied:
      return "denied"
    @unknown default:
      return "unknown"
    }
  }

  private func emit(
    type: String,
    text: String? = nil,
    isFinal: Bool? = nil,
    level: Double? = nil,
    code: String? = nil,
    message: String? = nil,
    microphoneStatus: String? = nil,
    speechStatus: String? = nil,
    reason: String? = nil
  ) {
    let event = OutgoingEvent(
      type: type,
      text: text,
      isFinal: isFinal,
      level: level,
      code: code,
      message: message,
      microphoneStatus: microphoneStatus,
      speechStatus: speechStatus,
      reason: reason
    )

    guard let data = try? JSONEncoder().encode(event) else {
      return
    }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
  }
}

let helper = SpeechHelper()
helper.run()
