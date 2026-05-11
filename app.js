// ═══════════════════════════════════════════════════════
// 灵界记忆库 · app.js — 公共核心模块
// Firebase初始化 / Auth登录登出 / 导航切换 / 工具函数
// ═══════════════════════════════════════════════════════

import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getFirestore,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ── Firebase 配置（固定，不要改）──
const firebaseConfig={
  apiKey:"AIzaSyCKu3KreoxJEfY9Ur9xilowhbFDtALYitE",
  authDomain:"lingjie-f84c1.firebaseapp.com",
  projectId:"lingjie-f84c1",
  storageBucket:"lingjie-f84c1.firebasestorage.app",
  messagingSenderId:"354124810253",
  appId:"1:354124810253:web:4d40c2ae4483b28bdded44"
};
const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const auth=getAuth(app);

// ── 导出给 pages 使用 ──
export{db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot};

// ── Auth 状态管理 ──
// 登录方式：邮箱固定为 qinghengmomo@gmail.com，点击登录按钮后弹出密码输入框
const authBtn=document.getElementById('auth-btn');
const authStatus=document.getElementById('auth-status');
const DEFAULT_EMAIL='qinghengmomo@gmail.com';

function updateAuthUI(user){
  if(user){
    authStatus.textContent=user.email.split('@')[0];
    authBtn.textContent='登出';
    authBtn.onclick=async()=>{
      await signOut(auth);
    };
  }else{
    authStatus.textContent='未登录';
    authBtn.textContent='登录';
    authBtn.onclick=async()=>{
      const pwd=prompt('· 灵界验证 · 请输入密码');
      if(!pwd)return;
      try{
        await signInWithEmailAndPassword(auth,DEFAULT_EMAIL,pwd);
      }catch(e){
        alert('密码错误，无法登录');
        console.error(e);
      }
    };
  }
}

onAuthStateChanged(auth,user=>{
  updateAuthUI(user);
  // 通知当前活跃页签
  if(window.__currentPageOnAuth) window.__currentPageOnAuth(user);
});

// ── 写操作前检查登录 ──
export function requireAuth(){
  if(auth.currentUser) return true;
  const toast=document.getElementById('auth-toast');
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2800);
  return false;
}

// ── 导航切换 ──
const tabs=document.querySelectorAll('.nav-tab[data-page]');
const pages=document.querySelectorAll('.page');
const pageModules={};

async function switchPage(pageId){
  // 隐藏所有页面
  pages.forEach(p=>p.classList.remove('active'));
  tabs.forEach(t=>t.classList.remove('active'));
  // 显示目标
  const target=document.getElementById('page-'+pageId);
  if(target) target.classList.add('active');
  const tab=document.querySelector(`.nav-tab[data-page="${pageId}"]`);
  if(tab) tab.classList.add('active');
  // 动态加载模块
  if(!pageModules[pageId]){
    try{
      const mod=await import(`./pages/${pageId}.js`);
      pageModules[pageId]=mod;
      if(mod.init) mod.init(target,{db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth});
    }catch(e){
      console.error(`加载页面模块 ${pageId} 失败:`,e);
    }
  }
  // 设置 onAuth 回调
  window.__currentPageOnAuth=pageModules[pageId]?.onAuthChange||null;
  // 记住当前页签
  history.replaceState(null,'','#'+pageId);
}

tabs.forEach(tab=>{
  tab.addEventListener('click',e=>{
    e.preventDefault();
    switchPage(tab.dataset.page);
  });
});

// ── 初始化：根据 hash 或默认加载 memory ──
const initPage=location.hash.slice(1)||'memory';
switchPage(initPage);

// ── 工具函数 ──
export function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function fmtDate(d){
  if(!d)return '';
  return d;
}
