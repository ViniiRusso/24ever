AOS.init({ once: true, duration: 800, easing: 'ease-out' });

// toast simples
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'fixed bottom-16 left-1/2 -translate-x-1/2 bg-pink-600 text-white px-4 py-2 rounded-xl shadow-lg transition';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 10px)';
  }, 1600);
  setTimeout(() => el.remove(), 2100);
}

function fmt(dt) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

document.addEventListener('DOMContentLoaded', () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  const tzLabel = document.getElementById('tzLabel');
  if (tzLabel) tzLabel.textContent = `⏰ ${tz}`;

  const calendarEl = document.getElementById('calendar');
  const listWrap   = document.getElementById('eventsList');
  const form       = document.getElementById('evtForm');
  const clearBtn   = document.getElementById('clearForm');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 650,
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    selectable: true,
    selectMirror: true,
    select(info) {
      document.getElementById('evStart').value = info.startStr.slice(0, 16);
      document.getElementById('evEnd').value   = info.endStr ? info.endStr.slice(0, 16) : '';
      document.getElementById('evAll').checked = true;
      document.getElementById('evTitle').focus();
    },
    eventClick(info) {
      if (confirm(`Remover o evento "${info.event.title}"?`)) {
        fetch('/api/events/' + info.event.id, { method: 'DELETE' })
          .then(r => r.json())
          .then(() => { loadEvents(); toast('Evento removido'); })
          .catch(() => toast('Erro ao remover'));
      }
    }
  });
  calendar.render();

  function renderEventsList(events) {
    listWrap.innerHTML = '';
    if (!events.length) {
      listWrap.innerHTML = '<div class="text-gray-500">Nenhum evento</div>';
      return;
    }
    events.sort((a, b) => new Date(b.start) - new Date(a.start));
    events.slice(0, 8).forEach(ev => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2 border rounded-xl bg-white/60 hover:shadow transition';
      el.innerHTML = `
        <div class="mr-3">
          <div class="font-medium">${ev.title}</div>
          <div class="text-[11px] text-gray-500">
            ${fmt(ev.start)}${ev.end ? (' → ' + fmt(ev.end)) : ''}${ev.allDay ? ' • dia todo' : ''}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${ev.id}" class="px-2 py-1 text-xs rounded-lg bg-pink-100 text-pink-700 hover:bg-pink-200">Remover</button>
        </div>`;
      listWrap.appendChild(el);
    });

    listWrap.querySelectorAll('button[data-id]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        if (!confirm('Remover?')) return;
        fetch('/api/events/' + id, { method: 'DELETE' })
          .then(() => { loadEvents(); toast('Evento removido'); })
          .catch(() => toast('Erro ao remover'));
      });
    });
  }

  function loadEvents() {
    fetch('/api/events')
      .then(r => r.json())
      .then(events => {
        calendar.removeAllEvents();
        events.forEach(e => {
          calendar.addEvent({ id: e.id, title: e.title, start: e.start, end: e.end || null, allDay: !!e.allDay });
        });
        renderEventsList(events);
      })
      .catch(() => toast('Erro ao carregar eventos'));
  }

  loadEvents();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title  = document.getElementById('evTitle').value.trim();
    const start  = document.getElementById('evStart').value;
    const end    = document.getElementById('evEnd').value;
    const allDay = document.getElementById('evAll').checked;

    if (!title || !start) { alert('Título e início obrigatórios'); return; }

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, start, end: end || null, allDay })
    })
    .then(r => r.json())
    .then(() => {
      form.reset();
      loadEvents();
      toast('Evento adicionado');
      calendarEl.animate(
        [{ transform:'scale(1)' }, { transform:'scale(1.01)' }, { transform:'scale(1)' }],
        { duration: 320 }
      );
    })
    .catch(() => toast('Erro ao adicionar'));
  });

  clearBtn.addEventListener('click', () => form.reset());
});
