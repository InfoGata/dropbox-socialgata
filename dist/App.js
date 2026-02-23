import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useState, useEffect } from "preact/hooks";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
const sendUiMessage = (message) => {
    parent.postMessage(message, "*");
};
const App = () => {
    const [clientId, setClientId] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    useEffect(() => {
        const onMessage = (event) => {
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
    return (_jsxs("div", { className: "flex flex-col gap-4 p-4 max-w-md", children: [_jsx("h1", { className: "text-xl font-bold", children: "Dropbox Sync Plugin Settings" }), _jsx("div", { className: "flex flex-col gap-2", children: _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Status:", " ", isLoggedIn ? (_jsx("span", { className: "text-green-600 font-medium", children: "Connected to Dropbox" })) : (_jsx("span", { className: "text-yellow-600 font-medium", children: "Not Connected" }))] }) }), isLoggedIn ? (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Your SocialGata favorites are being synced to your Dropbox account." }), _jsx(Button, { variant: "destructive", onClick: handleLogout, children: "Disconnect from Dropbox" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("h2", { className: "font-medium", children: "Dropbox App Credentials" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "To sync your favorites to Dropbox, you need to create a Dropbox app and enter the App Key below." })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { className: "text-sm font-medium", children: "App Key (Client ID)" }), _jsx(Input, { placeholder: "Your Dropbox App Key", value: clientId, onChange: (e) => {
                                    const value = e.target.value;
                                    setClientId(value);
                                } })] }), _jsx(Button, { onClick: saveCredentials, children: "Save" }), _jsxs("div", { className: "text-sm text-muted-foreground mt-4", children: [_jsx("h3", { className: "font-medium mb-2", children: "Setup Instructions:" }), _jsxs("ol", { className: "list-decimal list-inside space-y-1", children: [_jsxs("li", { children: ["Go to the", " ", _jsx("a", { href: "https://www.dropbox.com/developers/apps", target: "_blank", rel: "noopener noreferrer", children: "Dropbox App Console" })] }), _jsx("li", { children: "Click \"Create app\"" }), _jsx("li", { children: "Choose \"Scoped access\" API" }), _jsx("li", { children: "Choose \"App folder\" access type" }), _jsx("li", { children: "Name your app (e.g., \"SocialGata Sync\")" }), _jsx("li", { children: "In your app settings, add your SocialGata URL to the Redirect URIs" }), _jsxs("li", { children: ["Add redirect URI:", " ", _jsx("code", { className: "bg-muted px-1 rounded", children: typeof window !== "undefined"
                                                    ? `${window.location.origin}/dropbox-auth-popup.html`
                                                    : "https://your-socialgata-url/dropbox-auth-popup.html" })] }), _jsx("li", { children: "Under Permissions, enable \"files.content.write\" and \"files.content.read\"" }), _jsx("li", { children: "Copy the \"App key\" and paste it above" }), _jsx("li", { children: "Click Save, then go to SocialGata Settings \u2192 Cloud Sync to connect" })] })] }), _jsxs("div", { className: "text-sm text-muted-foreground mt-4 p-3 bg-muted rounded-md", children: [_jsx("h3", { className: "font-medium mb-2", children: "Note:" }), _jsx("p", { children: "After saving your App Key here, go to the SocialGata Settings page and select this plugin under Cloud Sync to complete the connection." })] })] }))] }));
};
export default App;
