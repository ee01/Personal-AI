import Carbon.HIToolbox
import Foundation

private let holdThreshold: TimeInterval = 0.32
private let hotKeySignature: OSType = 0x44425141 // "DBQA"
private let hotKeyIdentifier: UInt32 = 1

struct HelperPayload: Encodable {
  let type: String
  let action: String?
  let permissionGranted: Bool?
  let message: String?
}

func emit(_ payload: HelperPayload) {
  guard let data = try? JSONEncoder().encode(payload),
        let line = String(data: data, encoding: .utf8)
  else {
    return
  }

  FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

final class ShortcutController {
  private var hotKeyRef: EventHotKeyRef?
  private var eventHandlerRef: EventHandlerRef?
  private var holdWorkItem: DispatchWorkItem?
  private var holdTriggered = false

  func start() throws {
    var eventTypes = [
      EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed)),
      EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyReleased)),
    ]

    let userData = Unmanaged.passUnretained(self).toOpaque()
    let installStatus = InstallEventHandler(
      GetEventDispatcherTarget(),
      { _, eventRef, userData in
        guard let eventRef, let userData else {
          return noErr
        }

        let controller = Unmanaged<ShortcutController>.fromOpaque(userData).takeUnretainedValue()
        return controller.handle(event: eventRef)
      },
      eventTypes.count,
      &eventTypes,
      userData,
      &eventHandlerRef
    )

    guard installStatus == noErr else {
      throw NSError(
        domain: "ShortcutHelper",
        code: Int(installStatus),
        userInfo: [NSLocalizedDescriptionKey: "Failed to install hotkey event handler (\(installStatus))."]
      )
    }

    let hotKeyID = EventHotKeyID(signature: hotKeySignature, id: hotKeyIdentifier)
    let registerStatus = RegisterEventHotKey(
      UInt32(kVK_ANSI_A),
      UInt32(optionKey),
      hotKeyID,
      GetEventDispatcherTarget(),
      0,
      &hotKeyRef
    )

    guard registerStatus == noErr else {
      throw NSError(
        domain: "ShortcutHelper",
        code: Int(registerStatus),
        userInfo: [NSLocalizedDescriptionKey: "Failed to register Option+A hotkey (\(registerStatus))."]
      )
    }
  }

  private func handle(event: EventRef) -> OSStatus {
    var hotKeyID = EventHotKeyID()
    let status = GetEventParameter(
      event,
      EventParamName(kEventParamDirectObject),
      EventParamType(typeEventHotKeyID),
      nil,
      MemoryLayout<EventHotKeyID>.size,
      nil,
      &hotKeyID
    )

    guard status == noErr,
          hotKeyID.signature == hotKeySignature,
          hotKeyID.id == hotKeyIdentifier
    else {
      return noErr
    }

    switch GetEventKind(event) {
      case UInt32(kEventHotKeyPressed):
        handlePressed()
      case UInt32(kEventHotKeyReleased):
        handleReleased()
      default:
        break
    }

    return noErr
  }

  private func handlePressed() {
    holdWorkItem?.cancel()
    holdTriggered = false

    let workItem = DispatchWorkItem { [weak self] in
      guard let self, self.holdTriggered == false else {
        return
      }

      self.holdTriggered = true
      emit(
        HelperPayload(
          type: "shortcut",
          action: "hold",
          permissionGranted: nil,
          message: nil
        )
      )
    }

    holdWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + holdThreshold, execute: workItem)
  }

  private func handleReleased() {
    holdWorkItem?.cancel()
    holdWorkItem = nil

    if holdTriggered == false {
      emit(
        HelperPayload(
          type: "shortcut",
          action: "tap",
          permissionGranted: nil,
          message: nil
        )
      )
    }

    holdTriggered = false
  }
}

let controller = ShortcutController()

do {
  try controller.start()
  emit(
    HelperPayload(
      type: "ready",
      action: nil,
      permissionGranted: true,
      message: "短按 Option+A 在松手时开关窗口，长按超过 320ms 进入语音输入。"
    )
  )
  RunLoop.main.run()
} catch {
  emit(
    HelperPayload(
      type: "error",
      action: nil,
      permissionGranted: nil,
      message: error.localizedDescription
    )
  )
  exit(1)
}
