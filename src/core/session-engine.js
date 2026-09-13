(function(global){
  'use strict';
  function create(total=0){
    return {stars:0,correct:0,failed:0,firstTry:0,secondTry:0,recovered:0,streak:0,bestStreak:0,presented:0,totalPlanned:total,startedAt:new Date().toISOString(),outcomes:[],saved:false};
  }
  function toHistory(stats,subject,course=''){
    const total=stats.firstTry+stats.secondTry+stats.failed;
    return {id:`session_${Date.now()}`,course,subject,startedAt:stats.startedAt,endedAt:new Date().toISOString(),total,correct:stats.firstTry+stats.secondTry,firstTry:stats.firstTry,secondTry:stats.secondTry,recovered:stats.recovered,failed:stats.failed,bestStreak:stats.bestStreak,stars:stats.stars,questions:stats.outcomes};
  }
  global.SessionEngine={create,toHistory};
})(window);
