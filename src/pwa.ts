export function registerWhosOnServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting) {
        window.__WHOSON_SW_UPDATE__ = registration;
        window.dispatchEvent(new Event("whoson-sw-update"));
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.__WHOSON_SW_UPDATE__ = registration;
            window.dispatchEvent(new Event("whoson-sw-update"));
          }
        });
      });
    }).catch((error) => console.warn("WhosOn service worker registration failed.", error));

    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
  });
}
