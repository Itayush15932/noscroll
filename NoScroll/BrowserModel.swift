import SwiftUI
import UIKit
import WebKit

/// Owns the single web view that shows the official Instagram website.
/// Nothing is stored or sent anywhere by this app: the login happens on
/// Instagram's own page and the session cookie stays in the web view.
@MainActor
final class BrowserModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    @Published var failed = false

    let webView: WKWebView

    private static let home = URL(string: "https://www.instagram.com/")!

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.allowsInlineMediaPlayback = true

        // Present the web view as the regular iPhone browser, with the real
        // system version, so the site serves its normal mobile pages.
        let parts = UIDevice.current.systemVersion.split(separator: ".")
        let major = parts.first.map { String($0) } ?? "17"
        let minor = parts.count > 1 ? String(parts[1]) : "0"
        config.applicationNameForUserAgent = "Version/\(major).\(minor) Mobile/15E148 Safari/604.1"

        let script = WKUserScript(
            source: Blocker.script,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(script)

        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor.systemBackground
        webView.scrollView.backgroundColor = UIColor.systemBackground

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pulledToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        // Compile the native hiding rules first, then open the site, so the
        // rules are already active on the very first page.
        let view = webView
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "noscroll-rules-v1",
            encodedContentRuleList: Blocker.contentRules
        ) { list, _ in
            if let list = list {
                view.configuration.userContentController.add(list)
            }
            view.load(URLRequest(url: BrowserModel.home))
        }
    }

    func reloadHome() {
        failed = false
        webView.load(URLRequest(url: BrowserModel.home))
    }

    @objc private func pulledToRefresh(_ sender: UIRefreshControl) {
        webView.reload()
        sender.endRefreshing()
    }

    // MARK: - WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else {
            return .allow
        }

        let scheme = (url.scheme ?? "").lowercased()
        if scheme != "http" && scheme != "https" {
            if scheme == "about" || scheme == "blob" || scheme == "data" {
                return .allow
            }
            // Links that try to open another app (the original Instagram app,
            // the App Store): stay here.
            return .cancel
        }

        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true

        if isMainFrame && Blocker.isInstagram(url) && Blocker.isReelsFeed(url) {
            if webView.url == nil {
                webView.load(URLRequest(url: BrowserModel.home))
            }
            return .cancel
        }

        if isMainFrame
            && navigationAction.navigationType == .linkActivated
            && !Blocker.staysInApp(url) {
            UIApplication.shared.open(url)
            return .cancel
        }

        return .allow
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        failed = false
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code != NSURLErrorCancelled {
            if webView.url == nil {
                failed = true
            }
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: - WKUIDelegate

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // Links that ask for a new window open in this same view.
        if let url = navigationAction.request.url {
            if Blocker.staysInApp(url) {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }
}
