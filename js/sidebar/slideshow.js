let touchX = 0;
let lbPhotos = [];
let lbIndex = 0;

function bindSwipe(el, onLeft, onRight) {
  el.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].screenX; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - touchX;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) onLeft();
    else onRight();
  }, { passive: true });
}

function updateDom(el, img, cap, count, p, idx, total) {
  if (img) { img.src = p.src; img.alt = p.legenda || ""; }
  if (cap) cap.textContent = p.legenda || "";
  if (count) count.textContent = `${idx + 1} / ${total}`;
}

export function initPhotoLightbox() {
  if (document.getElementById("photo-lightbox")) return;
  const div = document.createElement("div");
  div.id = "photo-lightbox";
  div.className = "photo-lightbox";
  div.setAttribute("aria-hidden", "true");
  div.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Fechar">×</button>
    <button type="button" class="slideshow-nav slideshow-nav-prev" aria-label="Foto anterior">‹</button>
    <figure class="slideshow-lb-figure">
      <img class="slideshow-lb-img" src="" alt="">
      <figcaption class="slideshow-lb-caption"></figcaption>
      <span class="slideshow-lb-count"></span>
    </figure>
    <button type="button" class="slideshow-nav slideshow-nav-next" aria-label="Próxima foto">›</button>`;
  document.body.appendChild(div);

  const lbShow = (i) => {
    if (!lbPhotos.length) return;
    lbIndex = (i + lbPhotos.length) % lbPhotos.length;
    const p = lbPhotos[lbIndex];
    updateDom(
      div,
      div.querySelector(".slideshow-lb-img"),
      div.querySelector(".slideshow-lb-caption"),
      div.querySelector(".slideshow-lb-count"),
      p, lbIndex, lbPhotos.length
    );
  };

  const close = () => {
    div.classList.remove("open");
    div.setAttribute("aria-hidden", "true");
  };

  div.querySelector(".lightbox-close")?.addEventListener("click", close);
  div.addEventListener("click", (e) => { if (e.target === div) close(); });
  div.querySelector(".slideshow-nav-prev")?.addEventListener("click", (e) => { e.stopPropagation(); lbShow(lbIndex - 1); });
  div.querySelector(".slideshow-nav-next")?.addEventListener("click", (e) => { e.stopPropagation(); lbShow(lbIndex + 1); });
  bindSwipe(div, () => lbShow(lbIndex + 1), () => lbShow(lbIndex - 1));

  document.addEventListener("keydown", (e) => {
    if (!div.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
    if (e.key === "ArrowRight") lbShow(lbIndex + 1);
  });

  div._open = (photos, start) => {
    lbPhotos = photos;
    lbShow(start);
    div.classList.add("open");
    div.setAttribute("aria-hidden", "false");
  };
}

export function bindSlideshows(container) {
  const lightbox = document.getElementById("photo-lightbox");

  container.querySelectorAll("[data-slideshow]").forEach((el) => {
    let list = [];
    try { list = JSON.parse(el.dataset.photos || "[]"); } catch { list = []; }
    if (!list.length) return;

    let idx = 0;
    const img = el.querySelector(".slideshow-img");
    const cap = el.querySelector(".slideshow-caption");
    const count = el.querySelector(".slideshow-count");

    const show = (i) => {
      idx = (i + list.length) % list.length;
      updateDom(el, img, cap, count, list[idx], idx, list.length);
    };

    el.querySelector(".slideshow-prev")?.addEventListener("click", (e) => { e.stopPropagation(); show(idx - 1); });
    el.querySelector(".slideshow-next")?.addEventListener("click", (e) => { e.stopPropagation(); show(idx + 1); });
    el.querySelector(".slideshow-expand")?.addEventListener("click", () => lightbox?._open?.(list, idx));

    const viewport = el.querySelector(".slideshow-viewport");
    if (viewport) {
      bindSwipe(viewport, () => show(idx + 1), () => show(idx - 1));
      viewport.addEventListener("click", (e) => {
        if (e.target.closest(".slideshow-nav")) return;
        lightbox?._open?.(list, idx);
      });
    }

    show(0);
  });
}

export function renderSlideshow(fotos) {
  if (!fotos?.length) return `<p class="empty-rede">Fotos em breve.</p>`;
  const data = JSON.stringify(fotos).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "\\u003c");
  return `
    <div class="slideshow" data-slideshow data-photos='${data}'>
      <div class="slideshow-viewport">
        <button type="button" class="slideshow-nav slideshow-prev" aria-label="Foto anterior">‹</button>
        <img class="slideshow-img" src="${escAttr(fotos[0].src)}" alt="${escAttr(fotos[0].legenda || "")}" loading="lazy">
        <button type="button" class="slideshow-nav slideshow-next" aria-label="Próxima foto">›</button>
      </div>
      <p class="slideshow-caption">${esc(fotos[0].legenda || "")}</p>
      <div class="slideshow-meta">
        <span class="slideshow-count">1 / ${fotos.length}</span>
        <button type="button" class="slideshow-expand">Ampliar</button>
      </div>
    </div>`;
}

function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
