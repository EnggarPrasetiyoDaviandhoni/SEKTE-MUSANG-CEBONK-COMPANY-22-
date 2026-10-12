/* AL-BIRUNI §527 time-quality screening for *research*, never a historical BUY/SELL rule.
 * Based on the author's guidance to favor support to Ascendant, Moon and their
 * rulers, avoiding malefic rays. Specific thresholds below are an original
 * conservative implementation hypothesis and MUST be tested on XAUUSD.
 */
(function(root){
'use strict';
const STATUS=Object.freeze({FAVORABLE:'MENGUNTUNGKAN',HARMFUL:'MERUGIKAN',MIXED:'CAMPURAN'});
const CRITICAL=new Set(['Ascendant','Bulan','Penguasa Ascendant','Penguasa tanda Bulan','Matahari (asosiasi emas §410)']);
function judge(chart){
 if(!chart||!Array.isArray(chart.contacts)||!chart.ascendantRuler||
    !Number.isFinite(chart.ascendant)||!Number.isFinite(chart.sunAltitudeDegrees))
  return Object.freeze({status:STATUS.MIXED,eligible:false,reason:'DATA_KLASIK_TIDAK_LENGKAP',
   benefic:0,malefic:0,model:'ELECTION_SCREEN_RESEARCH_V1'});
 const important=chart.contacts.filter(x=>CRITICAL.has(x.target));
 const malefic=important.filter(x=>x.role==='MALEFIC').length;
 const benefic=important.filter(x=>x.role==='BENEFIC').length;
 const beneficCore=important.some(x=>x.role==='BENEFIC'&&
   (x.target==='Ascendant'||x.target==='Bulan'));
 const moonRulerAspect=chart.ascendantRuler==='Moon'||chart.moonAscRuler!==null;
 let status=STATUS.MIXED,reason='DUKUNGAN_BELUM_CUKUP';
 if(chart.twilightUncertain){reason='BATAS_SIANG_MALAM_TIDAK_PASTI';}
 else if(malefic>0&&benefic===0){status=STATUS.HARMFUL;reason='KONTAK_MALEFIC_PADA_PENANDA_PENTING';}
 else if(malefic>0){reason='BENEFIC_MALEFIC_BERCAMPUR';}
 else if(beneficCore&&moonRulerAspect){status=STATUS.FAVORABLE;reason='BENEFIC_MENDUKUNG_ASC_BULAN_DAN_HUBUNGAN_PENGUASA';}
 return Object.freeze({status,eligible:status===STATUS.FAVORABLE,reason,benefic,malefic,
  moonRulerAspect,beneficCore,model:'ELECTION_SCREEN_RESEARCH_V1',marketValidated:false,
  note:'Klasifikasi menguntungkan/merugikan adalah heuristik konservatif dari prinsip §527; bukan rumus arah BUY/SELL, probabilitas profit, atau jaminan entry.'});
}
const API=Object.freeze({STATUS,judge});
root.CebonkAlBiruniElectionGate=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
