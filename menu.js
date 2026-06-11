(function(){
  var btn=document.getElementById('menu-toggle');
  var drw=document.getElementById('mobile-drawer');
  var bd=document.getElementById('drawer-backdrop');
  if(!btn||!drw||!bd)return;
  function toggle(open){
    var willOpen=(typeof open==='boolean')?open:!drw.classList.contains('open');
    drw.classList.toggle('open',willOpen);
    bd.classList.toggle('open',willOpen);
    btn.classList.toggle('open',willOpen);
    btn.setAttribute('aria-expanded',willOpen);
  }
  btn.addEventListener('click',function(){toggle();});
  bd.addEventListener('click',function(){toggle(false);});
  drw.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){toggle(false);});});
  /* R28 P2 (조니 2심, 2026-06-11) — 드로어 본체 탭(링크 외 영역) + ESC 로도 닫기.
     종전: backdrop 탭·링크 탭만 닫힘 — 드로어 안 빈 영역 탭/ESC 무반응.
     ESC 닫힘 시 포커스는 토글 버튼으로 복귀(키보드 동선 유지). */
  drw.addEventListener('click',function(e){
    if(!e.target.closest('a'))toggle(false);
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&drw.classList.contains('open')){toggle(false);btn.focus();}
  });
})();
