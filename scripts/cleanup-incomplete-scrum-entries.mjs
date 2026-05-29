/**
 * Supabase에서 불완전한 scrum_entries 정리
 * - selected_tasks가 있지만 yesterday 또는 today가 비어있는 레코드 삭제
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const client = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

console.log('\n=== 불완전한 Scrum Entries 정리 ===\n');

// 1. 불완전한 데이터 조회
const { data: entries, error: fetchError } = await client
  .from('scrum_entries')
  .select('id, entry_date, member_id, selected_tasks, yesterday, today')
  .order('entry_date', { ascending: false });

if (fetchError) {
  console.error('조회 실패:', fetchError.message);
  process.exit(1);
}

console.log(`전체 레코드: ${entries.length}건`);

// 2. 불완전한 레코드 필터링
const incomplete = entries.filter(e => {
  const tasks = JSON.parse(e.selected_tasks || '[]');
  const hasYesterday = (e.yesterday || '').trim().length > 0;
  const hasToday = (e.today || '').trim().length > 0;
  
  // selected_tasks가 있는데 yesterday 또는 today가 비어있으면 불완전
  return tasks.length > 0 && (!hasYesterday || !hasToday);
});

console.log(`불완전한 레코드: ${incomplete.length}건\n`);

if (incomplete.length === 0) {
  console.log('✓ 정리할 데이터가 없습니다.');
  process.exit(0);
}

// 3. 불완전한 레코드 목록 출력
console.log('삭제 대상:');
incomplete.forEach(e => {
  const tasks = JSON.parse(e.selected_tasks || '[]');
  const hasY = (e.yesterday || '').trim().length > 0;
  const hasT = (e.today || '').trim().length > 0;
  console.log(
    `  - ${e.entry_date} ${e.member_id} | tasks: ${tasks.length} | ` +
    `yesterday: ${hasY ? 'O' : 'X'} | today: ${hasT ? 'O' : 'X'}`
  );
});

console.log(`\n총 ${incomplete.length}건을 삭제합니다...\n`);

// 4. 삭제 실행
const ids = incomplete.map(e => e.id);
const { error: deleteError } = await client
  .from('scrum_entries')
  .delete()
  .in('id', ids);

if (deleteError) {
  console.error('삭제 실패:', deleteError.message);
  process.exit(1);
}

console.log(`✓ ${incomplete.length}건 삭제 완료`);

// 5. scrum_task_logs도 정리 (선택된 태스크만 있고 yesterday/today 없는 레코드)
console.log('\n=== scrum_task_logs 정리 ===\n');

const { data: taskLogs, error: taskLogsError } = await client
  .from('scrum_task_logs')
  .select('id, entry_date, member_id, issue_key, yesterday, today');

if (taskLogsError) {
  if (!/does not exist|Could not find/i.test(taskLogsError.message)) {
    console.error('scrum_task_logs 조회 실패:', taskLogsError.message);
  } else {
    console.log('scrum_task_logs 테이블이 없습니다. (정상)');
  }
} else {
  const incompleteLogs = taskLogs.filter(l => {
    const hasY = (l.yesterday || '').trim().length > 0;
    const hasT = (l.today || '').trim().length > 0;
    return !hasY || !hasT;
  });

  console.log(`전체 task_logs: ${taskLogs.length}건`);
  console.log(`불완전한 task_logs: ${incompleteLogs.length}건`);

  if (incompleteLogs.length > 0) {
    const logIds = incompleteLogs.map(l => l.id);
    const { error: delLogsError } = await client
      .from('scrum_task_logs')
      .delete()
      .in('id', logIds);

    if (delLogsError) {
      console.error('task_logs 삭제 실패:', delLogsError.message);
    } else {
      console.log(`✓ ${incompleteLogs.length}건 task_logs 삭제 완료`);
    }
  } else {
    console.log('✓ 정리할 task_logs가 없습니다.');
  }
}

console.log('\n완료!\n');
