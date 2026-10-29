/* 全国編の地理台帳。ゲームに未実装の拠点・経路・物語を推測で生成しない。 */
const NATIONAL_REGIONS = [
  ["RG01","北海道"], ["RG02","東北"], ["RG03","関東"], ["RG04","中部"],
  ["RG05","近畿"], ["RG06","中国"], ["RG07","四国"], ["RG08","九州・沖縄"]
];
const NATIONAL_PREFECTURES = [
  ["JP01","北海道","RG01"],
  ["JP02","青森県","RG02"], ["JP03","岩手県","RG02"], ["JP04","宮城県","RG02"], ["JP05","秋田県","RG02"], ["JP06","山形県","RG02"], ["JP07","福島県","RG02"],
  ["JP08","茨城県","RG03"], ["JP09","栃木県","RG03"], ["JP10","群馬県","RG03"], ["JP11","埼玉県","RG03"], ["JP12","千葉県","RG03"], ["JP13","東京都","RG03"], ["JP14","神奈川県","RG03"],
  ["JP15","新潟県","RG04"], ["JP16","富山県","RG04"], ["JP17","石川県","RG04"], ["JP18","福井県","RG04"], ["JP19","山梨県","RG04"], ["JP20","長野県","RG04"], ["JP21","岐阜県","RG04"], ["JP22","静岡県","RG04"], ["JP23","愛知県","RG04"],
  ["JP24","三重県","RG05"], ["JP25","滋賀県","RG05"], ["JP26","京都府","RG05"], ["JP27","大阪府","RG05"], ["JP28","兵庫県","RG05"], ["JP29","奈良県","RG05"], ["JP30","和歌山県","RG05"],
  ["JP31","鳥取県","RG06"], ["JP32","島根県","RG06"], ["JP33","岡山県","RG06"], ["JP34","広島県","RG06"], ["JP35","山口県","RG06"],
  ["JP36","徳島県","RG07"], ["JP37","香川県","RG07"], ["JP38","愛媛県","RG07"], ["JP39","高知県","RG07"],
  ["JP40","福岡県","RG08"], ["JP41","佐賀県","RG08"], ["JP42","長崎県","RG08"], ["JP43","熊本県","RG08"], ["JP44","大分県","RG08"], ["JP45","宮崎県","RG08"], ["JP46","鹿児島県","RG08"], ["JP47","沖縄県","RG08"]
].map(([id,name,regionId])=>({id,name,regionId}));
/* 実際に遊べる拠点だけを列挙。未収録の県には移動先を作らない。 */
const NATIONAL_IMPLEMENTED_HUBS = {JP40:["KY01","KY02"],JP41:["KY03","KY04"],JP42:["KY05","KY06"],JP43:["KY07","KY08"]};
/* 経路は実装状態と解放条件を分ける。planned は地図の移動先にしない。 */
const NATIONAL_ROUTES = [
  {id:"RT-KY01-KY02",from:"KY01",to:"KY02",mode:"road",status:"playable",unlock:"always",firstArrival:"福岡市の東門",firstGateId:"gate1"},
  {id:"RT-KY02-KY03",from:"KY02",to:"KY03",mode:"road",status:"playable",unlock:"fukuokaClear",firstArrival:"北九州の東門",firstGateId:"gate_saga"},
  {id:"RT-KY03-KY04",from:"KY03",to:"KY04",mode:"road",status:"playable",unlock:"karatsuClear",firstArrival:"唐津の東門",firstGateId:"gate_sagacity"},
  {id:"RT-KY04-KY05",from:"KY04",to:"KY05",mode:"road",status:"playable",unlock:"sagaCityClear",firstArrival:"佐賀市の東門",firstGateId:"gate_sasebo"},
  {id:"RT-KY05-KY06",from:"KY05",to:"KY06",mode:"road",status:"playable",unlock:"saseboClear",firstArrival:"佐世保市の東門",firstGateId:"gate_nagasaki"},
  {id:"RT-KY06-KY07",from:"KY06",to:"KY07",mode:"road",status:"playable",unlock:"nagasakiClear",firstArrival:"長崎市の東門",firstGateId:"gate_kumamoto"},
  {id:"RT-KY07-KY08",from:"KY07",to:"KY08",mode:"road",status:"playable",unlock:"kumamotoClear",firstArrival:"熊本市の東門",firstGateId:"gate_aso"}
];
