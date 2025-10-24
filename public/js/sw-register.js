// Registra service worker para cache de IMAGENS (stale-while-revalidate).
// Não intercepta HTML/CSS/JS (evita “versão antiga” de tela).
(function(){
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    });
  })();