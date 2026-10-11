/* Classical arithmetic described in sourced Al-Biruni / Kaplan material.
 * NOT a gold price predictor; these values NEVER enter the EA direction score.
 */
(function(root){
 'use strict';
 const norm=x=>((x%360)+360)%360;
 const ensure=x=>{if(!Number.isFinite(x))throw Error('Nilai tidak valid');return x;};
 // Al-Tafhim, planetary hours: order is cyclical, NOT equal fixed clock hours.
 const HOUR_ORDER=Object.freeze(['Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars']);
 const DAY_LORD=Object.freeze(['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']);
 function planetaryHourRuler(weekday,ordinal){
  if(!Number.isInteger(weekday)||weekday<0||weekday>6||!Number.isInteger(ordinal)||ordinal<1||ordinal>24)
   throw Error('Hari 0..6 dan ordinal jam 1..24 wajib valid');
  return HOUR_ORDER[(HOUR_ORDER.indexOf(DAY_LORD[weekday])+ordinal-1)%7];
 }
 // Al-Tafhim §475: daytime example; ascendant + Moon - Sun.
 function partOfFortuneDay(sun,moon,ascendant){return norm(ensure(ascendant)+ensure(moon)-ensure(sun));}
 // Al-Biruni's India: equal division of 360 degrees into 27 sectors.
 // Caller MUST supply a sidereal longitude with its reference/ayanamsa.
 function lunarStation27(siderealLongitude){
  const longitude=norm(ensure(siderealLongitude)),width=360/27,number=Math.floor(longitude/width)+1;
  return {number,segmentWidthDeg:width,withinDeg:longitude-(number-1)*width};
 }
 // Kaplan commentary example, GEMATRIA: not an astrological ephemeris.
 function gematriaExample(){const sum=248+505;return {sum,zodiacRemainder:sum%12,planetRemainder:sum%7};}
 function doors22(){return 22*21/2;}
 const API=Object.freeze({HOUR_ORDER,DAY_LORD,planetaryHourRuler,partOfFortuneDay,lunarStation27,gematriaExample,doors22});
 root.CebonkAlBiruniClassical=API;
 if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
