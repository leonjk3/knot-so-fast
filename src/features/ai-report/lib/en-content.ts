// AI_REPORT.md §9.3 — mock 리포트 원문(reasoning/risks/지역 이슈)은 한국어로만 작성되어
// 있으므로, 영문 UI/PDF에서는 report.id(및 risk 인덱스)·issue.id를 키로 하는 이 사전을
// 대신 사용한다. AI 재분석 override 텍스트는 이미 요청 언어로 생성돼 있으므로 이 사전을
// 거치지 않는다.

export interface EnReportContent {
  reasoning: string
  risks: string[]
}

export const EN_REPORT_CONTENT: Record<string, EnReportContent> = {
  rep001: {
    reasoning:
      'Congestion at the destination port (Rotterdam) is expected to be about 18 hours.\nReducing the planned speed from 16kts to 13.5kts saves 18.2% fuel while still arriving 20 hours ahead of the RTA.\nWave height in the Red Sea section is forecast at 2.1m — the reduced speed is also favorable for hull stress.',
    risks: [
      'High waves in the northern Red Sea|||Wave heights of 2.1-2.8m forecast over the next 48 hours. Recommend adjusting heading and maintaining current speed.',
      'Rotterdam port congestion|||Current average wait time is 18.5 hours. Maintaining an efficient speed is more cost-effective than early arrival.',
      'Suez Canal transit wait|||One-way north/south convoy transit through the Suez Canal is expected to add about 6 hours of wait. Already factored into the schedule.',
    ],
  },
  rep002: {
    reasoning:
      'A North Pacific low-pressure system is forecasting wave heights above 4.5m on the northern section of the route.\nA detour from the planned route is recommended; it adds 180nm of distance but is necessary for hull safety and cargo protection.\nMaintaining 14kts after the detour is expected to result in a 10-hour delay versus the RTA.\nRecommend renegotiating the discharge schedule.',
    risks: [
      'North Pacific low pressure — route detour required|||Wave heights of 4.5-6.0m and winds above 35kts forecast along the route July 19-22. Recommend a 2-degree southward detour.',
      'Worsening congestion at the Port of LA|||Average wait time at the Port of LA has risen to 32 hours. Combined with the 10-hour delay, the net schedule impact is minimal.',
    ],
  },
  rep003: {
    reasoning:
      'This voyage currently has a 16-hour buffer against the planned schedule.\nReducing speed by 0.5kts allows modest fuel savings with no impact on RTA compliance.\nWave heights in the South China Sea section are favorable (under 1.2m).',
    risks: [
      'Minor squalls in the South China Sea|||Localized squalls forecast east of the Philippines. Recommend radar monitoring; no route change required.',
    ],
  },
  rep004: {
    reasoning:
      'Approaching a piracy risk area in the Gulf of Aden transit section.\nCurrently complying with the recommended UKMTO 002 corridor.\nFavorable current direction expected during the Malacca Strait transit (0.5kts following).\nMaintaining 13.0kts is expected to arrive 6 hours ahead of the RTA.',
    risks: [
      'Gulf of Aden — piracy risk area|||Compliance with the UKMTO-recommended corridor is required. Transit currently complete. Recommend heightened night watch.',
      'Indian Ocean southwest monsoon|||Wave heights of 1.8-2.4m in the Indian Ocean section; following seas are actually favorable for propulsion.',
    ],
  },
}

export function enRiskTitle(reportId: string, riskIndex: number): string {
  const raw = EN_REPORT_CONTENT[reportId]?.risks[riskIndex]
  return raw ? raw.split('|||')[0] : ''
}

export function enRiskDescription(reportId: string, riskIndex: number): string {
  const raw = EN_REPORT_CONTENT[reportId]?.risks[riskIndex]
  return raw ? raw.split('|||')[1] : ''
}

export interface EnRegionalIssueContent {
  title: string
  description: string
}

export const EN_REGIONAL_ISSUE_CONTENT: Record<string, EnRegionalIssueContent> = {
  i001: {
    title: 'Piracy activity alert',
    description:
      'Increased piracy threat across the Gulf of Aden. IMB advisory Level 2. Patrols have been stepped up, but a detour route is recommended.',
  },
  i002: {
    title: 'Suez Canal transit delays',
    description:
      'Average wait time is 18 hours due to increased vessel traffic. Two convoys each are operating northbound and southbound.',
  },
  i003: {
    title: 'Shanghai port terminal congestion',
    description:
      'Container terminal congestion has pushed average berthing wait to 3.2 days. Recommend Yangshan/Ningbo as alternate ports.',
  },
  i004: {
    title: 'Malacca Strait transit restrictions',
    description: 'Night transit is restricted for large vessels (DWT 300,000+). Pilot boarding is mandatory.',
  },
  i005: {
    title: 'Red Sea security threat',
    description:
      'Houthi attacks on commercial vessels continue. US/UK joint escort operations are active. Recommend a Cape of Good Hope detour.',
  },
  i006: {
    title: 'Hong Kong port congestion',
    description: 'Container handling delayed by strike aftereffects. Berthing wait is 1.8 days.',
  },
  i007: {
    title: 'Rising tensions in the Strait of Hormuz',
    description:
      'Iran-US military standoff may restrict merchant transit. Reports of IRGC maritime inspections. Maintain continuous VHF Ch.16 monitoring and observe speed restrictions during transit.',
  },
}
