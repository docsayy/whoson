import { useEffect, useState } from "react";
import { Alert, Button, Snackbar, Stack } from "@mui/material";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __WHOSON_SW_UPDATE__?: ServiceWorkerRegistration;
  }
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PwaManager() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (!isStandalone() && localStorage.getItem("whoson-install-dismissed") !== "1") setShowInstall(true);
    };
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("whoson-sw-update", onUpdate);

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios && !isStandalone() && localStorage.getItem("whoson-ios-install-seen") !== "1") {
      window.setTimeout(() => setShowIosHelp(true), 1800);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("whoson-sw-update", onUpdate);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "dismissed") localStorage.setItem("whoson-install-dismissed", "1");
    setShowInstall(false);
    setInstallEvent(null);
  }

  function applyUpdate() {
    const registration = window.__WHOSON_SW_UPDATE__;
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  return (
    <>
      <Snackbar open={showInstall} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" variant="filled" sx={{ width: "100%" }}
          action={<Stack direction="row" spacing={0.5}><Button color="inherit" size="small" onClick={() => void install()}>Install</Button><Button color="inherit" size="small" onClick={() => { localStorage.setItem("whoson-install-dismissed", "1"); setShowInstall(false); }}>Later</Button></Stack>}>
          Install WhosOn for faster access and offline schedule viewing.
        </Alert>
      </Snackbar>
      <Snackbar open={showIosHelp} autoHideDuration={12000} onClose={() => { localStorage.setItem("whoson-ios-install-seen", "1"); setShowIosHelp(false); }} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" onClose={() => { localStorage.setItem("whoson-ios-install-seen", "1"); setShowIosHelp(false); }}>
          On iPhone or iPad: open Safari, tap Share, then “Add to Home Screen.”
        </Alert>
      </Snackbar>
      <Snackbar open={updateReady} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" action={<Button color="inherit" size="small" onClick={applyUpdate}>Update now</Button>}>
          A new WhosOn version is available.
        </Alert>
      </Snackbar>
    </>
  );
}
