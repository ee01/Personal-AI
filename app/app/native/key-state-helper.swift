import ApplicationServices
import Foundation

private let keyA: CGKeyCode = 0
private let keyOptionLeft: CGKeyCode = 58
private let keyOptionRight: CGKeyCode = 61

struct KeyStatePayload: Encodable {
  let aDown: Bool
  let optionDown: Bool
}

let payload = KeyStatePayload(
  aDown: CGEventSource.keyState(.combinedSessionState, key: keyA),
  optionDown:
    CGEventSource.keyState(.combinedSessionState, key: keyOptionLeft) ||
    CGEventSource.keyState(.combinedSessionState, key: keyOptionRight)
)

if let data = try? JSONEncoder().encode(payload),
   let line = String(data: data, encoding: .utf8) {
  FileHandle.standardOutput.write(Data((line + "\n").utf8))
}
