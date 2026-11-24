import OSLog

extension Logger {
    static let app = Logger(subsystem: "com.thematterworks.mount", category: "app")
    static let liveActivity = Logger(subsystem: "com.thematterworks.mount", category: "live-activity")
    static let notifications = Logger(subsystem: "com.thematterworks.mount", category: "notifications")
}
