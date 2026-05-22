import { useState } from "react";
import { Info, AlertCircle, Sparkles, Bold as BoldIcon, ExternalLink } from "lucide-react";
import {
  UNTITLED_UI_DESIGN_SYSTEM,
  UNTITLED_UI_SCREEN_REFERENCES,
} from "@/lib/untitled-ui-attribution";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatCard, StatusBadge, SectionHeader } from "@/components/Stats";
import { STATUS_CONFIG } from "@/lib/index";
import { toast } from "@/hooks/use-toast";

function AttributionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
    </a>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            {description}
          </p>
        )}
      </div>
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
      >
        {children}
      </div>
    </section>
  );
}

export default function UiPreview() {
  const [slider, setSlider] = useState([42]);
  const [checked, setChecked] = useState(true);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-5xl mx-auto space-y-10 pb-12">
        <div
          className="rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ borderColor: "rgba(34,211,238,0.2)", background: "rgba(34,211,238,0.06)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(34,211,238,0.15)", color: "var(--primary)" }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                UI / UX 미리보기
              </h1>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                shadcn/ui 컴포넌트와 이 앱에서 쓰는 카드·배지 패턴을 한곳에서 확인합니다. 실제 배포 번들은{" "}
                <code className="text-xs px-1.5 py-0.5 rounded bg-white/10">npm run preview:prod</code> 로 검증할 수
                있습니다.
              </p>
            </div>
          </div>
        </div>

        <section className={cn(ui.card, "overflow-hidden")}>
          <div className={cn(ui.cardHeader, "space-y-1")}>
            <h2 className={ui.title}>디자인 출처 · Untitled UI</h2>
            <p className={ui.muted}>
              본 프로젝트 UI는 Figma 무료 키트「Untitled UI」디자인 시스템 스타일을 참고해 Tailwind로 구현했습니다. 특정
              Figma 파일을 그대로 임베드한 것이 아니라, 아래 패턴·토큰을 기준으로 재구성했습니다.
            </p>
          </div>
          <div className={cn(ui.cardBody, "space-y-6")}>
            <div className="flex flex-wrap gap-2">
              <AttributionLink href={UNTITLED_UI_DESIGN_SYSTEM.freeKitUrl} label="Free Figma UI Kit" />
              <AttributionLink href={UNTITLED_UI_DESIGN_SYSTEM.figmaUrl} label="Untitled UI Figma" />
              <AttributionLink href={UNTITLED_UI_DESIGN_SYSTEM.reactDocsUrl} label="Untitled UI React 문서" />
              <AttributionLink href={UNTITLED_UI_DESIGN_SYSTEM.reactRepoUrl} label="GitHub (untitleduico/react)" />
              <AttributionLink href={UNTITLED_UI_DESIGN_SYSTEM.downloadFigmaUrl} label="Figma 다운로드" />
            </div>
            <p className="text-xs text-slate-500">{UNTITLED_UI_DESIGN_SYSTEM.licenseNote}</p>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className={ui.tableHead}>
                    <th className="px-3 py-2.5">앱 화면</th>
                    <th className="px-3 py-2.5">경로</th>
                    <th className="px-3 py-2.5">참고한 Untitled UI 패턴</th>
                    <th className="px-3 py-2.5">템플릿·키트 링크</th>
                  </tr>
                </thead>
                <tbody>
                  {UNTITLED_UI_SCREEN_REFERENCES.map((row) => (
                    <tr key={row.appArea} className={ui.tableRow}>
                      <td className="px-3 py-3 font-medium text-slate-900">{row.appArea}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{row.appRoutes}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.untitledPattern}
                        <span className="mt-1 block text-xs text-slate-400">{row.note}</span>
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={row.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
                        >
                          {row.referenceUrl.includes("/react/") ? "React 문서" : "Free Figma UI Kit"}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <Section title="타이포 & 색" description="기본 텍스트 계층과 강조색입니다.">
          <div className="space-y-2">
            <p className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              Display 3xl
            </p>
            <p className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Section title xl
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              본문·보조 설명 (muted-foreground)
            </p>
            <p className="text-xs font-mono" style={{ color: "var(--primary)" }}>
              mono · primary — SCRUM-123
            </p>
          </div>
        </Section>

        <Section title="버튼" description="variant · size 조합입니다.">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Bold">
              <BoldIcon className="h-4 w-4" />
            </Button>
          </div>
        </Section>

        <Section title="배지" description="상태·라벨용 뱃지입니다.">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <StatusBadge {...STATUS_CONFIG.IN_PROGRESS} status="IN_PROGRESS" />
            <StatusBadge {...STATUS_CONFIG.BLOCKED} status="BLOCKED" />
          </div>
        </Section>

        <Section title="폼 컨트롤" description="입력·선택·토글입니다.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ui-demo-input">레이블</Label>
              <Input id="ui-demo-input" placeholder="플레이스홀더" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ui-demo-select">셀렉트</Label>
              <Select defaultValue="a">
                <SelectTrigger id="ui-demo-select">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">옵션 A</SelectItem>
                  <SelectItem value="b">옵션 B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ui-demo-textarea">텍스트 영역</Label>
              <Textarea id="ui-demo-textarea" rows={3} placeholder="여러 줄 입력…" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="c1" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              <Label htmlFor="c1">체크박스</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="s1" />
              <Label htmlFor="s1">스위치</Label>
            </div>
            <div className="space-y-3 md:col-span-2">
              <Label>슬라이더 · {slider[0]}%</Label>
              <Slider value={slider} onValueChange={setSlider} max={100} step={1} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>라디오 그룹</Label>
              <RadioGroup defaultValue="1" className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="1" id="r1" />
                  <Label htmlFor="r1">스프린트</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="2" id="r2" />
                  <Label htmlFor="r2">백로그</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </Section>

        <Section title="탭 · 토글 그룹" description="콘텐츠 전환·필터 UI입니다.">
          <Tabs defaultValue="one" className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="one">탭 1</TabsTrigger>
              <TabsTrigger value="two">탭 2</TabsTrigger>
              <TabsTrigger value="three">탭 3</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="text-sm mt-3" style={{ color: "var(--muted-foreground)" }}>
              첫 번째 패널 내용입니다.
            </TabsContent>
            <TabsContent value="two" className="text-sm mt-3" style={{ color: "var(--muted-foreground)" }}>
              두 번째 패널입니다.
            </TabsContent>
            <TabsContent value="three" className="text-sm mt-3" style={{ color: "var(--muted-foreground)" }}>
              세 번째 패널입니다.
            </TabsContent>
          </Tabs>
          <Separator className="my-2" />
          <ToggleGroup type="single" defaultValue="list" variant="outline" size="sm">
            <ToggleGroupItem value="list" aria-label="리스트">
              리스트
            </ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="보드">
              보드
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" aria-label="타임라인">
              타임라인
            </ToggleGroupItem>
          </ToggleGroup>
        </Section>

        <Section title="알림 · 카드" description="알럿과 카드 레이아웃입니다.">
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>안내</AlertTitle>
              <AlertDescription>기본 알림 스타일입니다. 배포 전 접근성·대비를 확인하세요.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>destructive 변형은 위험한 작업이나 실패 메시지에 사용합니다.</AlertDescription>
            </Alert>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>카드 제목</CardTitle>
                  <CardDescription>부제 또는 요약 한 줄</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">카드 본문 영역입니다.</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">액션</Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">컴팩트 카드</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-[80%]" />
                </CardContent>
              </Card>
            </div>
          </div>
        </Section>

        <Section title="아바타 · 진행률" description="팀·로딩·진행 표시입니다.">
          <div className="flex flex-wrap items-center gap-6">
            <Avatar>
              <AvatarFallback>SR</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[200px] max-w-sm space-y-2">
              <div className="flex justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span>스프린트 진행</span>
                <span>58%</span>
              </div>
              <Progress value={58} />
            </div>
          </div>
        </Section>

        <Section title="오버레이 · 메뉴" description="대화상자·드롭다운·툴팁입니다.">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">다이얼로그</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>모달 제목</DialogTitle>
                  <DialogDescription>확인·폼 등에 사용하는 오버레이 패턴입니다.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button">확인</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">드롭다운</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>메뉴</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>동기화</DropdownMenuItem>
                <DropdownMenuItem>설정</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">툴팁 (호버)</Button>
              </TooltipTrigger>
              <TooltipContent>짧은 보조 설명</TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              onClick={() =>
                toast({
                  title: "토스트",
                  description: "알림 메시지 미리보기입니다.",
                })
              }
            >
              토스트
            </Button>
          </div>
        </Section>

        <Section title="앱 전용 위젯" description="대시보드에서 쓰는 StatCard·SectionHeader입니다.">
          <div className="space-y-4">
            <SectionHeader title="섹션 헤더" subtitle="부제 텍스트" action={<Button size="sm">액션</Button>} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                label="완료율"
                value="72%"
                delta="▲ 4%p"
                deltaType="up"
                description="지난 스프린트 대비"
                icon={<Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />}
                iconBg="rgba(34,211,238,0.12)"
              />
              <StatCard
                label="블로커"
                value={2}
                unit="건"
                description="해결 필요"
                icon={<AlertCircle className="w-5 h-5" style={{ color: "#f87171" }} />}
                iconBg="rgba(248,113,113,0.12)"
              />
            </div>
          </div>
        </Section>
      </div>
    </TooltipProvider>
  );
}
