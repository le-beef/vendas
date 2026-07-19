(() => {
  const installButton = document.getElementById("installAppButton");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("Service Worker não registrado:", error));
    });
  }

  if (!installButton || isStandalone) return;
  installButton.hidden = false;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installButton.hidden = true;
  });

  installButton.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === "accepted") installButton.hidden = true;
      return;
    }

    if (isIos) {
      window.alert("No iPhone ou iPad: toque no botão Compartilhar do Safari e depois em ‘Adicionar à Tela de Início’.");
      return;
    }

    window.alert("Abra o menu do navegador (⋮) e escolha ‘Instalar app’ ou ‘Adicionar à tela inicial’.");
  });
})();
