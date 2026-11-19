import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindFeedbackThanks} from '../js/feedback-thanks.js';
test('success dialog opens once, dismisses and restores focus',()=>{
 const events={},buttons={},dialog={open:false,querySelector(s){return{addEventListener(_,fn){buttons[s]=fn}}},addEventListener(n,fn){events[n]=fn},showModal(){this.open=true},close(){this.open=false;events.close()}};
 let focused=0;const trigger={isConnected:true,focus(){focused++}};
 const show=bindFeedbackThanks(dialog);show(trigger);show(trigger);
 assert.equal(dialog.open,true);buttons['.feedback-thanks-done']();assert.equal(dialog.open,false);assert.equal(focused,1);
 show(trigger);buttons['.feedback-thanks-close']();assert.equal(focused,2);
});
test('thank you appears only after backend confirms a feedback case',async()=>{
 const js=await readFile(new URL('../js/feedback-page.js',import.meta.url),'utf8');
 assert.ok(js.indexOf("!result?.case_id")<js.indexOf("showThanks(button);"));
 assert.ok(js.indexOf("if(error)throw error;")<js.indexOf("showThanks(button);"));
 assert.ok(js.indexOf("showThanks(button);")<js.lastIndexOf("}catch(error)"));
 const html=await readFile(new URL('../feedback.html',import.meta.url),'utf8');
 assert.ok(html.includes('You made our day!'));assert.ok(html.includes("You're Welcome!"));
});
