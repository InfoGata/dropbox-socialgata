// Default InfoGata Dropbox app. Uses PKCE, so no secret is needed.
export const DEFAULT_CLIENT_ID = "snh5epd0kapddn6";

// Messages from UI to plugin
type UiCheckLogin = {
  type: "check-login";
};

type UiLogout = {
  type: "logout";
};

type UiSave = {
  type: "save";
  clientId: string;
};

export type UiMessageType = UiCheckLogin | UiLogout | UiSave;

// Messages from plugin to UI
type InfoType = {
  type: "info";
  /** The user's own app key, or empty when the default app is used */
  clientId: string;
  isLoggedIn: boolean;
  redirectUri: string;
};

export type MessageType = InfoType;
