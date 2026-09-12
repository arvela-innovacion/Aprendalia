(function(global){
  'use strict';

  function breakStreak(stats){ if(stats) stats.streak=0; }

  function awardCorrect(stats, question){
    if(!stats || !question) return {points:0,label:'¡Muy bien!'};
    const isReview=(question.reviewCount||0)>0;
    const assisted=!!(question.usedHint || question.usedDontKnow);
    let points=0,label='';
    stats.correct+=1;
    if(isReview){
      points=3; stats.recovered+=1; stats.streak=0; label='¡Esta ya la has recuperado!';
    } else if((question.attempts||0)===0 && !assisted){
      points=10; stats.firstTry+=1; stats.streak+=1; stats.bestStreak=Math.max(stats.bestStreak,stats.streak);
      if(stats.streak>=3) points+=2;
      label=stats.streak>=3?`¡Genial! Racha de ${stats.streak}`:'¡Muy bien razonado!';
    } else {
      points=6; stats.secondTry+=1; stats.streak=0;
      label=assisted?'¡Bien! La ayuda te ha servido':'¡Bien recuperado!';
    }
    stats.stars+=points;
    return {points,label};
  }

  global.ScoringEngine={awardCorrect,breakStreak};
})(window);
