import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getFirestore,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import{getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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

export{db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot};
const authBtn=document.getElementById('auth-btn');
const authStatus=document.getElementById('auth-status');
const DEFAULT_EMAIL='qinghengmomo@gmail.com';

const loginModal=document.getElementById('login-modal');
const loginPwd=document.getElementById('login-pwd');
const loginError=document.getElementById('login-error');
const loginSubmit=document.getElementById('login-submit');
const loginCancel=document.getElementById('login-cancel');
const loginClose=document.getElementById('login-modal-close');

function openLoginModal(){
  loginPwd.value='';
  loginError.textContent='';
  loginSubmit.disabled=false;
  loginModal.style.display='flex';
  requestAnimationFrame(()=>loginModal.classList.add('open'));
  setTimeout(()=>loginPwd.focus(),100);
}

function closeLoginModal(){
  loginModal.classList.remove('open');
  setTimeout(()=>{loginModal.style.display='none';},300);
}

async function doLogin(){
  const pwd=loginPwd.value.trim();
  if(!pwd){loginError.textContent='请输入密码';return;}
  loginSubmit.disabled=true;
  loginError.textContent='';
  try{
    await signInWithEmailAndPassword(auth,DEFAULT_EMAIL,pwd);
    closeLoginModal();
  }catch(e){
    loginError.textContent='密码错误，无法连接';
    loginSubmit.disabled=false;
    loginPwd.focus();
  }
}

loginSubmit.addEventListener('click',doLogin);
loginPwd.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
loginCancel.addEventListener('click',closeLoginModal);
loginClose.addEventListener('click',closeLoginModal);
loginModal.addEventListener('click',e=>{if(e.target===loginModal)closeLoginModal();});
function updateAuthUI(user){
  if(user){
    authStatus.textContent=user.email.split('@')[0];
    authBtn.textContent='登出';
    authBtn.onclick=async()=>{await signOut(auth);};
  }else{
    authStatus.textContent='未登录';
    authBtn.textContent='登录';
    authBtn.onclick=()=>openLoginModal();
  }
}

onAuthStateChanged(auth,user=>{
  updateAuthUI(user);
  if(window.__currentPageOnAuth) window.__currentPageOnAuth(user);
});

export function requireAuth(){
  if(auth.currentUser) return true;
  const toast=document.getElementById('auth-toast');
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2800);
  return false;
}

const tabs=document.querySelectorAll('.nav-tab[data-page]');
const pages=document.querySelectorAll('.page');
const pageModules={};

async function switchPage(pageId){
  pages.forEach(p=>p.classList.remove('active'));
  tabs.forEach(t=>t.classList.remove('active'));
  const target=document.getElementById('page-'+pageId);
  if(target) target.classList.add('active');
  const tab=document.querySelector('.nav-tab[data-page="' + pageId + '"]');
  if(tab) tab.classList.add('active');
  if(!pageModules[pageId]){
    try{
      const mod=await import('./pages/'+pageId+'.js');
      pageModules[pageId]=mod;
      if(mod.init) mod.init(target,{db,auth,collection,addDoc,updateDoc,deleteDoc,doc,onSnapshot,requireAuth});
    }catch(e){
      console.error('Load page module '+pageId+' failed:',e);
    }
  }
  window.__currentPageOnAuth=pageModules[pageId]?.onAuthChange||null;
  history.replaceState(null,'','#'+pageId);
}

tabs.forEach(tab=>{
  tab.addEventListener('click',e=>{
    e.preventDefault();
    switchPage(tab.dataset.page);
  });
});

const initPage=location.hash.slice(1)||'memory';
switchPage(initPage);

export function esc(t){return(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function fmtDate(d){if(!d)return '';return d;}