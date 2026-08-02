import { createRoot } from "react-dom/client";
import { createHubBridge } from "./hub/bridge";
import { HubScreen } from "./hub/HubScreen";
import "../styles.css";

createHubBridge();

const mount = document.getElementById("hub-root");
if (mount) {
  createRoot(mount).render(<HubScreen />);
}

// Load gameplay after the hub mounts so the bridge exists for boot refresh.
await import("../game.js");
