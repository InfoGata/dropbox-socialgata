import { jsx as _jsx } from "preact/jsx-runtime";
import { render } from "preact";
import App from "./App";
import { ThemeProvider } from "@infogata/shadcn-vite-theme-provider";
export const init = () => {
    render(_jsx(ThemeProvider, { children: _jsx(App, {}) }), document.body);
};
