// Extract the actual app components; replace only native hosts and persistence for browser QA.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tmp', 'wrong-review');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out,'theme.js'), `import {light,dark} from '../../src/theme/colors';
import {makeStyles} from '../../src/ui/styles';
const c = new URLSearchParams(location.search).get('theme')==='dark' ? dark : light;
export const useTheme = () => ({c});
export const useStyles = () => makeStyles(c);`);
fs.writeFileSync(path.join(out,'svg.jsx'), `import React from 'react';
export const SvgXml = ({xml,width,height}) => <div style={{width,height}} dangerouslySetInnerHTML={{__html:xml}}/>;`);
const source = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const result = source.slice(source.indexOf('function mockStat('), source.indexOf('function MockScoreScreen('));
const detail = source.slice(source.indexOf('type WrongQuestionReview ='), source.indexOf('// ---- モーダル: Pro'));
const entry = `
import React, {useState, useRef, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {View,Text,ScrollView,Pressable,PanResponder} from 'react-native';
import {light,dark,CHAPTER_SHORT} from './src/theme/colors';
import {makeStyles} from './src/ui/styles';
import {PracticalQuestion} from './src/ui/PracticalQuestion';
import {assessmentSummary,sectionScores,practicePassed,questionStem} from './src/data/practical';
import questions from './content/questions/mock1.json';
const params = new URLSearchParams(location.search);
const colors = params.get('theme') === 'dark' ? dark : light;
const styles = makeStyles(colors);
const useTheme = () => ({c:colors});
const useStyles = () => styles;
const useStudyFeedback = () => {};
const QLABEL = ['1','2','3','4','5'];
const getQuestions = () => questions;
const wrongIndices = params.get('case') === 'single' ? [30] : params.get('case') === 'none' ? [] : [1,8,17,30,34];
const wrong = new Set(wrongIndices.map(i=>questions[i].id));
const getRec = id => id === questions[31].id ? undefined : ({seen:1,lastCorrect:!wrong.has(id)});
const marked = new Set();
const isBookmarked = id => marked.has(id);
const toggleBookmark = async id => { marked.has(id) ? marked.delete(id) : marked.add(id); };
const Icon = () => <Text>☆</Text>;
const Ring = ({pct,label}) => <Text>{pct}% {label}</Text>;
const PracticalAssessment = () => null;
window.reviewFixture = {wrongIndices,questions:questions.map(q=>({id:q.id,stem:questionStem(q)}))};
${result}
${detail}
function Harness(){
  const [,bump] = useState(0);
  return <View style={{flex:1,backgroundColor:colors.bg}}>{params.get('case')==='bookmark'
    ? <QuestionDetail question={questions[0]} onBack={()=>{}} onBump={()=>bump(n=>n+1)} />
    : <MockResult set={{file:'mock1',title:'第1回 模試'}} onBack={()=>{window.closedResults=true}} onBump={()=>bump(n=>n+1)} />}</View>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`;
esbuild.build({
  stdin: { contents:entry, sourcefile:'wrong-review-test.tsx', loader:'tsx', resolveDir:root },
  outfile:path.join(out,'bundle.js'), bundle:true, format:'iife', jsx:'automatic',
  alias: {
    'react-native':path.join(root,'tools/fixtures/wrong-review-native.jsx'),
    'react-native-svg':path.join(out,'svg.jsx'),
  },
  loader:{'.jpg':'dataurl'},
  plugins:[{name:'theme-host',setup(build){build.onResolve({filter:/\/theme\/ThemeContext$/},()=>({path:path.join(out,'theme.js')}));}}],
}).then(() => {
fs.writeFileSync(path.join(out,'index.html'), '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,"Yu Gothic",sans-serif}#root{height:100vh;display:flex;flex-direction:column}button{color:inherit}</style><div id="root"></div><script src="bundle.js"></script>');
console.log('Prepared actual MockResult, QuestionDetail and PracticalQuestion browser harness: tmp/wrong-review/index.html');
}).catch(error => {console.error(error);process.exitCode=1;});
