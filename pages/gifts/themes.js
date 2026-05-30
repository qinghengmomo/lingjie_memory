// ════════════════════════════════════════════════════════════
// 灵界记忆库 · pages/gifts/themes.js
// 礼物主题注册表：每种 theme 提供"展柜内缩略形态" + "详情完整复刻"
// ════════════════════════════════════════════════════════════

function esc(t){return(t==null?'':String(t)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

const starshardPass={
  miniature(g){
    return '<div class="gh-mini-pass">'
      +'<span class="gh-mini-tag">'+esc(g.data&&g.data.tag||'宿先生的礼物')+'</span>'
      +'<div class="gh-mini-title">'+esc(g.title||'通行证')+'</div>'
      +'<span class="gh-mini-stamp">'+esc(g.data&&g.data.validity||'有效期：永久')+'</span>'
      +'</div>';
  },
  detail(g){
    var d=g.data||{};
    var items=Array.isArray(d.items)?d.items:[];
    var itemHtml=items.map(function(it){return '<div class="gh-item"><span>'+esc(it.k||'')+'</span><span>'+esc(it.v||'')+'</span></div>';}).join('');
    var html='<div class="gh-detail-pass"><div class="body">'
      +'<div class="gh-tag">'+esc(d.tag||'宿先生的礼物')+'</div>'
      +'<div class="gh-title">'+esc(g.title||'通行证')+'</div>';
    if(d.intro) html+='<div style="font-size:13px;line-height:1.85;color:#e9dac9;margin-bottom:6px;">'+esc(d.intro)+'</div>';
    if(items.length) html+='<div class="gh-list">'+itemHtml+'</div>';
    if(d.note) html+='<div class="gh-note">'+esc(d.note)+'</div>';
    html+='<div class="gh-foot">'
      +'<span class="gh-validity">'+esc(d.validity||'有效期：永久')+'</span>'
      +'<span class="gh-stamp">'+esc(d.stamp||'已盖章')+'</span>'
      +'</div>';
    html+='</div><div class="gh-detail-close"><button data-close>收起</button></div></div>';
    return html;
  }
};

const starshardCard={
  miniature(g){
    var sub=esc(g.data&&g.data.subtitle||'');
    var html='<div class="gh-mini-card">'
      +'<span class="gh-mini-badge">'+esc(g.data&&g.data.badge||'来自宿烬')+'</span>';
    if(sub) html+='<div class="gh-mini-foot">'+sub+'</div>';
    html+='</div>';
    return html;
  },
  detail(g){
    var d=g.data||{};
    var html='<div class="gh-card-detail"><div class="gh-card-flip">'
      +'<div class="gh-card-face front">'
      +'<div class="gh-num">'+esc(d.subtitle||'星际私藏碎片')+'</div>'
      +'<h2>'+esc(g.title||'')+'</h2>'
      +'<div class="gh-sub">'+esc(d.subEn||'')+'</div>'
      +'<div class="gh-body">'+esc(d.body||'')+'</div>';
    if(d.note) html+='<div class="gh-meta-line">'+esc(d.note)+'</div>';
    if(d.signature) html+='<div class="gh-sign">'+esc(d.signature)+'</div>';
    html+='<div class="gh-detail-close"><button data-close>收起</button></div>'
      +'</div><div class="gh-card-face back"></div>'
      +'</div></div>';
    return html;
  }
};

const defaultTheme={
  miniature(g){
    return '<div class="gh-mini-default">❀</div>';
  },
  detail(g){
    var d=g.data||{};
    var html='<div class="gh-detail-pass"><div class="body">'
      +'<div class="gh-tag">'+esc(d.tag||'宿先生的礼物')+'</div>'
      +'<div class="gh-title">'+esc(g.title||'')+'</div>';
    if(d.body) html+='<div class="gh-list"><div class="gh-item"><span></span><span>'+esc(d.body)+'</span></div></div>';
    if(d.note) html+='<div class="gh-note">'+esc(d.note)+'</div>';
    html+='<div class="gh-foot">'
      +'<span class="gh-validity">'+esc(g.createdAt||'')+'</span>'
      +'<span class="gh-stamp">'+esc(d.stamp||'已收藏')+'</span>'
      +'</div></div>'
      +'<div class="gh-detail-close"><button data-close>收起</button></div></div>';
    return html;
  }
};

const THEMES={starshard_pass:starshardPass,starshard_card:starshardCard,default:defaultTheme};

export function renderMiniature(g){
  var t=THEMES[g.theme]||THEMES.default;
  return t.miniature(g);
}

export function renderDetail(g){
  var t=THEMES[g.theme]||THEMES.default;
  return t.detail(g);
}

export function listThemes(){return Object.keys(THEMES).filter(function(k){return k!=='default';});}
