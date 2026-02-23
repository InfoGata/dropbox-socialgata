import { useState, useEffect } from "preact/hooks";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [clientId, setClientId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
          setClientId(event.data.clientId);
          setIsLoggedIn(event.data.isLoggedIn);
          break;
      }
    };

    window.addEventListener("message", onMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const saveCredentials = () => {
    sendUiMessage({ type: "save", clientId });
  };

  const handleLogout = () => {
    sendUiMessage({ type: "logout" });
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-md">
      <h1 className="text-xl font-bold">Dropbox Sync Plugin Settings</h1>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          {isLoggedIn ? (
            <span className="text-green-600 font-medium">Connected to Dropbox</span>
          ) : (
            <span className="text-yellow-600 font-medium">Not Connected</span>
          )}
        </p>
      </div>

      {isLoggedIn ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Your SocialGata favorites are being synced to your Dropbox account.
          </p>
          <Button variant="destructive" onClick={handleLogout}>
            Disconnect from Dropbox
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Dropbox App Credentials</h2>
            <p className="text-sm text-muted-foreground">
              To sync your favorites to Dropbox, you need to create a Dropbox app and
              enter the App Key below.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">App Key (Client ID)</label>
            <Input
              placeholder="Your Dropbox App Key"
              value={clientId}
              onChange={(e: any) => {
                const value = (e.target as HTMLInputElement).value;
                setClientId(value);
              }}
            />
          </div>

          <Button onClick={saveCredentials}>Save</Button>

          <div className="text-sm text-muted-foreground mt-4">
            <h3 className="font-medium mb-2">Setup Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to the{" "}
                <a
                  href="https://www.dropbox.com/developers/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Dropbox App Console
                </a>
              </li>
              <li>Click "Create app"</li>
              <li>Choose "Scoped access" API</li>
              <li>Choose "App folder" access type</li>
              <li>Name your app (e.g., "SocialGata Sync")</li>
              <li>In your app settings, add your SocialGata URL to the Redirect URIs</li>
              <li>
                Add redirect URI:{" "}
                <code className="bg-muted px-1 rounded">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/dropbox-auth-popup.html`
                    : "https://your-socialgata-url/dropbox-auth-popup.html"}
                </code>
              </li>
              <li>Under Permissions, enable "files.content.write" and "files.content.read"</li>
              <li>Copy the "App key" and paste it above</li>
              <li>Click Save, then go to SocialGata Settings → Cloud Sync to connect</li>
            </ol>
          </div>

          <div className="text-sm text-muted-foreground mt-4 p-3 bg-muted rounded-md">
            <h3 className="font-medium mb-2">Note:</h3>
            <p>
              After saving your App Key here, go to the SocialGata Settings page and
              select this plugin under Cloud Sync to complete the connection.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
