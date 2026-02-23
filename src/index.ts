import { MessageType, UiMessageType } from "./shared";

// Dropbox API endpoints
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";

// Storage keys
const TOKEN_KEY = "dropbox_access_token";
const REFRESH_TOKEN_KEY = "dropbox_refresh_token";
const CLIENT_ID_KEY = "dropbox_client_id";

// State
let accessToken = localStorage.getItem(TOKEN_KEY) || "";

/**
 * Check if user has a valid access token
 */
const hasLogin = (): boolean => {
  return !!accessToken;
};

/**
 * Convert Base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Convert Uint8Array to Base64 string
 */
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Generate a file path from the document URL
 * docUrl is typically like "automerge:abc123xyz"
 */
const getFilePath = (docUrl: string): string => {
  // Extract document ID from URL, sanitize for filename
  const docId = docUrl.replace(/[^a-zA-Z0-9]/g, "-");
  return `/socialgata-favorites-${docId}.automerge`;
};

// ============================================
// Sync Methods (Core functionality)
// ============================================

/**
 * Upload document data to Dropbox
 */
const syncUpload = async (
  request: SyncUploadRequest
): Promise<SyncUploadResponse> => {
  if (!hasLogin()) {
    return {
      success: false,
      error: "Not authenticated with Dropbox",
    };
  }

  try {
    const filePath = getFilePath(request.docUrl);
    const binaryData = base64ToUint8Array(request.data);

    const response = await application.networkRequest(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: filePath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: new Blob([binaryData as BlobPart]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Dropbox upload failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error_summary || errorMessage;
      } catch {
        // Use default error message
      }
      return {
        success: false,
        error: errorMessage,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
};

/**
 * Download document data from Dropbox
 */
const syncDownload = async (
  request: SyncDownloadRequest
): Promise<SyncDownloadResponse> => {
  if (!hasLogin()) {
    return {
      data: null,
      error: "Not authenticated with Dropbox",
    };
  }

  try {
    const filePath = getFilePath(request.docUrl);

    const response = await application.networkRequest(DROPBOX_DOWNLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: filePath,
        }),
      },
    });

    // Handle file not found (first sync scenario)
    if (response.status === 409) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        if (
          errorJson.error_summary?.includes("path/not_found") ||
          errorJson.error?.[".tag"] === "path" &&
            errorJson.error?.path?.[".tag"] === "not_found"
        ) {
          // File doesn't exist yet - this is expected for first sync
          return { data: null };
        }
      } catch {
        // Fall through to error handling
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Dropbox download failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error_summary || errorMessage;
      } catch {
        // Use default error message
      }
      return {
        data: null,
        error: errorMessage,
      };
    }

    // Get binary data and convert to Base64
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64Data = uint8ArrayToBase64(bytes);

    return { data: base64Data };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown download error",
    };
  }
};

// ============================================
// Authentication Methods
// ============================================

/**
 * Initiate OAuth login flow
 */
const login = async (request: LoginRequest): Promise<void> => {
  const clientId = request.apiKey;

  // Store client ID for future use
  localStorage.setItem(CLIENT_ID_KEY, clientId);

  // Build OAuth authorization URL
  const redirectUri = `${window.location.origin}/dropbox-auth-popup.html`;
  const state = Math.random().toString(36).substring(2, 15);

  const url = new URL(DROPBOX_AUTH_URL);
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("state", state);
  url.searchParams.append("token_access_type", "offline"); // Get refresh token

  // Open popup for OAuth
  const popup = window.open(url.toString(), "dropbox-auth", "width=600,height=700");

  return new Promise((resolve, reject) => {
    const handleMessage = async (event: MessageEvent) => {
      // Verify the message is from our popup
      if (event.source !== popup) return;

      // Check for auth success message
      if (event.data?.type === "dropbox-auth-success" && event.data?.code) {
        window.removeEventListener("message", handleMessage);

        try {
          // Exchange authorization code for access token
          const tokenResponse = await exchangeCodeForToken(
            event.data.code,
            clientId,
            redirectUri
          );

          if (tokenResponse.access_token) {
            accessToken = tokenResponse.access_token;
            localStorage.setItem(TOKEN_KEY, tokenResponse.access_token);

            if (tokenResponse.refresh_token) {
              localStorage.setItem(REFRESH_TOKEN_KEY, tokenResponse.refresh_token);
            }

            application.createNotification({ message: "Successfully connected to Dropbox!" });
            resolve();
          } else {
            reject(new Error("No access token received"));
          }
        } catch (error) {
          reject(error);
        }

        if (popup && !popup.closed) {
          popup.close();
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Handle popup being closed without completing auth
    const checkPopupClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkPopupClosed);
        window.removeEventListener("message", handleMessage);
        // Don't reject - user may have just closed the popup
      }
    }, 500);
  });
};

/**
 * Exchange authorization code for access token
 */
const exchangeCodeForToken = async (
  code: string,
  clientId: string,
  redirectUri: string
): Promise<{ access_token?: string; refresh_token?: string }> => {
  const params = new URLSearchParams();
  params.append("code", code);
  params.append("grant_type", "authorization_code");
  params.append("client_id", clientId);
  params.append("redirect_uri", redirectUri);

  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  return response.json();
};

/**
 * Logout and clear all tokens
 */
const logout = async (): Promise<void> => {
  accessToken = "";
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  application.createNotification({ message: "Disconnected from Dropbox" });
};

/**
 * Check if user is logged in
 */
const isLoggedIn = async (): Promise<boolean> => {
  return hasLogin();
};

// ============================================
// UI Message Handling
// ============================================

/**
 * Send message to UI iframe
 */
const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

/**
 * Get current plugin info for UI
 */
const getInfo = async () => {
  const clientId = localStorage.getItem(CLIENT_ID_KEY) || "";
  sendMessage({
    type: "info",
    clientId,
    isLoggedIn: hasLogin(),
  });
};

/**
 * Handle messages from UI iframe
 */
const handleUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "check-login":
      getInfo();
      break;
    case "save":
      localStorage.setItem(CLIENT_ID_KEY, message.clientId);
      application.createNotification({ message: "Settings saved!" });
      break;
    case "logout":
      await logout();
      getInfo();
      break;
    default:
      const _exhaustive: never = message;
      break;
  }
};

// ============================================
// Theme Handling
// ============================================

/**
 * Update theme preference
 */
const changeTheme = (theme: Theme) => {
  localStorage.setItem("vite-ui-theme", theme);
};

// ============================================
// Plugin Initialization
// ============================================

/**
 * Initialize plugin on load
 */
const init = async () => {
  // Restore token from localStorage
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    accessToken = token;
  }

  // Apply current theme
  const theme = await application.getTheme();
  changeTheme(theme);
};

// ============================================
// Wire up plugin handlers
// ============================================

// Sync methods (core functionality for this plugin)
application.onSyncUpload = syncUpload;
application.onSyncDownload = syncDownload;

// Authentication methods
application.onLogin = login;
application.onLogout = logout;
application.onIsLoggedIn = isLoggedIn;

// UI message handling
application.onUiMessage = handleUiMessage;

// Theme handling
application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

// Lifecycle
application.onPostLogin = init;

// Initialize on load
init();
