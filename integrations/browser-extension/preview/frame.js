// Loads the popup in an iframe at its natural height, like the browser does for action popups.
const params = new URLSearchParams(location.search);
const frame = document.getElementById("popup");
frame.src = `popup.html?state=${encodeURIComponent(params.get("state") ?? "created")}`;
const fit = () => {
  const doc = frame.contentDocument;
  if (doc?.body) frame.style.height = `${Math.min(600, Math.ceil(doc.body.getBoundingClientRect().height))}px`;
};
frame.addEventListener("load", () => {
  fit();
  new frame.contentWindow.ResizeObserver(fit).observe(frame.contentDocument.body);
});
