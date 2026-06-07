const YT_PARAMS = "rel=0&modestbranding=1&iv_load_policy=3";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function videoPlaceholder(slide) {
  const id = slide.video.id;
  const title = slide.video.legenda || slide.titulo;
  return `<div class="popup-rich-video" data-yt-id="${esc(id)}" data-yt-title="${esc(title)}">${slide.video.legenda ? `<p class="popup-rich-caption">${esc(slide.video.legenda)}</p>` : ""}</div>`;
}

function videoIframe(slide) {
  const id = slide.video.id;
  const title = slide.video.legenda || slide.titulo;
  return `<div class="popup-rich-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?${YT_PARAMS}" title="${esc(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>${slide.video.legenda ? `<p class="popup-rich-caption">${esc(slide.video.legenda)}</p>` : ""}</div>`;
}

function slideBody(slide, eagerVideo = false) {
  let html = `<h3 class="popup-rich-title">${esc(slide.titulo)}</h3>`;
  if (slide.texto) html += `<p class="popup-rich-text">${esc(slide.texto)}</p>`;
  if (slide.links?.length) {
    html += `<div class="popup-rich-links">${slide.links
      .map(
        (l) =>
          `<a class="popup-ext-link" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.titulo || l.href)}</a>`
      )
      .join("")}</div>`;
  }
  if (slide.foto) {
    html += `<figure class="popup-rich-media"><img src="${esc(slide.foto)}" alt="${esc(slide.legenda || slide.titulo)}" loading="lazy" decoding="async"><figcaption>${esc(slide.legenda || "")}</figcaption></figure>`;
  }
  if (slide.video?.tipo === "youtube" && slide.video.id) {
    html += eagerVideo ? videoIframe(slide) : videoPlaceholder(slide);
  }
  return html;
}

function mountVideo(slideEl) {
  const box = slideEl?.querySelector(".popup-rich-video[data-yt-id]:not([data-yt-ready])");
  if (!box) return;
  const id = box.dataset.ytId;
  const title = box.dataset.ytTitle || "";
  const caption = box.querySelector(".popup-rich-caption");
  box.dataset.ytReady = "1";
  box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?${YT_PARAMS}" title="${title.replace(/"/g, "&quot;")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  if (caption) box.appendChild(caption);
}

export function richPopupHtml(p, tiId) {
  const slides = p.popup.slides;
  const ctx = p.popup.contexto || p.nome;
  const n = slides.length;

  return `<div class="irun-rich-popup" data-slides="${n}">
    <div class="popup-rich-ctx">${esc(ctx)}</div>
    <div class="popup-rich-viewport">
      ${slides
        .map(
          (s, i) =>
            `<div class="popup-rich-slide${i === 0 ? " active" : ""}" data-idx="${i}">${slideBody(s, i === 0)}</div>`
        )
        .join("")}
    </div>
    ${
      n > 1
        ? `<div class="popup-rich-nav">
        <button type="button" class="popup-rich-btn popup-rich-prev" aria-label="Slide anterior">←</button>
        <span class="popup-rich-pos">1 de ${n}</span>
        <button type="button" class="popup-rich-btn popup-rich-next" aria-label="Próximo slide">→</button>
      </div>`
        : ""
    }
    ${p.entidadeId ? `<span class="popup-link" data-entity="${esc(p.entidadeId)}" data-ti="${esc(tiId)}">Ver ficha completa →</span>` : ""}
  </div>`;
}

export function initRichPopup(popupEl) {
  const root = popupEl?.querySelector(".irun-rich-popup");
  if (!root) return;

  const slides = [...root.querySelectorAll(".popup-rich-slide")];
  if (!slides.length) return;

  const pos = root.querySelector(".popup-rich-pos");
  let idx = slides.findIndex((s) => s.classList.contains("active"));
  if (idx < 0) idx = 0;

  const show = (i) => {
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, j) => s.classList.toggle("active", j === idx));
    if (pos) pos.textContent = `${idx + 1} de ${slides.length}`;
    mountVideo(slides[idx]);
  };

  mountVideo(slides[idx]);

  if (slides.length < 2) return;

  root.querySelector(".popup-rich-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show(idx - 1);
  });
  root.querySelector(".popup-rich-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    show(idx + 1);
  });
}

export function hasRichPopup(p) {
  return Array.isArray(p.popup?.slides) && p.popup.slides.length > 0;
}
