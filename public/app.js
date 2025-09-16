(() => {
  const el = (id) => document.getElementById(id);
  const consentView = el('consent-view');
  const quizView = el('quiz-view');
  const resultView = el('result-view');

  let sessionId = null;
  let items = [];
  let currentIndex = 0;
  let questionStart = 0;
  let selections = {}; // itemId -> selected index
  let answeredCount = 0;
  let globalEndsAt = 0; // 非強制（表示のみ）

  const show = (v) => {
    for (const sec of document.querySelectorAll('.view')) sec.classList.remove('active');
    v.classList.add('active');
  };

  const formatMMSS = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const tickGlobalTimer = () => {
    if (!globalEndsAt) return;
    const remain = globalEndsAt - Date.now();
    el('global-timer').textContent = formatMMSS(remain);
    requestAnimationFrame(tickGlobalTimer);
  };

  const updateAnsweredCount = () => {
    answeredCount = items.filter((it) => selections[it.id] !== undefined).length;
    el('remain').textContent = String(items.length - answeredCount);
  };

  const renderQNav = () => {
    const wrap = el('qnav');
    wrap.innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.textContent = String(i + 1);
      if (i === currentIndex) b.classList.add('current');
      if (selections[it.id] !== undefined) b.classList.add('answered');
      b.onclick = () => {
        currentIndex = i;
        renderCurrent();
      };
      wrap.appendChild(b);
    });
  };

  const renderCurrent = () => {
    const item = items[currentIndex];
    questionStart = performance.now();
    updateAnsweredCount();
    el('part').textContent = item.part;
    el('stem').textContent = item.stem;
    const opt = el('options');
    opt.innerHTML = '';
    item.options.forEach((text, idx) => {
      const b = document.createElement('button');
      b.textContent = text;
      if (selections[item.id] === idx) b.classList.add('selected');
      b.onclick = async () => {
        const rtMs = Math.round(performance.now() - questionStart);
        // 二重送信防止と選択の視覚フィードバック
        const all = Array.from(opt.querySelectorAll('button'));
        all.forEach((bb) => (bb.disabled = true));
        b.classList.add('selected');
        try {
          const res = await fetch('/v1/assessment/answer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, itemId: item.id, selected: idx, rtMs })
          });
          await res.json();
          selections[item.id] = idx;
          updateAnsweredCount();
          // 小さなディレイで次問へ自動遷移（最後はそのまま）
          setTimeout(() => {
            if (currentIndex < items.length - 1) currentIndex += 1;
            renderCurrent();
          }, 120);
        } catch (e) {
          alert('送信でエラーが発生しました');
          console.error(e);
        }
      };
      opt.appendChild(b);
    });
    renderQNav();
    // Buttons state
    el('prev-btn').disabled = currentIndex === 0;
    el('next-btn').disabled = currentIndex === items.length - 1;
  };

  const startAssessment = async () => {
    try {
      const res = await fetch('/v1/assessment/start', { method: 'POST' });
      const data = await res.json();
      sessionId = data.sessionId;
      items = data.items;
      selections = {};
      currentIndex = 0;
      updateAnsweredCount();
      globalEndsAt = Date.now() + 10 * 60 * 1000; // 10分（表示のみ）
      tickGlobalTimer();
      renderCurrent();
      show(quizView);
    } catch (e) {
      alert('開始時にエラーが発生しました');
      console.error(e);
    }
  };

  const finishAssessment = async () => {
    // 先に結果画面へ遷移しローディング表示
    show(resultView);
    el('scaled').textContent = '計算中...';
    el('cefr').textContent = '計算中...';
    el('ci').textContent = '—';
    el('insights').innerHTML = '';
    const details = el('details');
    details.innerHTML = '';
    const insightsLoading = el('insights-loading');
    const detailsLoading = el('details-loading');
    if (insightsLoading) insightsLoading.style.display = 'block';
    if (detailsLoading) detailsLoading.style.display = 'block';
    // スケルトン（縦並び）
    for (let i = 0; i < items.length; i++) {
      const box = document.createElement('div');
      box.className = 'box';
      box.innerHTML = `<div class="skeleton" style="width:30%"></div>
      <div class="skeleton" style="width:90%"></div>
      <div class="skeleton" style="width:60%"></div>`;
      details.appendChild(box);
    }
    try {
      // 1) finish-lite を試し、なければ finish にフォールバック
      let data;
      try {
        const resLite = await fetch('/v1/assessment/finish-lite', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        if (resLite.status === 404) throw new Error('finish-lite-not-found');
        data = await resLite.json();
        if (!resLite.ok) throw new Error((data && data.message) || 'サーバエラー');
      } catch (_) {
        const resFull = await fetch('/v1/assessment/finish', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        data = await resFull.json();
        if (!resFull.ok) throw new Error((data && data.message) || 'サーバエラー');
      }

      // 2) スコアと回答＋解説の描画
      el('scaled').textContent = String(data.scaled_reading);
      el('cefr').textContent = String(data.cefr);
      el('ci').textContent = `${data.provisional_ci[0]} – ${data.provisional_ci[1]}`;
      if (detailsLoading) detailsLoading.style.display = 'none';
      details.innerHTML = '';
      (data.responses || []).forEach((r, idx) => {
        const box = document.createElement('div');
        box.className = 'box ' + (r.correct === true ? 'ok' : 'ng');
        const your = r.selected != null ? `${r.selected + 1}. ${r.options[r.selected]}` : '未回答';
        const corr = `${r.answer + 1}. ${r.options[r.answer]}`;
        const ok = r.correct === null ? '' : r.correct ? '（正解）' : '（不正解）';
        box.innerHTML = `<div><strong>Q${idx + 1} [${r.part}]</strong></div>
        <div style=\"margin:.2rem 0 .4rem\">${r.stem}</div>
        <div>あなたの回答: ${your} ${ok}</div>
        <div>正解: ${corr}</div>
        <div style=\"margin-top:.4rem\"><em>解説:</em> ${r.explanation || ''}</div>`;
        // 選択肢ごとの内訳
        const ob = document.createElement('div');
        ob.className = 'options-breakdown';
        (r.options || []).forEach((optText, i) => {
          const line = document.createElement('div');
          const isCorrect = i === r.answer;
          const isSelected = r.selected === i;
          line.className = 'opt-line';
          if (isCorrect) line.classList.add('correct');
          if (isSelected && !isCorrect) line.classList.add('selected-ng');
          const badges = document.createElement('span');
          if (isCorrect) {
            const b = document.createElement('span'); b.className = 'badge badge-correct'; b.textContent = '正解'; badges.appendChild(b);
          }
          if (isSelected) {
            const b = document.createElement('span'); b.className = 'badge badge-chosen' + (isCorrect ? '' : ' badge-wrong'); b.textContent = 'あなたの選択'; badges.appendChild(b);
          }
          const title = document.createElement('span');
          title.textContent = `${i + 1}. ${optText}`;
          const rationaleText = (r.rationales && r.rationales[i]) ? r.rationales[i] : '';
          const rationaleEl = document.createElement('span');
          rationaleEl.className = 'rationale';
          rationaleEl.textContent = rationaleText ? `理由: ${rationaleText}` : '';
          line.appendChild(badges);
          line.appendChild(title);
          if (rationaleText) line.appendChild(rationaleEl);
          ob.appendChild(line);
        });
        box.appendChild(ob);
        details.appendChild(box);
      });

      // 3) 所見表示（含まれていなければ別途生成）
      if (Array.isArray(data.insights) && data.insights.length > 0) {
        if (insightsLoading) insightsLoading.style.display = 'none';
        const ul = el('insights');
        ul.innerHTML = '';
        (data.insights || []).forEach((i) => {
          // 新フォーマット: { key,label,meaning,read,practice[],examples[] }
          const div = document.createElement('div');
          div.className = 'insight';
          const ex = (i.examples || []).length ? `関連設問: Q${(i.examples || []).join(', Q')}` : '';
          div.innerHTML = `
            <h4>${i.label || i.key}</h4>
            <div class="meta">意味: ${i.meaning || ''}</div>
            <div class="meta">読み取りのコツ: ${i.read || ''}</div>
          `;
          const ulPractice = document.createElement('ul');
          (i.practice || []).forEach((p) => {
            const li = document.createElement('li'); li.textContent = p; ulPractice.appendChild(li);
          });
          div.appendChild(ulPractice);
          if (ex) {
            const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = ex; div.appendChild(meta);
          }
          ul.appendChild(div);
        });
      } else {
        try {
          const r2 = await fetch('/v1/assessment/insights', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });
          const d2 = await r2.json();
          if (!r2.ok) throw new Error((d2 && d2.message) || '所見生成エラー');
          if (insightsLoading) insightsLoading.style.display = 'none';
          const ul = el('insights');
          ul.innerHTML = '';
          (d2.insights || []).forEach((i) => {
            const div = document.createElement('div');
            div.className = 'insight';
            const ex = (i.examples || []).length ? `関連設問: Q${(i.examples || []).join(', Q')}` : '';
            div.innerHTML = `
              <h4>${i.label || i.key}</h4>
              <div class="meta">意味: ${i.meaning || ''}</div>
              <div class="meta">読み取りのコツ: ${i.read || ''}</div>
            `;
            const ulPractice = document.createElement('ul');
            (i.practice || []).forEach((p) => {
              const li = document.createElement('li'); li.textContent = p; ulPractice.appendChild(li);
            });
            div.appendChild(ulPractice);
            if (ex) { const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = ex; div.appendChild(meta); }
            ul.appendChild(div);
          });
        } catch (e) {
          if (insightsLoading) insightsLoading.textContent = '所見の生成に失敗しました';
          console.error(e);
        }
      }
    } catch (e) {
      alert('結果取得でエラーが発生しました');
      console.error(e);
    }
  };

  // Events
  document.addEventListener('DOMContentLoaded', () => {
    el('start-btn').addEventListener('click', startAssessment);
    el('prev-btn').addEventListener('click', () => { if (currentIndex > 0) { currentIndex -= 1; renderCurrent(); } });
    el('next-btn').addEventListener('click', () => { if (currentIndex < items.length - 1) { currentIndex += 1; renderCurrent(); } });
    el('finish-btn').addEventListener('click', finishAssessment);
    el('retry-btn').addEventListener('click', () => location.reload());
  });
})();
