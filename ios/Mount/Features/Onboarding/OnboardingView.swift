import SwiftUI

/// Phone number, then a one-time code. The phone number is the identity, so
/// someone already on the journey by SMS opens the app on the day they are on.
struct OnboardingView: View {
    @Environment(AppModel.self) private var model

    private enum Step { case phone, code }

    @State private var step: Step = .phone
    @State private var phoneInput = ""
    @State private var canonicalPhone = ""
    @State private var code = ""
    @State private var isWorking = false
    @State private var errorMessage: String?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 22) {
                if step == .phone {
                    // The brand lockup exactly as designed: the peach wordmark
                    // over the mountain line art.
                    Image("Lockup")
                        .resizable()
                        .scaledToFit()
                        .accessibilityLabel("30 Days on the Mount")
                    Text("A 30-day invitation to walk in the way of Jesus' most famous sermon")
                        .font(.system(size: 11, weight: .regular))
                        .tracking(1.8)
                        .textCase(.uppercase)
                        .foregroundStyle(Zoe.ink)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                } else {
                    Text("Enter your code")
                        .font(.zoeDisplay(48))
                        .multilineTextAlignment(.center)
                    Text("We sent a six-digit code to your phone.")
                        .font(.body)
                        .foregroundStyle(Zoe.inkMuted)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 28)

            field
                .padding(.top, 40)
                .padding(.horizontal, 32)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(Zoe.peach)
                    .padding(.top, 12)
                    .padding(.horizontal, 32)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            VStack(spacing: 16) {
                Button(action: submit) {
                    Group {
                        if isWorking { ProgressView().tint(Zoe.deep) } else { Text(step == .phone ? "Send code" : "Enter") }
                    }
                    .font(.zoeSerif(.title3))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.deep)
                }
                .disabled(isWorking || !canSubmit)
                .opacity(canSubmit ? 1 : 0.5)

                if step == .phone {
                    Text("By continuing you agree to receive a sign-in code by text. Msg & data rates may apply.")
                        .font(.caption)
                        .foregroundStyle(Zoe.inkMuted)
                        .multilineTextAlignment(.center)
                } else {
                    Button("Use a different number") {
                        step = .phone
                        code = ""
                        errorMessage = nil
                    }
                    .font(.footnote)
                    .foregroundStyle(Zoe.inkMuted)
                }

                #if DEBUG
                if step == .code, model.usesPreviewServices {
                    Text("Preview build: any six digits will sign you in.")
                        .zoeLabelStyle()
                }
                #endif
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        .onAppear { focused = true }
    }

    @ViewBuilder
    private var field: some View {
        Group {
            if step == .phone {
                TextField("Mobile number", text: $phoneInput)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    // Longest valid E.164 number plus formatting characters.
                    .onChange(of: phoneInput) { _, new in
                        if new.count > 20 { phoneInput = String(new.prefix(20)) }
                    }
            } else {
                TextField("000000", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .onChange(of: code) { _, new in code = String(new.filter(\.isNumber).prefix(6)) }
            }
        }
        .focused($focused)
        .font(.system(.title2, design: .monospaced))
        .multilineTextAlignment(.center)
        .padding(.vertical, 16)
        .overlay(alignment: .bottom) { Rectangle().fill(Zoe.locked).frame(height: 1) }
    }

    private var canSubmit: Bool {
        step == .phone ? PhoneNumber.canonical(phoneInput) != nil : code.count == 6
    }

    private func submit() {
        errorMessage = nil
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                switch step {
                case .phone:
                    guard let phone = PhoneNumber.canonical(phoneInput) else { throw AuthError.invalidPhoneNumber }
                    try await model.session.requestCode(phoneNumber: phone)
                    canonicalPhone = phone
                    step = .code
                    focused = true
                case .code:
                    try await model.session.verify(phoneNumber: canonicalPhone, code: code)
                    await model.notifications.requestAuthorization()
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
