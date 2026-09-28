import { useState, useEffect } from "preact/hooks";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { MessageType, UiMessageType } from "./shared";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [clientId, setClientId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "info":
          setClientId(event.data.clientId);
          setRedirectUri(event.data.redirectUri);
          setIsLoggedIn(event.data.isLoggedIn);
          break;
      }
    };

    window.addEventListener("message", onMessage);
    sendUiMessage({ type: "check-login" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const saveCredentials = () => {
    sendUiMessage({ type: "save", clientId: clientId.trim() });
  };

  const handleLogout = () => {
    sendUiMessage({ type: "logout" });
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-md">
      <h1 className="text-xl font-bold">Dropbox Sync Plugin Settings</h1>

      <p className="text-sm text-muted-foreground">
        Status:{" "}
        {isLoggedIn ? (
          <span className="text-green-600 font-medium">Connected to Dropbox</span>
        ) : (
          <span className="text-yellow-600 font-medium">Not Connected</span>
        )}
      </p>

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
          <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
            <p>
              No setup is needed. Go to SocialGata Settings → Cloud Sync, choose
              this plugin and log in with your Dropbox account.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Use Your Own Dropbox App (Optional)</h2>
            <p className="text-sm text-muted-foreground">
              Leave the App Key empty to use the default app.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">App Key</label>
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
                </a>{" "}
                and click "Create app"
              </li>
              <li>Choose "Scoped access" and "App folder"</li>
              <li>
                Under Permissions, enable "files.content.write" and
                "files.content.read"
              </li>
              <li>
                Add this Redirect URI:{" "}
                <code className="bg-muted px-1 rounded break-all">{redirectUri}</code>
              </li>
              <li>Copy the "App key", paste it above and click Save</li>
              <li>Go to SocialGata Settings → Cloud Sync to connect</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
