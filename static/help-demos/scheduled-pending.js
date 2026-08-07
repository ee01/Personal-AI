const app = document.getElementById('app');
      const messages = document.getElementById('messages');
      const draft = document.getElementById('draft');
      const composerBox = document.getElementById('composerBox');
      const scheduleBtn = document.getElementById('scheduleBtn');
      const sendBtn = document.getElementById('sendBtn');
      const pending = document.getElementById('pending');
      const pendingBox = document.getElementById('pendingBox');
      const pendingContent = pendingBox.querySelector('.pending-content');
      const antsRect = document.querySelector('#ants rect');
      const playBtn = document.getElementById('play');
      const staticBtn = document.getElementById('static');

      const DRAFT_HTML = draft.innerHTML;

      // 让虚线轮廓贴合待发送气泡的真实尺寸
      function sizeAnts() {
        const r = pendingBox.getBoundingClientRect();
        if (!r.width) return;
        antsRect.setAttribute('width', String(Math.max(0, r.width - 2)));
        antsRect.setAttribute('height', String(Math.max(0, r.height - 2)));
      }
      const ro = new ResizeObserver(sizeAnts);
      ro.observe(pendingBox);
      window.addEventListener('resize', sizeAnts);

      function showStatic() {
        document.querySelectorAll('.flight').forEach((n) => n.remove());
        draft.innerHTML = '正在输入信息…';
        draft.classList.add('empty');
        scheduleBtn.classList.add('armed');
        sendBtn.classList.remove('active');
        pending.classList.add('show');
        sizeAnts();
        messages.scrollTop = messages.scrollHeight;
      }

      function reset() {
        document.querySelectorAll('.flight').forEach((n) => n.remove());
        draft.innerHTML = DRAFT_HTML;
        draft.classList.remove('empty');
        composerBox.classList.add('focus');
        scheduleBtn.classList.remove('armed');
        sendBtn.classList.add('active');
        pending.classList.remove('show');
        messages.scrollTop = messages.scrollHeight - 1;
      }

      function play() {
        reset();

        // 1) 轻点定时按钮的反馈
        scheduleBtn.classList.add('armed');

        // 2) 量出起点（草稿框）与终点（底部待发送气泡）
        const start = draft.getBoundingClientRect();

        // 先临时显示 pending 以测量落点，再隐藏
        pending.classList.add('show');
        sizeAnts();
        const end = pendingBox.getBoundingClientRect();
        pending.classList.remove('show');

        // 3) 创建飞行克隆体（外观＝待发送虚线气泡）
        const flight = document.createElement('div');
        flight.className = 'flight';
        flight.innerHTML = `<span class="mention">@Rebecca Cao</span> 下班前把认证材料的截图同步到这个群里，明早评审要用，辛苦啦 🙏`;
        flight.style.left = start.left + 'px';
        flight.style.top = start.top + 'px';
        flight.style.width = Math.min(start.width, 460) + 'px';
        document.body.appendChild(flight);

        // 4) 草稿框清空
        draft.innerHTML = '正在输入信息…';
        draft.classList.add('empty');
        composerBox.classList.remove('focus');

        const dx = end.left - start.left;
        const dy = end.top - start.top;

        // 5) 沿轻微下坠曲线飞向列表底部
        const anim = flight.animate(
          [
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0 },
            {
              transform: `translate(${dx * 0.55}px, ${dy * 0.32}px) scale(0.99)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate(${dx}px, ${dy}px) scale(0.985)`,
              opacity: 0,
              offset: 1,
            },
          ],
          { duration: 620, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)', fill: 'forwards' },
        );

        // 6) 落地：真实待发送消息淡入 + 列表滚到底
        setTimeout(() => {
          pending.classList.add('show');
          sizeAnts();
          messages.scrollTop = messages.scrollHeight;
        }, 430);

        anim.finished.finally(() => flight.remove());
      }

      playBtn.addEventListener('click', play);
staticBtn.addEventListener('click', showStatic);
scheduleBtn.addEventListener('click', play);

// 初始：可发送态；等布局就绪后再自动演示（iframe 从 display:none 展开时尤其重要）
reset();

function autoPlayWhenReady(attempt) {
  const tries = typeof attempt === 'number' ? attempt : 0;
  sizeAnts();
  const start = draft.getBoundingClientRect();
  if (start.width > 0 && start.height > 0) {
    play();
    return;
  }
  if (tries < 40) {
    window.setTimeout(() => autoPlayWhenReady(tries + 1), 100);
  }
}

window.addEventListener('load', () => {
  window.setTimeout(() => autoPlayWhenReady(0), 200);
});

// 父页展开预览时 iframe 可能刚变为可见，补一次自动播放
if (typeof IntersectionObserver !== 'undefined') {
  let playedOnce = false;
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0);
      if (!visible || playedOnce) return;
      playedOnce = true;
      window.setTimeout(() => autoPlayWhenReady(0), 120);
    },
    { threshold: 0.05 },
  );
  io.observe(document.body);
}
