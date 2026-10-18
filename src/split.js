// 문장 분리만 눈으로 확인하는 도구: pnpm split samples/diary-01.txt
import fs from 'node:fs';
import { splitKoreanDiary } from './sentences.js';

const file = process.argv[2];
if (!file) {
  console.error('사용법: pnpm split <일기파일>');
  process.exit(1);
}

const { sentences } = splitKoreanDiary(fs.readFileSync(file, 'utf8'));
for (const s of sentences) {
  console.log(`[p${s.p} #${s.id}] ${s.ko}`);
}
console.log(`\n문단 ${new Set(sentences.map((s) => s.p)).size}개, 문장 ${sentences.length}개`);
