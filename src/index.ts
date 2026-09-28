import { DEFAULT_CLIENT_ID, MessageType, UiMessageType } from "./shared";

// Dropbox API endpoints
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_REVOKE_URL = "https://api.dropboxapi.com/2/auth/token/revoke";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";

// Storage keys
const TOKEN_KEY = "dropbox_access_token";
const REFRESH_TOKEN_KEY = "dropbox_refresh_token";
const EXPIRES_AT_KEY = "dropbox_expires_at";
const CLIENT_ID_KEY = "dropbox_client_id";
// Kept in storage rather than memory: the plugin can be reloaded between
// starting a sign-in and the callback arriving.
const PKCE_VERIFIER_KEY = "dropbox_pkce_verifier";

const NOT_AUTHENTICATED = "Not authenticated with Dropbox";

// Refresh this long before the token actually expires
const EXPIRY_MARGIN_MS = 60 * 1000;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Get the parent origin by stripping the pluginId subdomain.
 * e.g. pluginId.localhost:3005 -> http://localhost:3005
 *      pluginId.socialgata.com -> https://socialgata.com
 */
const getParentOrigin = (): string => {
  const url = new URL(window.location.origin);
  const parts = url.hostname.split(".");
  parts.shift();
  url.hostname = parts.join(".");
  return url.origin;
};

const getRedirectUri = (): string => `${getParentOrigin()}/login_popup.html`;

const getClientId = (): string =>
  localStorage.getItem(CLIENT_ID_KEY) || DEFAULT_CLIENT_ID;

const hasLogin = (): boolean => !!localStorage.getItem(TOKEN_KEY);

const base64ToUint8Array = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const base64UrlEncode = (bytes: Uint8Array): string =>
  uint8ArrayToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A random PKCE code verifier (43-128 chars, URL-safe) */
const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

/** The PKCE code challenge (S256) for a code verifier */
const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64UrlEncode(new Uint8Array(digest));
};

/**
 * The file a document is kept in, in the app's Dropbox folder. Unchanged from
 * earlier versions so SocialGata can still find its old file to migrate from.
 */
const getFilePath = (docUrl: string): string =>
  `/socialgata-favorites-${docUrl.replace(/[^a-zA-Z0-9]/g, "-")}.automerge`;

/** Read an error message out of a Dropbox error response */
const readError = async (response: Response, fallback: string): Promise<string> => {
  const errorText = await response.text();
  try {
    const errorJson = JSON.parse(errorText);
    return errorJson.error_summary || errorJson.error_description || fallback;
  } catch {
    return errorText || fallback;
  }
};

// ============================================
// Token Management
// ============================================

const setTokens = (tokens: TokenResponse) => {
  if (tokens.access_token) {
    localStorage.setItem(TOKEN_KEY, tokens.access_token);
  }
  // Only the initial exchange returns a refresh token
  if (tokens.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
  if (tokens.expires_in) {
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
  } else {
    localStorage.removeItem(EXPIRES_AT_KEY);
  }
};

const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
};

const requestToken = (params: URLSearchParams): Promise<Response> => {
  params.append("client_id", getClientId());
  return fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
};

let pendingRefresh: Promise<string> | null = null;

/**
 * Exchange the refresh token for a new access token. Dropbox access tokens
 * only last about four hours. Returns an empty string when the user has to
 * sign in again.
 */
const refreshAccessToken = (): Promise<string> => {
  // Upload and download can both hit an expired token at once
  if (!pendingRefresh) {
    pendingRefresh = doRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
};

const doRefresh = async (): Promise<string> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    clearTokens();
    return "";
  }

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const response = await requestToken(params);
  if (!response.ok) {
    // 400/401 mean the grant was revoked or expired, so the stored tokens are
    // dead. Anything else may be transient, so keep them and report the error.
    if (response.status === 400 || response.status === 401) {
      clearTokens();
      return "";
    }
    throw new Error(
      await readError(response, `Token refresh failed: ${response.status}`)
    );
  }

  const tokens: TokenResponse = await response.json();
  if (!tokens.access_token) {
    clearTokens();
    return "";
  }
  setTokens(tokens);
  return tokens.access_token;
};

/** A usable access token, refreshed if it is about to expire */
const getAccessToken = async (): Promise<string> => {
  const accessToken = localStorage.getItem(TOKEN_KEY);
  if (!accessToken) {
    return "";
  }

  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
  if (expiresAt && Date.now() > expiresAt - EXPIRY_MARGIN_MS) {
    return refreshAccessToken();
  }
  return accessToken;
};

/** An authenticated Dropbox request, refreshing once on a 401 */
const dropboxFetch = async (
  url: string,
  init: RequestInit = {}
): Promise<Response> => {
  const doRequest = (token: string) =>
    application.networkRequest(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getAccessToken();
  if (!token) {
    throw new Error(NOT_AUTHENTICATED);
  }

  let response = await doRequest(token);
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (!token) {
      throw new Error(NOT_AUTHENTICATED);
    }
    response = await doRequest(token);
  }
  return response;
};

// ============================================
// Sync Methods
// ============================================

