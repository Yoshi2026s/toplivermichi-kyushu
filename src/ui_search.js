/* 一覧検索の入力・解除・フォーカスを揃える。保存データは変更しない。 */
const LIST_SEARCH={
 shop:{sheets:['shop'],input:'managementShopSearch',action:'managementShopSearch',label:'品物を検索',placeholder:'名前・効果',max:80},
 vault:{sheets:['itemVault'],input:'itemVaultSearch',action:'itemVaultSearch',label:'金庫の品物を検索',placeholder:'名前で検索',max:60},
 job:{sheets:['jobcenter','jobCenter'],input:'jobcenterSearch',action:'jobcenterSearch',label:'職業を検索',placeholder:'職業・役割',max:40},
 gear:{sheets:['gearManage'],input:'managementGearSearch',action:'managementGearSearch',label:'装備を検索',placeholder:'装備名',max:80}
};
function listSearchBlocked(kind){return typeof systemOperationPending==='function'&&systemOperationPending()||kind==='vault'&&typeof canViewItemVault==='function'&&!canViewItemVault();}
function listSearchForm(kind){const c=LIST_SEARCH[kind],disabled=listSearchBlocked(kind)?'disabled':'';return `<form class="compact-search" data-list-search="${kind}"><label class="sr-only" for="${c.input}">${c.label}</label><input id="${c.input}" class="input" type="search" enterkeyhint="search" autocomplete="off" maxlength="${c.max}" placeholder="${c.placeholder}" value="${esc(G.sheetData.query||'')}" ${disabled}><button type="submit" class="btn" ${disabled}>検索</button><button type="button" class="btn" data-a="searchReset" data-v="${kind}" ${disabled}>解除</button></form>`;}
function listSearchContext(kind,el){return Object.hasOwn(LIST_SEARCH,kind)&&!!G.st&&LIST_SEARCH[kind].sheets.includes(G.sheet)&&!G.dlg&&!listSearchBlocked(kind)&&currentActionButton(el);}
function listSearchFocus(kind){document.querySelector('#'+LIST_SEARCH[kind].input)?.focus?.({preventScroll:true});}
function listSearchDraft(kind){const c=LIST_SEARCH[kind],input=document.querySelector('#'+c.input);if(!input)return false;const query=input.value.slice(0,c.max),changed=query!==(G.sheetData.query||'');G.sheetData.query=query;if(changed)G.sheetData.page=0;return changed;}
for(const [kind,c]of Object.entries(LIST_SEARCH)){const base=ACT[c.action];ACT[c.action]=function(el){if(!listSearchContext(kind,el))return;G.cursorSig=null;const result=base(el);listSearchFocus(kind);return result;};}
ACTION_SCREEN_BUTTONS.add('searchReset');
ACT.searchReset=function(el){const kind=el.dataset.v;if(!listSearchContext(kind,el))return;const c=LIST_SEARCH[kind],input=document.querySelector('#'+c.input);if(input)input.value='';G.sheetData.query='';G.sheetData.page=0;G.sheetData.filter='all';return ACT[c.action]();};
document.addEventListener('submit',e=>{const kind=e.target?.dataset?.listSearch;if(!Object.hasOwn(LIST_SEARCH,kind)||!listSearchContext(kind))return;e.preventDefault();ACT[LIST_SEARCH[kind].action]();});
for(const name of ['managementShopFilter','shopTab','shopItem']){const base=ACT[name];ACTION_SCREEN_BUTTONS.add(name);ACT[name]=function(el){if(!listSearchContext('shop',el))return;listSearchDraft('shop');const result=base(el);if(name==='managementShopFilter')document.querySelector('.shop-categories>summary')?.focus?.({preventScroll:true});return result;};}
for(const name of ['itemVaultFilter','itemVaultMode','itemVaultSelect']){const base=ACT[name];ACTION_SCREEN_BUTTONS.add(name);ACT[name]=function(el){if(!listSearchContext('vault',el))return;listSearchDraft('vault');const query=G.sheetData.query,result=base(el);if(G.sheet==='itemVault'&&G.sheetData.query!==query){G.sheetData.query=query;render();}return result;};}
function installListPaging(kind,name){const base=ACT[name];ACTION_SCREEN_BUTTONS.add(name);ACT[name]=function(el){if(!listSearchContext(kind,el))return;const forward=Number(el.dataset.v)>(G.sheetData.page||0),changed=listSearchDraft(kind);G.cursorSig=null;const result=changed?ACT[LIST_SEARCH[kind].action]():base(el);focusPagingControl(`[data-a="${name}"]`,G.sheetData.page||0,forward);return result;};}
installListPaging('vault','itemVaultPage');
installListPaging('job','jobcenterPage');
const listSearchJobView=ACT.jobcenterView;
ACT.jobcenterView=function(el){if(!listSearchContext('job',el)||!['events','change'].includes(el.dataset.v))return;listSearchDraft('job');const {query,cid}=G.sheetData,result=listSearchJobView(el);G.sheetData.query=query;G.sheetData.cid=cid;render();return result;};
ACTION_SCREEN_BUTTONS.add('jobcenterView');
installListPaging('gear','managementGearPage');
installListPaging('shop','managementShopPage');
