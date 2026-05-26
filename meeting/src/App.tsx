import { useState, useEffect } from "react";

/* ──────────────────────────────────────────
   인라인 편집 필드 (노란색 하이라이트)
─────────────────────────────────────────── */
function E({
  value,
  onChange,
  w = "auto",
}: {
  value: string;
  onChange: (v: string) => void;
  w?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? value)}
      title="클릭하여 수정"
      style={{ minWidth: w }}
      className="inline-block align-baseline px-1 rounded cursor-text font-bold
                 text-amber-800 bg-yellow-100 border border-yellow-300
                 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400
                 transition-colors"
    >
      {value}
    </span>
  );
}

/* ──────────────────────────────────────────
   추가 검토사항 접기/펼치기
─────────────────────────────────────────── */
function Notes({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-blue-600 hover:text-blue-800 underline no-print"
      >
        {open ? "▲ 접기" : "▼ 검토사항 보기"}
      </button>
      {open && (
        <div className="mt-1 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap bg-blue-50 p-2 rounded border border-blue-100">
          {text}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────
   메인 컴포넌트
─────────────────────────────────────────── */
export default function App() {
  const [month, setMonth] = useState("9");
  const [meetingDate, setMeetingDate] = useState("2024년 9월");
  const [endTime, setEndTime] = useState("11");
  const [videoTitle, setVideoTitle] = useState(
    "물류산업종사자만 78만명, 로봇은 정말 인간의 일자리를 뺏어갈까?"
  );
  const [videoSelector, setVideoSelector] = useState("인사총무팀");

  const [yeongUp, setYeongUp] = useState({
    from: "9:15", to: "9:30",
    presenter: "최배성본부장", team: "영업지원팀",
    topic: "3PL 표준요율 단가정립을 통한 견적업무 합리화",
  });
  const [gyeongIn1, setGyeongIn1] = useState({
    from: "9:30", to: "9:45",
    presenter: "마영기상무", team: "유통사업3팀",
    topic: "입고 명세서 통일화 테스트 상황 및 향후 과제",
  });
  const [gyeongIn2, setGyeongIn2] = useState({
    from: "9:45", to: "10:00",
    presenter: "안영준본부장", team: "경인사업2팀",
    topic: "AI 활용사례 : 전표처리 자동화",
  });
  const [yeongNam, setYeongNam] = useState({
    from: "10:00", to: "10:15",
    presenter: "김태성본부장", team: "영남사업1팀",
    topic: "3PL 크레이트 세척 개선방안 검토",
  });
  const [jungNam, setJungNam] = useState({
    from: "10:15", to: "10:30",
    presenter: "하선호본부장", team: "중남사업1팀",
    topic: "유음료 배송노선 조정 검토",
  });
  const [jegwa, setJegwa] = useState({
    from: "10:30", to: "10:40",
    presenter: "표정우본부장", team: "제과사업2팀",
    topic: "자동화설비 도입을 통한 원가절감 방안",
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "print-style";
    style.textContent = `
      @media print {
        .no-print { display: none !important; }
        header { background: #312e81 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .bg-indigo-50 { background: #eef2ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        span[contenteditable] { border: none !important; background: #fef9c3 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-size: 10px; }
        tr { page-break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("print-style")?.remove(); };
  }, []);

  type RowItem = {
    from: string;
    to: string;
    label: string;
    presenter: string;
    script: React.ReactNode;
    notes: string;
    bg?: string;
  };

  const rows: RowItem[] = [
    {
      from: "9:00", to: "9:08",
      label: "동영상 시청",
      presenter: "사회자",
      bg: "bg-indigo-50",
      script: (
        <div className="space-y-2">
          <p>
            ○ <E value={month} onChange={setMonth} w="28px" />월
            업무혁신회의를 시작하겠습니다.{" "}
            <span className="text-gray-400 italic text-xs">[상호 인사]</span>
          </p>
          <p className="text-gray-600 text-xs">
            (시간표) 금일 회의는 동영상 시청 및 각 본부별 업무개선사항 발표 후{" "}
            <E value={endTime} onChange={setEndTime} w="24px" />시에 종료하도록
            하겠습니다.
          </p>
          <p>
            ○ 다음으로 동영상 시청이 있겠습니다. 금일 동영상은 「
            <E value={videoTitle} onChange={setVideoTitle} w="220px" />」입니다.
          </p>
          <p className="text-gray-600 text-xs">
            : 이번 동영상은{" "}
            <E value={videoSelector} onChange={setVideoSelector} w="80px" />
            에서 선정한 동영상입니다.
          </p>
        </div>
      ),
      notes:
        "○ 결론을 낸다.\n○ 내용이 길고 복잡할 경우, 발표한 내용을 반복해서 요약 정리해준다.\n○ 각 부서별 의견을 묻는다.\n○ 팀별 질문에 대한 대답 요청",
    },
    {
      from: "9:08", to: "9:15",
      label: "경영기획팀",
      presenter: "경영기획팀",
      script: (
        <p>
          ○ 경영기획팀에서{" "}
          <E value={month} onChange={setMonth} w="28px" />월
          경영전략회의 지시사항 팔로우업 해주시기 바랍니다.
        </p>
      ),
      notes: "",
    },
    {
      from: yeongUp.from, to: yeongUp.to,
      label: "영업본부",
      presenter: `${yeongUp.presenter} / ${yeongUp.team}`,
      script: (
        <div className="space-y-1">
          <p>
            ○{" "}
            <E value={yeongUp.presenter}
              onChange={(v) => setYeongUp((p) => ({ ...p, presenter: v }))}
              w="90px" />{" "}
            영업본부 주요 개선사항 발표해 주시기 바랍니다.
          </p>
          <p className="text-xs text-blue-700 pl-3">
            →{" "}
            <E value={yeongUp.topic}
              onChange={(v) => setYeongUp((p) => ({ ...p, topic: v }))}
              w="220px" />
          </p>
        </div>
      ),
      notes:
        "○ 당사 일마감 프로젝트 수행 시 매출정산 유형이 30가지, 세분화하면 80가지 이상이어서 어려움이 있음. 전사 투명하고 표준화된 관리를 위한 PI 시도로 판단됨.\n○ 현재 많은 회사들이 영업효율화 및 전략수립을 위해 견적자동화 솔루션을 도입하고 있음(부릉-한국야쿠르트 등). 데이터기반 견적생성, 견적템플릿 관리, 실시간 단가 업데이트, 승인워크플로우 자동화 등.",
    },
    {
      from: gyeongIn1.from, to: gyeongIn1.to,
      label: "경인사업1본부",
      presenter: `${gyeongIn1.presenter} / ${gyeongIn1.team}`,
      script: (
        <div className="space-y-1">
          <p>
            ○ 이어서{" "}
            <E value={gyeongIn1.presenter}
              onChange={(v) => setGyeongIn1((p) => ({ ...p, presenter: v }))}
              w="90px" />{" "}
            경인사업1본부 발표해 주시기 바랍니다.
          </p>
          <p className="text-xs text-blue-700 pl-3">
            →{" "}
            <E value={gyeongIn1.topic}
              onChange={(v) => setGyeongIn1((p) => ({ ...p, topic: v }))}
              w="220px" />
          </p>
        </div>
      ),
      notes:
        "○ 사내 AI 교육 6/12일, 사내 지식경영을 통해 교육 게시물 업데이트 중.\n○ 7/22 영업본부 워크샵 시 영업부문 경진대회, 올해 하반기 전사 경진대회 검토.\n→ 사내 AI 활용 수준이 높고 상당히 고무적임.\n○ 회사 볼륨이 커질수록 IT 요구사항 증가. AI를 통해 충분히 사용성을 검토 후 개발요청 시 업무효율 증가 예상.",
    },
    {
      from: gyeongIn2.from, to: gyeongIn2.to,
      label: "경인사업2본부",
      presenter: `${gyeongIn2.presenter} / ${gyeongIn2.team}`,
      script: (
        <div className="space-y-1">
          <p>
            ○{" "}
            <E value={gyeongIn2.presenter}
              onChange={(v) => setGyeongIn2((p) => ({ ...p, presenter: v }))}
              w="90px" />{" "}
            경인사업2본부 발표해 주시기 바랍니다.
          </p>
          <p className="text-xs text-blue-700 pl-3">
            →{" "}
            <E value={gyeongIn2.topic}
              onChange={(v) => setGyeongIn2((p) => ({ ...p, topic: v }))}
              w="220px" />
          </p>
        </div>
      ),
      notes:
        "○ AI 활용을 위한 좋은 시도로 생각됨.\n○ 기업의 AI 활용에 대한 보안/윤리적 제한에 대해서도 고민 필요.\n○ 전표 등 민감정보에 대해서는 유관부서와 사전 공유 및 IT 부서의 가이드라인을 따르는 것이 중요할 것으로 판단됨.",
    },
    {
      from: yeongNam.from, to: yeongNam.to,
      label: "영남사업본부",
      presenter: `${yeongNam.presenter} / ${yeongNam.team}`,
      script: (
        <div className="space-y-1">
          <p>
            ○{" "}
            <E value={yeongNam.presenter}
              onChange={(v) => setYeongNam((p) => ({ ...p, presenter: v }))}
              w="90px" />{" "}
            영남사업본부 발표해 주시기 바랍니다.
          </p>
          <p className="text-xs text-blue-700 pl-3">
            →{" "}
            <E value={yeongNam.topic}
              onChange={(v) => setYeongNam((p) => ({ ...p, topic: v }))}
              w="220px" />
          </p>
        </div>
      ),
      notes: "",
    },
    {
      from: jungNam.from, to: jungNam.to,
      label: "중남사업본부",
      presenter: `${jungNam.presenter} / ${jungNam.team}`,
      script: (
        <div className="space-y-1">
          <p>
            ○{" "}
            <E value={jungNam.presenter}
              onChange={(v) => setJungNam((p) => ({ ...p, presenter: v }))}
              w="90px" />{" "}
            중남사업본부 발표해 주시기 바랍니다.
          </p>
          <p className="text-xs text-blue-700 pl-3">
            →{" "}
            <E value={jungNam.topic}
              onChange={(v) => setJungNam((p) => ({ ...p, topic: v }))}
              w="220px" />
          </p>
        </div>
      ),
      notes:
        "○ 중남사업부는 차량당 배송 커버지역이 넓어 운행거리가 많음. 배송 거래처 증가 시 노선 수 조정 관련 배송기사 반발 여부 확인 필요.\n○ 대리점 도착시간에 문제가 없는지?",
    },
    {
      from: jegwa.from, to: jegwa.to,
      label: "제과사업부",
      presenter: `${jegwa.presenter} / ${jegwa.team}`,
      script: (
        <div className="space-y-1">
          <p>
            ○{" "}
            <E value={jegwa.presenter}
              onChange={(v) => setJegwa((p) => ({ ...p, presenter: v }))}
              w="90px" />{" "}
            제과사업부 발표해 주시기 바랍니다.
          </p>
          <p className="text-xs text-blue-700 pl-3">
            →{" "}
            <E value={jegwa.topic}
              onChange={(v) => setJegwa((p) => ({ ...p, topic: v }))}
              w="220px" />
          </p>
        </div>
      ),
      notes: "",
    },
    {
      from: "10:40", to: "10:50",
      label: "전체 공유",
      presenter: "회의진행",
      bg: "bg-gray-50",
      script: (
        <p>○ 각 팀별로 전달사항이나 특이사항 있으시면 공유해 주시기 바랍니다.</p>
      ),
      notes: "",
    },
    {
      from: "10:50", to: "10:50",
      label: "대표님 보고",
      presenter: "회의진행",
      script: (
        <p className="font-semibold text-gray-700">
          ○ 대표님, 금일 발표는 다 끝났습니다.
        </p>
      ),
      notes: "",
    },
    {
      from: "10:50", to: "11:00",
      label: "맺음말",
      presenter: "사장님",
      bg: "bg-indigo-50",
      script: (
        <p>
          ○ 대표님 맺음말{" "}
          <span className="text-gray-400 italic text-xs ml-1">[발언 후]</span>
          {" "}→ 이상으로{" "}
          <E value={month} onChange={setMonth} w="28px" />월
          업무혁신회의를 마치겠습니다.{" "}
          <span className="text-gray-400 italic text-xs">[상호 인사]</span>
        </p>
      ),
      notes: "",
    },
  ];

  const tdBase = "border border-gray-200 px-3 py-2.5 text-sm align-top leading-relaxed";

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* ── 헤더 ── */}
      <header className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              📋 업무혁신회의 — 진행자 멘트 시트
            </h1>
            <p className="text-indigo-200 text-xs mt-0.5">
              <span className="bg-yellow-300 text-yellow-900 px-1.5 py-0.5 rounded text-xs font-bold mr-1">
                노란색 항목
              </span>
              을 클릭하면 바로 수정할 수 있습니다
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-1.5 bg-white text-indigo-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition shadow"
          >
            🖨️ 인쇄 / PDF 저장
          </button>
        </div>
      </header>

      {/* ── 회의 기본정보 카드 ── */}
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-2">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex flex-wrap gap-x-8 gap-y-3 items-center">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium">📅 회의명</span>
            <E value={month} onChange={setMonth} w="28px" />
            <span className="text-gray-700">월 업무혁신회의</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium">🗓 일자</span>
            <E value={meetingDate} onChange={setMeetingDate} w="110px" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium">⏰ 종료예정</span>
            <E value={endTime} onChange={setEndTime} w="24px" />
            <span className="text-gray-700">시</span>
          </div>
          <div className="ml-auto text-xs text-gray-400 no-print italic hidden md:block">
            ※ 사전에 각 부서별 질문사항 미리 확인 후 통화 (회의자료 확인)
          </div>
        </div>
      </div>

      {/* ── 범례 ── */}
      <div className="max-w-6xl mx-auto px-6 py-2 no-print">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 items-center">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
            매번 수정이 필요한 항목 (클릭하여 편집)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
            발표 주제 (→ 화살표 아래)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-indigo-50 border border-indigo-200" />
            오프닝 / 클로징 구간
          </span>
        </div>
      </div>

      {/* ── 메인 테이블 ── */}
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-indigo-900 text-white text-xs">
                  <th className="px-3 py-3 font-semibold text-center border-r border-indigo-700 w-16 whitespace-nowrap">From</th>
                  <th className="px-3 py-3 font-semibold text-center border-r border-indigo-700 w-16 whitespace-nowrap">To</th>
                  <th className="px-3 py-3 font-semibold text-center border-r border-indigo-700 w-28 whitespace-nowrap">구분</th>
                  <th className="px-3 py-3 font-semibold text-center border-r border-indigo-700 w-36 whitespace-nowrap">담당 / 발표자</th>
                  <th className="px-3 py-3 font-semibold text-left border-r border-indigo-700">진행자 멘트</th>
                  <th className="px-3 py-3 font-semibold text-center whitespace-nowrap no-print w-32">추가 검토사항</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-100 hover:brightness-95 transition-all ${
                      row.bg ?? (i % 2 === 0 ? "bg-white" : "bg-slate-50/60")
                    }`}
                  >
                    <td className={`${tdBase} text-center font-mono text-gray-700 border-r border-gray-200 whitespace-nowrap`}>
                      {row.from}
                    </td>
                    <td className={`${tdBase} text-center font-mono text-gray-700 border-r border-gray-200 whitespace-nowrap`}>
                      {row.to}
                    </td>
                    <td className={`${tdBase} border-r border-gray-200`}>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.bg === "bg-indigo-50" ? "bg-indigo-400" : "bg-blue-400"}`} />
                        <span className="font-semibold text-gray-800 text-xs leading-tight">{row.label}</span>
                      </span>
                    </td>
                    <td className={`${tdBase} text-xs text-gray-600 border-r border-gray-200`}>
                      {row.presenter}
                    </td>
                    <td className={`${tdBase} text-gray-800`}>
                      {row.script}
                    </td>
                    <td className={`${tdBase} no-print`}>
                      <Notes text={row.notes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-gray-400 no-print">
          인쇄 시 추가 검토사항은 숨겨집니다. 브라우저 인쇄 설정에서 "배경 그래픽 포함"을 체크하면 색상이 유지됩니다.
        </p>
      </div>
    </div>
  );
}
