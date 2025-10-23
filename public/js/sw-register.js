// Registra o Service Worker para manter timeline/js/css no cache entre páginas
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    });
  }