import AuthenticationServices
import SwiftUI

/// Signing in: a phone number and a texted code, Sign in with Apple, or an
/// emailed code. The phone number is the identity for someone already on the
/// journey by SMS, so they open the app on the day they are on. Apple and
/// email make an app-only account — nobody is texted who didn't give a number.
struct OnboardingView: View {
    @Environment(AppModel.self) private var model

    private enum Step { case phone, phoneCode, email, emailCode }

    @State private var step: Step = .phone
    @State private var phoneInput = ""
    @State private var canonicalPhone = ""
    @State private var emailInput = ""
    @State private var code = ""
    @State private var options = AuthOptions()
    @State private var isWorking = false
    @State private var errorMessage: String?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 22) {
                switch step {
                case .phone, .email:
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
                case .phoneCode, .emailCode:
                    Text("Enter your code")
                        .font(.zoeDisplay(48))
                        .multilineTextAlignment(.center)
                    Text(step == .phoneCode ? "We sent a six-digit code to your phone." : "We sent a six-digit code to \(emailInput.trimmingCharacters(in: .whitespaces)).")
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
                        if isWorking { ProgressView().tint(Zoe.deep) } else { Text(isEntering ? "Send code" : "Enter") }
                    }
                    .font(.zoeSerif(.title3))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.deep)
                }
                .disabled(isWorking || !canSubmit)
                .opacity(canSubmit ? 1 : 0.5)

                if isEntering {
                    otherWays
                } else {
                    Button(step == .phoneCode ? "Use a different number" : "Use a different email") {
                        step = step == .phoneCode ? .phone : .email
                        code = ""
                        errorMessage = nil
                    }
                    .font(.footnote)
                    .foregroundStyle(Zoe.inkMuted)
                }

                #if DEBUG
                if !isEntering, model.usesPreviewServices {
                    Text("Preview build: any six digits will sign you in.")
                        .zoeLabelStyle()
                }
                #endif
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        .readableWidth(520)
        .onAppear { focused = true }
        .task { options = await model.session.options() }
    }

    private var isEntering: Bool { step == .phone || step == .email }

    /// Apple, and switching between phone and email, under the main button.
    @ViewBuilder
    private var otherWays: some View {
        if step == .phone {
            Text("By continuing you agree to receive a sign-in code by text. Msg & data rates may apply.")
                .font(.caption)
                .foregroundStyle(Zoe.inkMuted)
                .multilineTextAlignment(.center)
        }

        HStack(spacing: 12) {
            Rectangle().fill(Zoe.locked).frame(height: 1)
            Text("or").font(.caption).foregroundStyle(Zoe.inkMuted)
            Rectangle().fill(Zoe.locked).frame(height: 1)
        }
        .padding(.vertical, 2)

        if options.apple {
            SignInWithAppleButton(.continue) { request in
                // The name is only for greeting; Apple shares it once.
                request.requestedScopes = [.fullName]
            } onCompletion: { result in
                signInWithApple(result)
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 50)
            .clipShape(Capsule())
            .disabled(isWorking)
        }

        if options.email || step == .email {
            Button(step == .phone ? "Use email instead" : "Use a phone number instead") {
                step = step == .phone ? .email : .phone
                errorMessage = nil
                focused = true
            }
            .font(.footnote)
            .foregroundStyle(Zoe.inkMuted)
        }
    }

    @ViewBuilder
    private var field: some View {
        Group {
            switch step {
            case .phone:
                TextField("Mobile number", text: $phoneInput)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    // Longest valid E.164 number plus formatting characters.
                    .onChange(of: phoneInput) { _, new in
                        if new.count > 20 { phoneInput = String(new.prefix(20)) }
                    }
            case .email:
                TextField("Email address", text: $emailInput)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.system(.title3))
            case .phoneCode, .emailCode:
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

    private var email: String { emailInput.trimmingCharacters(in: .whitespaces).lowercased() }

    private var canSubmit: Bool {
        switch step {
        case .phone: PhoneNumber.canonical(phoneInput) != nil
        case .email: email.contains("@") && email.contains(".")
        case .phoneCode, .emailCode: code.count == 6
        }
    }

    private func submit() {
        run {
            switch step {
            case .phone:
                guard let phone = PhoneNumber.canonical(phoneInput) else { throw AuthError.invalidPhoneNumber }
                try await model.session.requestCode(phoneNumber: phone)
                canonicalPhone = phone
                step = .phoneCode
                focused = true
            case .email:
                try await model.session.requestEmailCode(email: email)
                step = .emailCode
                focused = true
            case .phoneCode:
                try await model.session.verify(phoneNumber: canonicalPhone, code: code)
                await model.notifications.requestAuthorization()
            case .emailCode:
                try await model.session.verifyEmail(email, code: code)
                await model.notifications.requestAuthorization()
            }
        }
    }

    private func signInWithApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let data = credential.identityToken, let token = String(data: data, encoding: .utf8) else {
                errorMessage = "Apple didn't finish signing you in. Try again."
                return
            }
            run {
                try await model.session.signInWithApple(identityToken: token, firstName: credential.fullName?.givenName)
                await model.notifications.requestAuthorization()
            }
        case .failure(let error):
            // Closing Apple's sheet isn't an error worth showing.
            if (error as? ASAuthorizationError)?.code != .canceled {
                errorMessage = "Apple didn't finish signing you in. Try again."
            }
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        errorMessage = nil
        isWorking = true
        Task {
            defer { isWorking = false }
            do { try await work() } catch { errorMessage = error.localizedDescription }
        }
    }
}
