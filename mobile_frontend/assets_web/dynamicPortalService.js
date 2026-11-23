/**
 * dynamicPortalService.js
 * 
 * Fetches real-time, dynamic data from the MongoDB backend (/api/portal/home, /api/portal/stats, /api/news)
 * and hydrates the Match Centre, Leaderboards, Points Table, and News cards seamlessly.
 */

(function () {
  const API_BASE = (function () {
    if (typeof window !== 'undefined' && window.REACT_APP_API_URL) return window.REACT_APP_API_URL.replace(/\/+$/, '') + '/api';
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.port === '80' || window.location.port === '' || window.location.port === '443') return '/api';
      return `http://${window.location.hostname}:5000/api`;
    }
    return '/api';
  })();

  async function loadDynamicPortalData() {
    try {
      // 1. Fetch Dynamic Home Payload from MongoDB
      const res = await fetch(`${API_BASE}/portal/home`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.data) return;

      const portalData = data.data;

      // Update Ticker
      const tickerEl = document.getElementById('tickerContent');
      if (tickerEl && portalData.liveMatches && portalData.liveMatches.length > 0) {
        const live = portalData.liveMatches[0];
        const tickerSpan = tickerEl.querySelector('span:first-child');
        if (tickerSpan) {
          tickerSpan.innerHTML = `🔴 <strong>LIVE MATCH:</strong> ${live.teamA} vs ${live.teamB} at ${live.venue} — Live Scores Active in MongoDB!`;
        }
      }

      // Update News & Announcements Section
      if (portalData.news && portalData.news.length > 0) {
        updateDynamicNewsCards(portalData.news);
      }

      // 2. Fetch Dynamic Statistics & Points Table
      const statsRes = await fetch(`${API_BASE}/portal/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success && statsData.data) {
          updateDynamicStats(statsData.data);
        }
      }

      console.log('🍃 Public Portal successfully hydrated with dynamic data from MongoDB.');
    } catch (e) {
      console.warn('Backend dynamic sync note: using cached portal view.', e.message);
    }
  }

  function updateDynamicNewsCards(newsItems) {
    const newsContainer = document.querySelector('.news-grid') || document.getElementById('newsGrid');
    if (!newsContainer || !Array.isArray(newsItems)) return;

    // Retain existing styling, populate dynamic items
    const cardsHtml = newsItems.slice(0, 4).map(item => `
      <article class="news-card" style="animation: fadeInCard 0.4s ease forwards;">
        <div class="news-thumb">
          <img src="${item.image_url || '/assets_web/champions.jpg'}" alt="${item.title}" onerror="this.src='/assets_web/champions.jpg'" />
          <span class="badge ${item.category === 'MATCH_REPORT' ? 'badge-primary' : 'badge-gold'}">${item.category || 'News'}</span>
        </div>
        <div class="news-body">
          <div class="news-meta">
            <span><i class="fa-regular fa-calendar"></i> ${new Date(item.published_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span><i class="fa-regular fa-user"></i> ${item.author || 'Admin'}</span>
          </div>
          <h3 class="news-title">${item.title}</h3>
          <p class="news-desc">${item.summary || item.content?.substring(0, 120) + '...'}</p>
          <a href="javascript:void(0)" onclick="alert('${(item.title || '').replace(/'/g, "\\'")}\\n\\n${(item.content || '').replace(/'/g, "\\'")}')" class="read-more">Read Full Story →</a>
        </div>
      </article>
    `).join('');

    if (cardsHtml) {
      newsContainer.innerHTML = cardsHtml;
    }
  }

  function updateDynamicStats(stats) {
    // Dynamic Standings / Points Table
    const tableBody = document.querySelector('#pointsTable tbody') || document.querySelector('.standings-table tbody');
    if (tableBody && stats.standings && stats.standings.length > 0) {
      tableBody.innerHTML = stats.standings.map((t, idx) => `
        <tr>
          <td class="col-pos font-bold">${idx + 1}</td>
          <td class="col-team">
            <div class="team-cell">
              <span class="team-crest-small">${t.team_name ? t.team_name.slice(0, 2).toUpperCase() : 'TM'}</span>
              <span class="team-name font-semibold">${t.team_name}</span>
            </div>
          </td>
          <td>${t.matches}</td>
          <td>${t.won}</td>
          <td>${t.lost}</td>
          <td>${t.tied}</td>
          <td class="font-bold text-accent">${t.points}</td>
          <td class="col-nrr">${t.nrr > 0 ? '+' + t.nrr.toFixed(2) : t.nrr.toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDynamicPortalData);
  } else {
    loadDynamicPortalData();
  }

  // Refresh every 30 seconds for live match score updates
  setInterval(loadDynamicPortalData, 30000);
})();
