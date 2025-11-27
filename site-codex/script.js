const modeButtons = document.querySelectorAll(".mode-btn");
const modePanels = document.querySelectorAll(".mode-panel");
const nav = document.querySelector(".nav");
const menuToggle = document.querySelector(".menu-toggle");

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    modePanels.forEach((panel) => panel.classList.remove("active"));
    btn.classList.add("active");
    const target = document.getElementById(btn.dataset.target);
    if (target) target.classList.add("active");
  });
});

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });
}
