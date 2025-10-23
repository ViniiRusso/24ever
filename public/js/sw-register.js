// public/js/sw-register.js
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!reg) {
          await navigator.serviceWorker.register('/sw.js');
          console.log('[sw-register] registered /sw.js');
        } else {
          console.log('[sw-register] sw already registered');
        }
      } catch (err) {
        console.warn('[sw-register] failed to register', err);
      }
    });
  }