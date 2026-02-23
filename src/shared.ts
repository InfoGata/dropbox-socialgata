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
  clientId: string;
  isLoggedIn: boolean;
};

export type MessageType = InfoType;
