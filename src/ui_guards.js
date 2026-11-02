/* すべての画面から同じ禁止状態を使う。保存中の別操作と、古いボタンの直接呼出しも拒否する。 */
const READ_ONLY_ACTIONS=new Set([
  "worldMapSearch","worldMapFilter","worldMapReset","worldFocusSearch","worldFitRoute","worldFocusTarget","worldZoom","worldPan","searchReset","helpReset","navQuick","navReset","navFilter","navSearch","navClear","navPage","openSheet","closeSheet","returnToMap","openHelp","dlgNext","dlgBack","dlgSkip","toTitle","dexNav","partyView","shopTab","shopItem","shopQty","vaultOpen","vaultBack",
  "shareCopy","shareNative","replayStory","replay","battleProgressMove","battleLogLine","battleLogBack","battleLogPage","battleLogExpand","battleChallengeFilter","badgeFilter",
  "itemVaultOpen","itemVaultMode","itemVaultFilter","itemVaultSearch","itemVaultPage","itemVaultSelect","itemVaultQty","itemVaultEdit","itemVaultBack",
  "petShopFilter","petShopPet","petCareSection","petView","petFilter","petPage","petSupplySelect","petDetails","petWalkView","petTravelPolicy","petVaultOpen",
  "oceanOpen","oceanBack","oceanArea","oceanDexOpen","oceanDexPage","oceanDexArea",
  "jobcenterView","jobcenterSearch","jobcenterPage","jobcenterActor","characterSkills","expandedSkillSearch","expandedSkillPage","expandedSkillPick","expandedSkillTarget","expandedSkillBack",
  "helpFilter","helpSearch","helpPage","featureBack","managementShopSearch","managementShopFilter","managementShopPage","managementShopQty","managementEquipPreview","managementShopTalk","managementNpcTalk","managementGearSearch","managementGearPage","managementDisposePreview"
]);
function systemOperationPending(){return !!(G.petSaving||G.characterSaving||G.oceanSaving||G.featureSaving||G.vaultSaving||G.shopSaving||G.starting);}
function syncReadOnlyUi(){
  if(!G.readOnly)return;
  const sheet=document.querySelector('.sheet'),host=sheet||document.querySelector('.explore .xsave,.battle .cmd,.result .rfoot');
  if(!host)return;
  let note=document.getElementById('readonlyContext');
  if(!note){note=document.createElement('p');note.id='readonlyContext';note.className='readonly-note';note.textContent='閲覧専用：この画面では記録を変更できません。操作中のタブで続けてください。';if(sheet)sheet.querySelector('.sheet-head').after(note);else host.prepend(note);}
  document.querySelectorAll('#screen button[data-a]').forEach(button=>{if(READ_ONLY_ACTIONS.has(button.dataset.a))return;button.disabled=true;const ids=new Set((button.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(note.id);button.setAttribute('aria-describedby',[...ids].join(' '));});
}
for(const [name,handler] of Object.entries(ACT)){
  ACT[name]=function(...args){
    if(systemOperationPending())return;
    if(G.readOnly&&!READ_ONLY_ACTIONS.has(name))return toast("閲覧専用のタブでは変更できません。");
    return handler.apply(this,args);
  };
}
