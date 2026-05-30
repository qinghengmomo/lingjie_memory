// ════════════════════════════════════════════════════════════
// 灵界记忆库 · pages/gifts/scene.js
// 馆壳·写意雾境（薄荷玻璃花房）DOM 工厂
// 提供：
//   buildShell(container)  — 注入 SVG defs / 雾 / 花瓣 / 入口 / 三进容器
//   getSection(container, roomKey) — 取某进的 grid 容器
// ════════════════════════════════════════════════════════════

const SVG_DEFS = ''
+'<svg width="0" height="0" style="position:absolute"><defs>'
+'<symbol id="gh-camellia" viewBox="-100 -100 200 200"><g>'
+'<path d="M0,-70 C30,-60 50,-30 35,0 C50,30 30,60 0,55 C-30,60 -50,30 -35,0 C-50,-30 -30,-60 0,-70 Z" fill="#fff" opacity=".75"/>'
+'<path d="M0,-50 C25,-44 40,-22 28,0 C40,22 25,44 0,40 C-25,44 -40,22 -28,0 C-40,-22 -25,-44 0,-50 Z" fill="#fce8e6" opacity=".85"/>'
+'<circle cx="0" cy="0" r="14" fill="#e8c98a"/>'
+'<circle cx="-4" cy="-4" r="3" fill="#c4928f"/>'
+'<circle cx="5" cy="-3" r="3" fill="#c4928f"/>'
+'<circle cx="-2" cy="4" r="3" fill="#c4928f"/>'
+'</g></symbol>'
+'<symbol id="gh-crown" viewBox="0 0 120 32"><g fill="none" stroke="#c4928f" stroke-width="1.2">'
+'<path d="M2 28 Q60 4 118 28"/><path d="M10 28 Q60 14 110 28" opacity=".6"/>'
+'<circle cx="60" cy="6" r="4" fill="#c4928f"/>'
+'<circle cx="30" cy="15" r="2" fill="#c4928f"/>'
+'<circle cx="90" cy="15" r="2" fill="#c4928f"/>'
+'<path d="M55 6 L60 0 L65 6" stroke="#c4928f"/></g></symbol>'
+'<symbol id="gh-gateOrnament" viewBox="0 0 380 120"><g fill="none" stroke="#c4928f" stroke-width="1.4">'
+'<path d="M10 110 Q190 -10 370 110"/><path d="M30 110 Q190 16 350 110" opacity=".5"/>'
+'<path d="M50 110 Q190 38 330 110" opacity=".3"/>'
+'<circle cx="190" cy="10" r="6" fill="#c4928f"/>'
+'<circle cx="100" cy="42" r="3" fill="#c4928f"/>'
+'<circle cx="280" cy="42" r="3" fill="#c4928f"/>'
+'<circle cx="60" cy="72" r="2" fill="#c4928f"/>'
+'<circle cx="320" cy="72" r="2" fill="#c4928f"/>'
+'<path d="M188 0 v22 M170 8 h40"/></g></symbol>'
+'<symbol id="gh-gateBracket" viewBox="0 0 140 60"><g fill="none" stroke="#c4928f" stroke-width="1" opacity=".75">'
+'<path d="M2 56 Q70 4 138 56"/><path d="M14 56 Q70 18 126 56" opacity=".6"/>'
+'<circle cx="70" cy="8" r="3" fill="#c4928f"/>'
+'<path d="M68 0 v16 M58 6 h24"/></g></symbol>'
+'<symbol id="gh-plinth" viewBox="0 0 100 30"><g fill="none" stroke="#3a5b48" stroke-width=".8" opacity=".55">'
+'<path d="M10 8 q40 -8 80 0 t-80 0"/>'
+'<path d="M14 16 q36 -6 72 0"/>'
+'<path d="M8 24 q42 -6 84 0"/></g></symbol>'
+'<symbol id="gh-brushStroke" viewBox="0 0 600 120">'
+'<path d="M10 70 Q150 30 280 65 T580 50" stroke="#7d9485" stroke-width="6" fill="none" stroke-linecap="round" opacity=".6"/>'
+'<path d="M30 90 Q180 60 320 88 T580 80" stroke="#a8c0b1" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>'
+'</symbol>'
+'</defs></svg>';

