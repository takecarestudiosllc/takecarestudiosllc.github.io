/**
 * Contact form with no server behind it. The site is static, so instead of
 * POSTing anywhere the form composes the message into a mailto: URL and hands
 * it to the visitor's own mail client. Markup:
 *
 *   <form data-mailto="you@example.com"
 *         action="mailto:you@example.com" method="post" enctype="text/plain">
 *     ...fields named name / email / subject / message...
 *     <p class="support-status" role="status"></p>
 *   </form>
 *
 * The plain `action` stays in the markup as the no-JS fallback.
 */
export function initContactForms(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-mailto]').forEach((form) => {
    const to = form.dataset.mailto;
    if (!to) return;
    const status = form.querySelector<HTMLElement>('.support-status');

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const data = new FormData(form);
      const field = (name: string) => String(data.get(name) ?? '').trim();

      // The mail client fills in the real sender, but the typed one is what we
      // should reply to — keep it at the top of the message.
      const from = [field('name'), field('email') && `<${field('email')}>`].filter(Boolean).join(' ');
      const lines = from ? [`From: ${from}`, '', field('message')] : [field('message')];

      const query = new URLSearchParams({
        subject: field('subject') || 'Zhong support',
        body: lines.join('\n'),
      });
      // URLSearchParams encodes spaces as "+", which mail clients paste through
      // literally — mailto wants percent-encoding.
      window.location.href = `mailto:${to}?${query.toString().replace(/\+/g, '%20')}`;

      if (status) {
        status.textContent = `Opening your email app… if nothing happens, write to ${to} directly.`;
      }
    });
  });
}
