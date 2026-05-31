// 碎片馆 · 馆壳 DOM 工厂
// 负责生成暗红烛影室的所有装饰元素

export function buildScene(container) {
  container.innerHTML = `
    <div class="shards-ceiling"></div>
    <div class="shards-carpet"></div>
    <div class="shards-wallshadow"></div>
    <div id="shards-petals" aria-hidden="true"></div>
    <div class="shards-book" aria-hidden="true"></div>

    <svg class="shards-ornament left" viewBox="0 0 60 80"><path d="M5 78 Q5 50 15 30 Q25 15 30 5 M30 5 L35 20 M30 5 L25 18"/><circle class="accent" cx="30" cy="5" r="3"/><path d="M15 50 Q25 45 35 55"/><path d="M10 65 Q22 60 32 70"/><circle cx="15" cy="30" r="2"/><circle cx="25" cy="15" r="1.5"/></svg>
    <svg class="shards-ornament right" viewBox="0 0 60 80"><path d="M5 78 Q5 50 15 30 Q25 15 30 5 M30 5 L35 20 M30 5 L25 18"/><circle class="accent" cx="30" cy="5" r="3"/><path d="M15 50 Q25 45 35 55"/><path d="M10 65 Q22 60 32 70"/><circle cx="15" cy="30" r="2"/><circle cx="25" cy="15" r="1.5"/></svg>

    <div class="shards-room"></div>
    <div class="shards-velvet"></div>
    <div class="shards-cob tl"></div>
    <div class="shards-cob tr"></div>
    <div class="shards-candle-wrap">
      <div class="shards-candle-glow"></div>
      <div class="shards-candle-stick"></div>
      <div class="shards-candle-flame"></div>
    </div>

    <div class="shards-title">
      <h1>暗 红 烛 影 室</h1>
      <div class="sub">CRIMSON CHAMBER · OF FRAGMENTS</div>
      <div class="deco-double"><span class="line"></span><span class="gem"></span><span class="line thin"></span></div>
    </div>

    <div class="shards-constellation" id="shards-constel">
      <div class="shards-const-hint" id="shards-cstHint"></div>
      <div class="shards-const-inner" id="shards-cstInner">
        <svg id="shards-cstSvg" preserveAspectRatio="none">
          <defs>
            <radialGradient id="shards-starGlow">
              <stop offset="0%" stop-color="rgba(255,200,140,0.5)"/>
              <stop offset="50%" stop-color="rgba(216,160,96,0.18)"/>
              <stop offset="100%" stop-color="rgba(216,160,96,0)"/>
            </radialGradient>
          </defs>
        </svg>
      </div>
    </div>

    <div class="shards-gallery" id="shards-gallery"></div>

    <div class="shards-mask" id="shards-mask">
      <div class="shards-detail" id="shards-detail">
        <button class="close" id="shards-close">&times;</button>
        <div class="head" id="shards-dh"></div>
        <h2 id="shards-dt"></h2>
        <div class="body" id="shards-db"></div>
      </div>
    </div>

    <div class="shards-auth-placeholder" id="shards-auth-msg" style="display:none">
      请先登录后查看碎片
    </div>
  `;

  // 花瓣
  const pe = container.querySelector('#shards-petals');
  if (pe) {
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'shards-petal' + (i % 3 === 0 ? ' s' : '');
      p.style.left = (Math.random() * 100) + '%';
      p.style.animationDelay = (-Math.random() * 18) + 's';
      p.style.animationDuration = (14 + Math.random() * 10) + 's';
      pe.appendChild(p);
    }
  }
}
