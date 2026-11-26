import SwiftUI

extension View {
    /// Wherever someone types: dragging the content down puts the keyboard
    /// away, so it never has to fill the screen. Applied to each view that
    /// holds a text field.
    func keyboardDismissible() -> some View {
        scrollDismissesKeyboard(.interactively)
    }
}