const syncUpload = async (
  request: SyncUploadRequest
): Promise<SyncUploadResponse> => {
  if (!hasLogin()) {
    return { success: false, error: NOT_AUTHENTICATED };
  }

  try {
    const response = await dropboxFetch(DROPBOX_UPLOAD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: getFilePath(request.docUrl),
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: new Blob([base64ToUint8Array(request.data) as BlobPart]),
    });

    if (!response.ok) {
      return {
        success: false,
        error: await readError(
          response,
          `Dropbox upload failed: ${response.status}`
        ),
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

const syncDownload = async (
  request: SyncDownloadRequest
): Promise<SyncDownloadResponse> => {
  if (!hasLogin()) {
    return { data: null, error: NOT_AUTHENTICATED };
  }

  try {
    const response = await dropboxFetch(DROPBOX_DOWNLOAD_URL, {
      method: "POST",
      headers: {
        "Dropbox-API-Arg": JSON.stringify({
          path: getFilePath(request.docUrl),
        }),
      },
    });

    if (!response.ok) {
      const error = await readError(
        response,
        `Dropbox download failed: ${response.status}`
      );
      // No file yet: expected on the first sync
      if (response.status === 409 && error.includes("not_found")) {
        return { data: null };
      }
      return { data: null, error };
    }

    const arrayBuffer = await response.arrayBuffer();
    return { data: uint8ArrayToBase64(new Uint8Array(arrayBuffer)) };
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
 * Start the OAuth flow. The app has opened a blank popup named
 * request.popupName, navigates it to the url returned here, and relays the
 * callback url to onLoginCallback.
 */
const login = async (request: LoginRequest): Promise<LoginResponse | void> => {
  if (request.apiKey) {
    localStorage.setItem(CLIENT_ID_KEY, request.apiKey);
  }

  const verifier = generateCodeVerifier();
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const url = new URL(DROPBOX_AUTH_URL);
  url.searchParams.append("client_id", getClientId());
  url.searchParams.append("response_type", "code");
  url.searchParams.append("redirect_uri", getRedirectUri());
  url.searchParams.append("token_access_type", "offline");
  url.searchParams.append("code_challenge_method", "S256");
  url.searchParams.append("code_challenge", await generateCodeChallenge(verifier));

  return { url: url.toString() };
};

/** Exchange the authorization code in the relayed callback url for tokens */
const loginCallback = async (request: LoginCallbackRequest): Promise<void> => {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code");
  const error = callbackUrl.searchParams.get("error");

  if (error) {
    application.createNotification({
      message: `Dropbox auth failed: ${callbackUrl.searchParams.get("error_description") || error}`,
      type: "error",
    });
    return;
  }

  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
  if (!code || !verifier) {
    application.createNotification({
      message: "No authorization code received from Dropbox",
      type: "error",
    });
    return;
  }

  const params = new URLSearchParams();
  params.append("code", code);
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", getRedirectUri());
  params.append("code_verifier", verifier);

  const response = await requestToken(params);
  localStorage.removeItem(PKCE_VERIFIER_KEY);
  if (!response.ok) {
    const message = await readError(
      response,
      `Token exchange failed: ${response.status}`
    );
    application.createNotification({
      message: `Dropbox auth failed: ${message}`,
      type: "error",
    });
    return;
  }

  const tokens: TokenResponse = await response.json();
  if (tokens.access_token) {
    setTokens(tokens);
    application.createNotification({ message: "Successfully connected to Dropbox!" });
  } else {
    application.createNotification({
      message: "No access token received from Dropbox",
      type: "error",
    });
  }
};

const logout = async (): Promise<void> => {
  const token = localStorage.getItem(TOKEN_KEY);
  clearTokens();

  // Revoking the token is best effort; it is gone locally either way
  if (token) {
    try {
      await fetch(DROPBOX_REVOKE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore
    }
  }

  application.createNotification({ message: "Disconnected from Dropbox" });
};

const isLoggedIn = async (): Promise<boolean> => hasLogin();

// ============================================
// UI Message Handling
// ============================================

const sendMessage = (message: MessageType) => {
  application.postUiMessage(message);
};

const getInfo = () => {
  sendMessage({
    type: "info",
    clientId: localStorage.getItem(CLIENT_ID_KEY) || "",
    isLoggedIn: hasLogin(),
    redirectUri: getRedirectUri(),
  });
};

const handleUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "check-login":
      getInfo();
      break;
    case "save":
      if (message.clientId) {
        localStorage.setItem(CLIENT_ID_KEY, message.clientId);
      } else {
        localStorage.removeItem(CLIENT_ID_KEY);
      }
      application.createNotification({ message: "Settings saved!" });
      getInfo();
      break;
    case "logout":
      await logout();
      getInfo();
      break;
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
};

// ============================================
// Theme Handling
// ============================================

const changeTheme = (theme: Theme) => {
  localStorage.setItem("vite-ui-theme", theme);
};

const init = async () => {
  changeTheme(await application.getTheme());
};

// ============================================
// Wire up plugin handlers
// ============================================

application.onSyncUpload = syncUpload;
application.onSyncDownload = syncDownload;

application.onLogin = login;
application.onLoginCallback = loginCallback;
application.onLogout = logout;
application.onIsLoggedIn = isLoggedIn;

application.onUiMessage = handleUiMessage;
application.onChangeTheme = async (theme: Theme) => {
  changeTheme(theme);
};

init();
