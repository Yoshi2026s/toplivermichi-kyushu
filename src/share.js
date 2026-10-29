/* URLだけを共有する。セーブ・入力名・クエリは渡さない。 */
const SHARE = (()=>{
  const PUBLIC_URL="https://yoshi2026s.github.io/toplivermichi-kyushu/";
  const INTRO="スマホで遊べる昭和風ドットRPG『ポコチャクエスト』";
  function clean(value){
    try{ const u=new URL(value); if(!["https:","http:"].includes(u.protocol)) return null;
      u.search=""; u.hash=""; u.username=""; u.password=""; return u.href;
    }catch(e){ return null; }
  }
  function url(){
    return clean(window.TLR_SHARE_URL)||
      (window.TLR_PUBLIC?clean(window.location.href):null)||PUBLIC_URL;
  }
  function links(){ const u=url(); return {
    line:`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(u)}&text=${encodeURIComponent(INTRO)}`,
    x:`https://twitter.com/intent/tweet?text=${encodeURIComponent(INTRO)}&url=${encodeURIComponent(u)}`
  }; }
  async function copy(withIntro=false){
    const value=(withIntro?INTRO+"\n":"")+url();
    try{ if(!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value); toast("コピーしました。");
    }catch(e){ const input=document.getElementById("shareUrl");
      if(input){ input.value=value; input.focus(); input.select(); input.setSelectionRange?.(0,value.length); }
      toast("欄を長押ししてコピーしてください。");
    }
  }
  async function native(){
    if(typeof navigator.share!=="function") return;
    try{ await navigator.share({title:"ポコチャクエスト",text:INTRO,url:url()}); }
    catch(e){ if(e?.name!=="AbortError") toast("共有できませんでした。URLをコピーできます。"); }
  }
  return {url,links,copy,native};
})();
