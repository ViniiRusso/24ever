(function(){
  const btn = document.querySelector('.hamb');
  const drawer = document.getElementById('drawer');
  if (!btn || !drawer) return;

  const toggle = () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    drawer.classList.toggle('show', !open);
    document.body.style.overflow = !open ? 'hidden' : '';
  };

  btn.addEventListener('click', toggle);
  drawer.addEventListener('click', (e)=>{
    if (e.target === drawer) toggle();
  });

  // fecha com ESC
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && drawer.classList.contains('show')) toggle();
  });
})();