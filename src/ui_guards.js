/* すべての画面から同じ禁止状態を使う。保存中の別操作と、古いボタンの直接呼出しも拒否する。 */
const READ_ONLY_ACTIONS=new Set([
  "searchReset","helpReset","navReset","navFilter","navSearch","navClear","navPage","openSheet","closeSheet","returnToMap","openHelp","dlgNext","dlgBack","dlgSkip","toTitle","dexNav","partyView","shopTab","shopItem","shopQty","vaultOpen","vaultBack",
  "shareCopy","shareNative","replayStory","replay","battleLogLine","battleLogBack","battleLogPage","battleLogExpand","battleChallengeFilter","badgeFilter",
  "itemVaultOpen","itemVaultMode","itemVaultFilter","itemVaultSearch","itemVaultPage","itemVaultSelect","itemVaultQty","itemVaultEdit","itemVaultBack",
  "petView","petFilter","petPage","petSupplySelect","petDetails","petWalkView","petTravelPolicy","petVaultOpen",
  "oceanOpen","oceanBack","oceanArea","oceanDexOpen","oceanDexPage","oceanDexArea",
  "jobcenterView","jobcenterSearch","jobcenterPage","jobcenterActor","characterSkills","expandedSkillSearch","expandedSkillPage","expandedSkillPick","expandedSkillTarget","expandedSkillBack",
  "helpFilter","helpSearch","helpPage","featureBack","managementShopSearch","managementShopFilter","managementShopPage","managementShopQty","managementEquipPreview","managementShopTalk","managementNpcTalk","managementGearSearch","managementGearPage","managementDisposePreview"
]);
function systemOperationPending(){return !!(G.petSaving||G.characterSaving||G.oceanSaving||G.featureSaving||G.vaultSaving||G.shopSaving||G.starting);}
for(const [name,handler] of Object.entries(ACT)){
  ACT[name]=function(...args){
    if(systemOperationPending())return;
    if(G.readOnly&&!READ_ONLY_ACTIONS.has(name))return toast("閲覧専用のタブでは変更できません。");
    return handler.apply(this,args);
  };
}
