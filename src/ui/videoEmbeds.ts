/**
 * Click-to-play YouTube facade: the page loads only a local poster image and
 * a play button; the real iframe (and all of YouTube's JS) is injected on
 * click. Markup:
 *
 *   <div class="video-embed"
 *        data-video-id="XXXXXXXX"
 *        data-video-title="Game — Official Trailer"
 *        data-poster="/images/poster.png"></div>
 */
export function initVideoEmbeds(): void {
  document.querySelectorAll<HTMLElement>('[data-video-id]').forEach((box) => {
    const id = box.dataset.videoId;
    if (!id) return;
    const title = box.dataset.videoTitle ?? 'Video';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'video-embed__button';
    button.setAttribute('aria-label', `Play video: ${title}`);

    if (box.dataset.poster) {
      const img = document.createElement('img');
      img.src = box.dataset.poster;
      img.alt = '';
      img.loading = 'lazy';
      button.append(img);
    }
    const icon = document.createElement('span');
    icon.className = 'video-embed__icon';
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);

    // Nothing is fetched from Google until the click, and this label is what
    // makes that click an informed one (the GDPR consent for the embed).
    const note = document.createElement('span');
    note.className = 'video-embed__note';
    note.textContent = 'Plays via YouTube';
    button.append(note);

    button.addEventListener(
      'click',
      () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
        iframe.title = title;
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        box.replaceChildren(iframe);
      },
      { once: true },
    );

    box.append(button);
  });
}
