import SwiftUI
import UIKit

extension View {
    /// Wherever someone types: dragging the content puts the keyboard away,
    /// and a button above the keyboard does too, so it never has to fill the
    /// screen. Applied to each view that holds a text field: a keyboard
    /// toolbar set further up the hierarchy (the root, a tab) isn't used.
    func keyboardDismissible() -> some View {
        modifier(KeyboardDismissal())
    }
}

private struct KeyboardDismissal: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                // Small and centered, clear of the send buttons at the edges.
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button {
                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    } label: {
                        Image(systemName: "keyboard.chevron.compact.down")
                    }
                    .tint(Zoe.peach)
                    .accessibilityLabel("Hide keyboard")
                    Spacer()
                }
            }
    }
}
