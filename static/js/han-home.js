(function () {
  const canvas = document.querySelector('[data-han-hero-canvas]');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const context = canvas.getContext('2d');
  const hero = canvas.closest('.han-hero');
  const palette = ['#19e6ff', '#ffb733', '#ff3d7f', '#a6ff4d', '#f8fbff'];
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let particles = [];
  let comets = [];
  let animationFrame = 0;

  function resize() {
    const rect = hero.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const count = Math.max(86, Math.min(170, Math.floor(width / 9)));
    particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.58,
      vy: (Math.random() - 0.5) * 0.58,
      radius: Math.random() * 2.2 + 0.7,
      color: palette[index % palette.length],
    }));

    comets = Array.from({ length: 9 }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 120 + Math.random() * 220,
      speed: 1.5 + Math.random() * 2.4,
      delay: index * 24,
      color: palette[index % 3],
    }));
  }

  function drawLinks() {
    for (let i = 0; i < particles.length; i += 1) {
      for (let j = i + 1; j < particles.length; j += 1) {
        const first = particles[i];
        const second = particles[j];
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 142) {
          context.globalAlpha = (1 - distance / 142) * 0.22;
          context.strokeStyle = first.color;
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.stroke();
        }
      }
    }
    context.globalAlpha = 1;
  }

  function drawPointerField() {
    if (!pointer.active) return;

    context.globalAlpha = 0.28;
    context.strokeStyle = '#19e6ff';
    for (const particle of particles) {
      const dx = pointer.x - particle.x;
      const dy = pointer.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 220) {
        context.beginPath();
        context.moveTo(pointer.x, pointer.y);
        context.lineTo(particle.x, particle.y);
        context.stroke();
      }
    }
    context.globalAlpha = 1;

    const gradient = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 180);
    gradient.addColorStop(0, 'rgba(25, 230, 255, 0.18)');
    gradient.addColorStop(0.55, 'rgba(255, 61, 127, 0.06)');
    gradient.addColorStop(1, 'rgba(25, 230, 255, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(pointer.x, pointer.y, 180, 0, Math.PI * 2);
    context.fill();
  }

  function drawComets() {
    context.lineWidth = 1.4;
    for (const comet of comets) {
      comet.x += comet.speed;
      comet.y += comet.speed * 0.28;

      if (comet.x - comet.length > width || comet.y > height + 80) {
        comet.x = -comet.length - Math.random() * width * 0.35;
        comet.y = Math.random() * height * 0.72;
      }

      const gradient = context.createLinearGradient(comet.x - comet.length, comet.y - comet.length * 0.28, comet.x, comet.y);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.72, comet.color);
      gradient.addColorStop(1, 'rgba(255,255,255,0.85)');

      context.globalAlpha = 0.38;
      context.strokeStyle = gradient;
      context.beginPath();
      context.moveTo(comet.x - comet.length, comet.y - comet.length * 0.28);
      context.lineTo(comet.x, comet.y);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function tick() {
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;

    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > height) particle.vy *= -1;

      context.fillStyle = particle.color;
      context.globalAlpha = 0.72;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }

    drawComets();
    drawLinks();
    drawPointerField();
    animationFrame = requestAnimationFrame(tick);
  }

  hero.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
    hero.style.setProperty('--han-pointer-x', `${pointer.x}px`);
    hero.style.setProperty('--han-pointer-y', `${pointer.y}px`);
    hero.style.setProperty('--han-pointer-opacity', '1');
  });

  hero.addEventListener('pointerleave', () => {
    pointer.active = false;
    hero.style.setProperty('--han-pointer-opacity', '0');
  });

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => cancelAnimationFrame(animationFrame), { once: true });

  resize();
  tick();
}());
