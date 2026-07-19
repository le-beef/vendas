// Este arquivo não depende do Firebase: a senha funciona até ao abrir index.html diretamente no computador.
(() => {
  const ACCESS_PASSWORD = "838726";
  const ACCESS_KEY = "ingressa-access-v3";
  const dialog = document.getElementById("accessModal");
  const form = document.getElementById("accessForm");
  const field = document.getElementById("accessPassword");
  const error = document.getElementById("accessError");

  if (localStorage.getItem(ACCESS_KEY) === "granted") return;
  dialog.showModal();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (field.value !== ACCESS_PASSWORD) {
      error.textContent = "Senha incorreta. Tente novamente.";
      field.select();
      return;
    }
    localStorage.setItem(ACCESS_KEY, "granted");
    dialog.close();
    window.dispatchEvent(new Event("ingressa:access-granted"));
  });
})();
