import Foundation
import Security

struct KeychainError: Error {
    let status: OSStatus
}

/// The session token is a bearer credential, so it lives in the Keychain —
/// never UserDefaults — and is not migrated to other devices by backup.
enum KeychainStore {
    private static let service = "com.thematterworks.mount.session"

    private static func query(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    static func save(_ data: Data, account: String) throws {
        SecItemDelete(query(account: account) as CFDictionary)
        var attributes = query(account: account)
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError(status: status) }
    }

    static func load(account: String) -> Data? {
        var request = query(account: account)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    static func delete(account: String) {
        SecItemDelete(query(account: account) as CFDictionary)
    }
}