const ROOMS=[
  {key:'1',num:'壹 · I',name:'心 动 碎 片 厅',sub:'a hall of small heartbeats'},
  {key:'2',num:'贰 · II',name:'信 物 长 廊',sub:'tokens, kept for you'},
  {key:'3',num:'叁 · III',name:'星 际 后 院',sub:'brought back from the stars'}
];

function buildPetals(){
  var pe=document.createElement('div');
  pe.id='gh-petals';
  for(var i=0;i<24;i++){
    var p=document.createElement('div');
    p.className='gh-petal'+(i%3===0?' gp-s':'');
    p.style.left=(Math.random()*100)+'%';
    p.style.animationDelay=-(Math.random()*14)+'s';
    p.style.animationDuration=(10+Math.random()*8)+'s';
    pe.appendChild(p);
  }
  return pe;
}

export function buildShell(container){
  container.innerHTML='';
  // 写意雾境背景
  var html=SVG_DEFS;
  html+='<div class="gh-world"></div>';
  html+='<svg class="gh-inkflower gf1" viewBox="-100 -100 200 200"><use href="#gh-camellia"/></svg>';
  html+='<svg class="gh-inkflower gf2" viewBox="-100 -100 200 200"><use href="#gh-camellia"/></svg>';
  html+='<svg class="gh-inkflower gf3" viewBox="-100 -100 200 200"><use href="#gh-camellia"/></svg>';
  html+='<svg class="gh-inkflower gf4" viewBox="-100 -100 200 200"><use href="#gh-camellia"/></svg>';
  html+='<svg class="gh-brush gb1" viewBox="0 0 600 120" preserveAspectRatio="none"><use href="#gh-brushStroke"/></svg>';
  html+='<svg class="gh-brush gb2" viewBox="0 0 600 120" preserveAspectRatio="none"><use href="#gh-brushStroke"/></svg>';
  html+='<div class="gh-fog"></div><div class="gh-fog gf-2"></div><div class="gh-fog gf-3"></div>';

  // 入口拱门 + 三进
  html+='<div class="gh-stage">';
  html+='  <div class="gh-gateway">';
  html+='    <svg class="gh-ornament" viewBox="0 0 380 120"><use href="#gh-gateOrnament"/></svg>';
  html+='    <h1>私 藏 花 房</h1>';
  html+='    <p>he keeps every fragment of light, for you</p>';
  html+='    <div class="gh-deco">❀ 三 进 园 林 ❀</div>';
  html+='  </div>';
  html+='  <div class="gh-house">';
  for(var i=0;i<ROOMS.length;i++){
    var r=ROOMS[i];
    html+='    <section class="gh-section">';
    html+='      <div class="gh-tower"><div class="gh-pillar"></div>';
    html+='        <div class="gh-gate"><svg viewBox="0 0 140 60"><use href="#gh-gateBracket"/></svg>';
    html+='          <span class="gh-num">'+r.num+'</span>';
    html+='          <span class="gh-name">'+r.name+'</span>';
    html+='          <span class="gh-sub">'+r.sub+'</span>';
    html+='        </div><div class="gh-pillar"></div></div>';
    html+='      <div class="gh-grid" data-room="'+r.key+'">';
    html+='        <div class="gh-empty">这一进暂时还没有藏品 · 等先生陆续放进来</div>';
    html+='      </div>';
    html+='    </section>';
  }
  html+='  </div>';
  html+='</div>';

  container.innerHTML=html;
  container.appendChild(buildPetals());
}

export function getRoomGrid(container, roomKey){
  return container.querySelector('.gh-grid[data-room="'+roomKey+'"]');
}

export function getRooms(){return ROOMS.slice();}
