// 클럽앱 미리보기 체험 — 선택지 목록(정본). 기능 이름은 docs/club-feature-switch-inventory.md 의 실제 기능에 맞춘다.
// 서버(supabase/functions/club-preview)와 마이그 CHECK 가 같은 값 집합을 쓴다 — src/testing/clubPreview.test.ts 가 셋을 맞춰 본다.

// 항상 포함(체크 해제 불가, 안내만)
export const BASE_FEATURES = [
  ['home', '홈', '다가오는 일정과 내 참여 현황'],
  ['schedule', '일정·참가 신청', '달력에서 일정을 보고 참석·취소'],
  ['notice', '공지', '운영진이 올리는 공지 게시판'],
  ['notifications', '알림', '일정·공지·승인 알림'],
  ['admin_chat', '관리자 문의 채팅', '회원·게스트가 운영진에게 1:1 문의'],
];

// 선택 기능 — [키, 이름, 설명, 인벤토리 번호]
export const FEATURES = [
  ['waitlist', '정원·대기자 명단', '정원이 차면 대기 순서대로 자동 승급', 'C-15'],
  ['recurring', '반복 일정', '매주 같은 시간 일정을 한 번에 등록', 'C-2'],
  ['matchup', '대진표 자동 생성·점수 기록', '참석자로 복식 대진을 만들고 점수 입력', 'M-1'],
  ['dupr', 'DUPR 레이팅 연동·DUPR 매치', '회원 레이팅 표시, 레이팅 조건이 있는 일정', 'C-4'],
  ['photos', '사진첩·동영상', '모임 사진과 영상을 앨범으로', 'P-1'],
  ['board_comments', '게시판 댓글(회원 참여)', '공지·게시글에 회원이 댓글과 답글', 'B-3'],
  ['join_review', '가입 승인·가입 질문', '가입 때 클럽 질문을 받고 운영진이 승인', 'R-6'],
  ['membership', '멤버십·이용권 차감', '등급별 이용권, 참석하면 1회 차감', 'U-5'],
  ['guest_events', '게스트 공개 일정·참가 승인', '게스트에게 열 일정, 게스트 정원과 승인제', 'C-7'],
  ['lesson_court', '레슨코트', '참석 신청 없이 운영진이 참여자를 지정', 'C-3'],
  ['attendance', '출석부', '회원별 참석 달력(운영진)', 'C-21'],
  ['group_chat', '단체 채팅방', '운영진이 만드는 단체방', 'T-2'],
  ['links', '링크 모음', '예약 사이트·오픈채팅 바로가기', 'H-3'],
  ['english', '영어 지원', '앱 화면과 일정 제목 영어 표시', 'R-5'],
];

// 운영 방식 — [키, 이름, 설명, 추천 기능]
export const THEMES = [
  ['rental', '대관', '코트를 시간대별로 열고 이용권으로 운영', ['recurring', 'membership']],
  ['member', '회원 위주 운영', '정해진 회원끼리 정기 모임', ['join_review', 'waitlist', 'matchup', 'attendance', 'board_comments']],
  ['guest', '게스트 운영', '게스트에게 일정을 열고 신청을 받음', ['guest_events', 'dupr']],
  ['academy', '아카데미', '코치가 레슨반을 운영', ['lesson_court', 'recurring', 'membership', 'attendance']],
];

// 디자인 — 실제 앱 프리셋(src/design/presets.ts). [키, 프리셋, 이름, 설명]
export const PRESETS = [
  ['card', '1pickle', '카드형', '흐린 사진 배경 위 카드, 큰 숫자'],
  ['ops', '2pickle', '운영형', '썸네일이 붙은 촘촘한 목록'],
  ['warm', '3pickle', '커뮤니티형', '앨범과 사진이 먼저'],
  ['quiet', '5pickle', '미니멀', '흑백 사진, 가는 숫자, 구분선'],
];

export const ANSWERS = {
  size: [['s30', '30명 이하'], ['s100', '30~100명'], ['s300', '100~300명'], ['s300p', '300명 이상']],
  weekly: [['w2', '1~2개'], ['w5', '3~5개'], ['w6p', '6개 이상']],
  tools: [['kakao', '카톡 오픈채팅'], ['band', '밴드'], ['cafe', '네이버 카페'], ['sheet', '엑셀·구글시트'], ['etc', '기타']],
};

export const LIMITS = { nameMax: 30, painMax: 300, codeMin: 12, codeMax: 32 };
